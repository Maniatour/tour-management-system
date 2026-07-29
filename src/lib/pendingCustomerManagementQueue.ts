import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildPendingCustomerWorkflowState,
  reservationNeedsPendingCustomerAttention,
} from '@/lib/pendingCustomerManagementWorkflow'
import { pendingCustomerManagementDateRange } from '@/lib/pendingCustomerManagementTodo'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fetchReservationsByIdsProgressive } from '@/lib/operationalQueueFetch'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { Customer, Reservation } from '@/types/reservation'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'

export type PendingCustomerManagementQueueItem = {
  reservation: Reservation
  altTourNoticeManual: boolean
  hasCustomerResponse: boolean
  resolutionKind: PendingCustomerResolutionKind | null
  daysUntilTour: number
}

export type PendingCustomerManagementQueueData = {
  items: PendingCustomerManagementQueueItem[]
  count: number
  customers: Customer[]
  dateRange: { start: string; end: string }
}

function compareReservationsByTourDateAsc(a: Reservation, b: Reservation): number {
  const da = String(a.tourDate ?? '').trim() || '9999-99-99'
  const db = String(b.tourDate ?? '').trim() || '9999-99-99'
  const byTour = da.localeCompare(db)
  if (byTour !== 0) return byTour
  return String(a.id).localeCompare(String(b.id))
}

function daysUntilTourFromToday(tourDate: string, today: string): number {
  const start = new Date(`${today}T12:00:00`)
  const end = new Date(`${tourDate.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

async function fetchPipelineManualByReservationId(
  supabase: SupabaseClient,
  ids: string[]
): Promise<
  Map<string, { altTourNoticeManual: boolean; resolutionKind: PendingCustomerResolutionKind | null }>
> {
  const map = new Map<
    string,
    { altTourNoticeManual: boolean; resolutionKind: PendingCustomerResolutionKind | null }
  >()
  if (ids.length === 0) return map

  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservation_follow_up_pipeline_manual')
      .select('reservation_id, pending_alt_tour_notice_manual, pending_resolution_kind')
      .in('reservation_id', chunk)
    if (error) {
      console.error('pendingCustomerManagementQueue pipeline manual:', error)
      continue
    }
    for (const row of data || []) {
      const rid = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
      if (!rid) continue
      const kindRaw = (row as { pending_resolution_kind?: string | null }).pending_resolution_kind
      const kind =
        kindRaw === 'cancel' || kindRaw === 'date_change' || kindRaw === 'tour_change'
          ? kindRaw
          : null
      map.set(rid, {
        altTourNoticeManual: !!(row as { pending_alt_tour_notice_manual?: boolean })
          .pending_alt_tour_notice_manual,
        resolutionKind: kind,
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
      console.error('pendingCustomerManagementQueue customer response:', error)
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
      console.error('pendingCustomerManagementQueue customers:', error)
      continue
    }
    customers.push(...((data || []) as Customer[]))
  }
  return customers
}

export async function fetchPendingCustomerManagementQueueData(
  supabase: SupabaseClient,
  productMap: Map<string, string>,
  tourMap: Map<string, boolean>,
  operatorId?: string | null
): Promise<PendingCustomerManagementQueueData> {
  const opId = resolveOperatorId(operatorId)
  const dateRange = pendingCustomerManagementDateRange()

  const { data: rows, error } = await supabase
    .from('reservations')
    .select('id, tour_date, status')
    .eq('operator_id', opId)
    .eq('status', 'pending')
    .gte('tour_date', dateRange.start)
    .lte('tour_date', dateRange.end)
    .order('tour_date', { ascending: true })
    .limit(300)

  if (error) {
    console.error('pendingCustomerManagementQueue reservations:', error)
    return { items: [], count: 0, customers: [], dateRange }
  }

  const candidateIds = (rows || [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean)

  if (candidateIds.length === 0) {
    return { items: [], count: 0, customers: [], dateRange }
  }

  const [pipelineMap, customerResponseSet] = await Promise.all([
    fetchPipelineManualByReservationId(supabase, candidateIds),
    fetchCustomerResponseByReservationId(supabase, candidateIds),
  ])

  const attentionIds: string[] = []
  for (const id of candidateIds) {
    const row = (rows || []).find((r) => String((r as { id?: string }).id) === id) as
      | { tour_date?: string | null; status?: string | null }
      | undefined
    const pipeline = pipelineMap.get(id)
    const workflow = buildPendingCustomerWorkflowState({
      altTourNoticeManual: pipeline?.altTourNoticeManual ?? false,
      hasCustomerResponse: customerResponseSet.has(id),
      resolutionKind: pipeline?.resolutionKind ?? null,
    })
    if (
      reservationNeedsPendingCustomerAttention({
        status: row?.status ?? 'pending',
        tourDate: row?.tour_date ?? null,
        workflow,
        dateRange,
      })
    ) {
      attentionIds.push(id)
    }
  }

  if (attentionIds.length === 0) {
    return { items: [], count: 0, customers: [], dateRange }
  }

  const rawRows: Record<string, unknown>[] = []
  const { error: hydrateError } = await fetchReservationsByIdsProgressive(supabase, attentionIds, {
    onChunk: (batch) => {
      rawRows.push(...batch)
    },
  }, opId)

  if (hydrateError) {
    console.error('pendingCustomerManagementQueue hydrate:', hydrateError)
    return { items: [], count: 0, customers: [], dateRange }
  }

  const reservations = mapDbReservationRowsToReservations(rawRows, productMap, tourMap).sort(
    compareReservationsByTourDateAsc
  )

  const items: PendingCustomerManagementQueueItem[] = reservations.map((reservation) => {
    const pipeline = pipelineMap.get(reservation.id)
    const tourDate = String(reservation.tourDate ?? '').slice(0, 10)
    return {
      reservation,
      altTourNoticeManual: pipeline?.altTourNoticeManual ?? false,
      hasCustomerResponse: customerResponseSet.has(reservation.id),
      resolutionKind: pipeline?.resolutionKind ?? null,
      daysUntilTour: daysUntilTourFromToday(tourDate, dateRange.start),
    }
  })

  const customers = await fetchCustomersByIds(
    supabase,
    reservations.map((r) => r.customerId).filter(Boolean)
  )

  return { items, count: items.length, customers, dateRange }
}
