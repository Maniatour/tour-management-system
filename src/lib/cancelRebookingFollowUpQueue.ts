import type { SupabaseClient } from '@supabase/supabase-js'
import { CANCELLED_MISSING_REASON_LOOKBACK_DAYS } from '@/lib/cancelledMissingReasonQueue'
import {
  buildCancelRebookingWorkflowState,
  reservationNeedsCancelRebookingFollowUpAttention,
} from '@/lib/cancelRebookingFollowUpWorkflow'
import { fetchCancellationFollowUpMeta } from '@/lib/reservationCancellationReason'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fetchReservationsByIdsProgressive } from '@/lib/operationalQueueFetch'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { Customer, Reservation } from '@/types/reservation'
import { getReservationPartySize, isReservationTourDatePastLocal } from '@/utils/reservationUtils'
import { normalizeReservationIds } from '@/utils/tourUtils'

const DEFAULT_TOUR_MAX = 12

export type CancelRebookingTourCapacity = {
  assignedPeople: number
  maxParticipants: number
}

export type CancelRebookingFollowUpQueueItem = {
  reservation: Reservation
  cancellationReason: string | null
  /** reservation_follow_ups(cancellation_reason) 최초 기록 시각 */
  cancellationRecordedAt: string | null
  hasCustomerResponse: boolean
  cancelFollowUpManual: boolean
  cancelRebookingOutreachManual: boolean
}

function compareReservationsByTourDateAsc(a: Reservation, b: Reservation): number {
  const da = String(a.tourDate ?? '').trim() || '9999-99-99'
  const db = String(b.tourDate ?? '').trim() || '9999-99-99'
  const byTour = da.localeCompare(db)
  if (byTour !== 0) return byTour
  return String(a.id).localeCompare(String(b.id))
}

export type CancelRebookingFollowUpQueueData = {
  items: CancelRebookingFollowUpQueueItem[]
  count: number
  customers: Customer[]
}

async function fetchPipelineManualByReservationId(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, { cancelFollowUpManual: boolean; cancelRebookingOutreachManual: boolean }>> {
  const map = new Map<string, { cancelFollowUpManual: boolean; cancelRebookingOutreachManual: boolean }>()
  if (ids.length === 0) return map

  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservation_follow_up_pipeline_manual')
      .select('reservation_id, cancel_follow_up_manual, cancel_rebooking_outreach_manual')
      .in('reservation_id', chunk)
    if (error) {
      console.error('cancelRebookingFollowUpQueue pipeline manual:', error)
      continue
    }
    for (const row of data || []) {
      const rid = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
      if (!rid) continue
      map.set(rid, {
        cancelFollowUpManual: !!(row as { cancel_follow_up_manual?: boolean }).cancel_follow_up_manual,
        cancelRebookingOutreachManual: !!(row as { cancel_rebooking_outreach_manual?: boolean })
          .cancel_rebooking_outreach_manual,
      })
    }
  }
  return map
}

async function fetchCustomerResponseByReservationId(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Set<string>> {
  const set = new Set<string>()
  if (ids.length === 0) return set

  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
      .select('reservation_id, content')
      .in('reservation_id', chunk)
      .eq('type', 'contact')
    if (error) {
      console.error('cancelRebookingFollowUpQueue customer response:', error)
      continue
    }
    for (const row of data || []) {
      const rid = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
      const content = String((row as { content?: string | null }).content ?? '').trim()
      if (rid && content) set.add(rid)
    }
  }
  return set
}

async function fetchCustomersByIds(
  supabase: SupabaseClient,
  customerIds: string[]
): Promise<Customer[]> {
  const unique = [...new Set(customerIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const customers: Customer[] = []
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('customers').select('*').in('id', chunk)
    if (error) {
      console.error('cancelRebookingFollowUpQueue customers:', error)
      continue
    }
    customers.push(...((data || []) as Customer[]))
  }
  return customers
}

function isActiveAssignedReservationStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase().trim()
  return s !== 'cancelled' && s !== 'canceled' && s !== 'deleted'
}

export async function fetchTourCapacityByTourIds(
  supabase: SupabaseClient,
  tourIds: string[]
): Promise<Map<string, CancelRebookingTourCapacity>> {
  const map = new Map<string, CancelRebookingTourCapacity>()
  const uniqueTourIds = [...new Set(tourIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (uniqueTourIds.length === 0) return map

  const { data: tours, error } = await supabase
    .from('tours')
    .select('id, max_participants, reservation_ids')
    .in('id', uniqueTourIds)

  if (error) {
    console.error('cancelRebookingFollowUpQueue tour capacity:', error)
    return map
  }

  const reservationIdSet = new Set<string>()
  for (const tour of tours || []) {
    for (const id of normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)) {
      if (id) reservationIdSet.add(id)
    }
  }

  const reservationById = new Map<string, number>()
  const reservationIds = [...reservationIdSet]
  const chunkSize = 200
  for (let i = 0; i < reservationIds.length; i += chunkSize) {
    const chunk = reservationIds.slice(i, i + chunkSize)
    const { data, error: resError } = await supabase
      .from('reservations')
      .select('id, status, total_people, adults, child, infant')
      .in('id', chunk)
    if (resError) {
      console.error('cancelRebookingFollowUpQueue tour capacity reservations:', resError)
      continue
    }
    for (const row of data || []) {
      const id = String((row as { id?: string }).id ?? '').trim()
      if (!id) continue
      const status = String((row as { status?: string }).status ?? '')
      if (!isActiveAssignedReservationStatus(status)) continue
      reservationById.set(id, getReservationPartySize(row as Record<string, unknown>))
    }
  }

  for (const tour of tours || []) {
    const tourId = String((tour as { id?: string }).id ?? '').trim()
    if (!tourId) continue
    const assignedPeople = normalizeReservationIds(
      (tour as { reservation_ids?: unknown }).reservation_ids
    ).reduce((sum, reservationId) => sum + (reservationById.get(reservationId) ?? 0), 0)
    const rawMax = (tour as { max_participants?: number | null }).max_participants
    const maxParticipants =
      typeof rawMax === 'number' && Number.isFinite(rawMax) ? rawMax : DEFAULT_TOUR_MAX
    map.set(tourId, { assignedPeople, maxParticipants })
  }

  return map
}

export async function fetchCancelRebookingFollowUpQueueData(
  supabase: SupabaseClient,
  productMap: Map<string, string>,
  tourMap: Map<string, boolean>,
  operatorId?: string | null
): Promise<CancelRebookingFollowUpQueueData> {
  const opId = resolveOperatorId(operatorId)
  const since = new Date()
  since.setDate(since.getDate() - CANCELLED_MISSING_REASON_LOOKBACK_DAYS)
  const sinceIso = since.toISOString()

  const { data: rows, error } = await supabase
    .from('reservations')
    .select('id, updated_at')
    .eq('operator_id', opId)
    .in('status', ['cancelled', 'canceled'])
    .gte('updated_at', sinceIso)
    .order('updated_at', { ascending: false })
    .limit(300)

  if (error) {
    console.error('cancelRebookingFollowUpQueue reservations:', error)
    return { items: [], count: 0, customers: [] }
  }

  const candidateIds = (rows || [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean)

  if (candidateIds.length === 0) {
    return { items: [], count: 0, customers: [] }
  }

  const [reasonMeta, pipelineMap, customerResponseSet] = await Promise.all([
    fetchCancellationFollowUpMeta(candidateIds),
    fetchPipelineManualByReservationId(supabase, candidateIds),
    fetchCustomerResponseByReservationId(supabase, candidateIds),
  ])

  const attentionIds: string[] = []
  for (const id of candidateIds) {
    const reason = reasonMeta.get(id)?.reason ?? null
    const pipeline = pipelineMap.get(id)
    const workflow = buildCancelRebookingWorkflowState({
      snapshot: {
        confirmationSent: false,
        confirmationSentDirect: false,
        confirmationInferredFromDeparture: false,
        residentInquirySent: false,
        guestResidentFlowCompleted: false,
        departureSent: false,
        pickupSent: false,
        needsResidentFlow: false,
        manualConfirmation: false,
        manualResident: false,
        manualDeparture: false,
        manualPickup: false,
        cancelFollowUpManual: pipeline?.cancelFollowUpManual ?? false,
        cancelRebookingOutreachManual: pipeline?.cancelRebookingOutreachManual ?? false,
      },
      cancellationReason: reason,
      hasCustomerResponse: customerResponseSet.has(id),
    })
    if (
      reservationNeedsCancelRebookingFollowUpAttention({
        status: 'cancelled',
        cancellationReason: reason,
        workflow,
      })
    ) {
      attentionIds.push(id)
    }
  }

  if (attentionIds.length === 0) {
    return { items: [], count: 0, customers: [] }
  }

  const rawRows: Record<string, unknown>[] = []
  const { error: hydrateError } = await fetchReservationsByIdsProgressive(supabase, attentionIds, {
    onChunk: (batch) => {
      rawRows.push(...batch)
    },
  }, opId)

  if (hydrateError) {
    console.error('cancelRebookingFollowUpQueue hydrate:', hydrateError)
    return { items: [], count: 0, customers: [] }
  }

  const reservations = mapDbReservationRowsToReservations(rawRows, productMap, tourMap)
    .filter((reservation) => !isReservationTourDatePastLocal(reservation.tourDate))
    .sort(compareReservationsByTourDateAsc)

  const items: CancelRebookingFollowUpQueueItem[] = reservations.map((reservation) => {
    const meta = reasonMeta.get(reservation.id)
    const reason = meta?.reason ?? null
    const pipeline = pipelineMap.get(reservation.id)
    return {
      reservation,
      cancellationReason: reason,
      cancellationRecordedAt: meta?.firstRecordedAt ?? null,
      hasCustomerResponse: customerResponseSet.has(reservation.id),
      cancelFollowUpManual: pipeline?.cancelFollowUpManual ?? false,
      cancelRebookingOutreachManual: pipeline?.cancelRebookingOutreachManual ?? false,
    }
  })

  const customers = await fetchCustomersByIds(
    supabase,
    reservations.map((r) => r.customerId).filter(Boolean)
  )

  return { items, count: items.length, customers }
}

export async function fetchCancelRebookingFollowUpQueueCount(
  supabase: SupabaseClient,
  operatorId?: string | null
): Promise<number> {
  const data = await fetchCancelRebookingFollowUpQueueData(
    supabase,
    new Map(),
    new Map(),
    operatorId
  )
  return data.count
}
