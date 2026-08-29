import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCancellationFollowUpMeta } from '@/lib/reservationCancellationReason'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fetchReservationsByIdsProgressive } from '@/lib/operationalQueueFetch'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { isReservationTourDatePastLocal, localCalendarDateKeyToday } from '@/utils/reservationUtils'
import type { Customer, Reservation } from '@/types/reservation'

/** 최근 취소 건 중 취소 사유 미기록 조회 기간(일) */
export const CANCELLED_MISSING_REASON_LOOKBACK_DAYS = 30

export type CancelledMissingReasonTab = 'needs_follow_up' | 'awaiting_reason'

export type CancelledMissingReasonQueueMeta = {
  needsFollowUpIds: string[]
  awaitingReasonIds: string[]
  unionCount: number
  needsFollowUpCount: number
  awaitingReasonCount: number
}

export type CancelledMissingReasonQueueData = CancelledMissingReasonQueueMeta & {
  reservations: Reservation[]
  customers: Customer[]
}

function hasCancellationReasonContent(reason: string | null | undefined): boolean {
  return Boolean(String(reason ?? '').trim())
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
      console.error('cancelledMissingReasonQueue pipeline manual:', error)
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
      console.error('cancelledMissingReasonQueue customers:', error)
      continue
    }
    customers.push(...((data || []) as Customer[]))
  }
  return customers
}

export async function fetchCancelledMissingReasonQueueMeta(
  supabase: SupabaseClient,
  operatorId?: string | null
): Promise<CancelledMissingReasonQueueMeta> {
  const opId = resolveOperatorId(operatorId)
  const since = new Date()
  since.setDate(since.getDate() - CANCELLED_MISSING_REASON_LOOKBACK_DAYS)
  const sinceIso = since.toISOString()
  const todayYmd = localCalendarDateKeyToday()

  const { data: rows, error } = await supabase
    .from('reservations')
    .select('id, updated_at, tour_date')
    .eq('operator_id', opId)
    .in('status', ['cancelled', 'canceled'])
    .gte('updated_at', sinceIso)
    .or(`tour_date.is.null,tour_date.gte.${todayYmd}`)
    .order('updated_at', { ascending: false })
    .limit(300)

  if (error) {
    console.error('cancelledMissingReasonQueue reservations:', error)
    return {
      needsFollowUpIds: [],
      awaitingReasonIds: [],
      unionCount: 0,
      needsFollowUpCount: 0,
      awaitingReasonCount: 0,
    }
  }

  const candidateIds = (rows || [])
    .filter((r) => !isReservationTourDatePastLocal((r as { tour_date?: string | null }).tour_date))
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean)

  if (candidateIds.length === 0) {
    return {
      needsFollowUpIds: [],
      awaitingReasonIds: [],
      unionCount: 0,
      needsFollowUpCount: 0,
      awaitingReasonCount: 0,
    }
  }

  const reasonMeta = await fetchCancellationFollowUpMeta(candidateIds)
  const pipelineMap = await fetchPipelineManualByReservationId(supabase, candidateIds)

  const needsFollowUpIds: string[] = []
  const awaitingReasonIds: string[] = []

  for (const id of candidateIds) {
    const reason = reasonMeta.get(id)?.reason ?? null
    if (hasCancellationReasonContent(reason)) continue

    const pipeline = pipelineMap.get(id)
    const followUpSent = pipeline?.cancelFollowUpManual ?? false
    if (followUpSent) {
      awaitingReasonIds.push(id)
    } else {
      needsFollowUpIds.push(id)
    }
  }

  const unionCount = needsFollowUpIds.length + awaitingReasonIds.length
  return {
    needsFollowUpIds,
    awaitingReasonIds,
    unionCount,
    needsFollowUpCount: needsFollowUpIds.length,
    awaitingReasonCount: awaitingReasonIds.length,
  }
}

export async function fetchCancelledMissingReasonQueueData(
  supabase: SupabaseClient,
  productMap: Map<string, string>,
  tourMap: Map<string, boolean>,
  operatorId?: string | null
): Promise<CancelledMissingReasonQueueData> {
  const meta = await fetchCancelledMissingReasonQueueMeta(supabase, operatorId)
  const unionIds = [...meta.needsFollowUpIds, ...meta.awaitingReasonIds]
  if (unionIds.length === 0) {
    return { ...meta, reservations: [], customers: [] }
  }

  const rawRows: Record<string, unknown>[] = []
  const { error } = await fetchReservationsByIdsProgressive(supabase, unionIds, {
    onChunk: (batch) => {
      rawRows.push(...batch)
    },
  }, operatorId)

  if (error) {
    console.error('cancelledMissingReasonQueue hydrate:', error)
    return { ...meta, reservations: [], customers: [] }
  }

  const reservations = mapDbReservationRowsToReservations(rawRows, productMap, tourMap).filter(
    (reservation) => !isReservationTourDatePastLocal(reservation.tourDate)
  )
  const keepIds = new Set(reservations.map((r) => String(r.id)))
  const needsFollowUpIds = meta.needsFollowUpIds.filter((id) => keepIds.has(String(id)))
  const awaitingReasonIds = meta.awaitingReasonIds.filter((id) => keepIds.has(String(id)))
  const order = new Map([...needsFollowUpIds, ...awaitingReasonIds].map((id, i) => [id, i]))
  reservations.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999))

  const customerIds = reservations.map((r) => r.customerId).filter(Boolean)
  const customers = await fetchCustomersByIds(supabase, customerIds)

  return {
    needsFollowUpIds,
    awaitingReasonIds,
    unionCount: needsFollowUpIds.length + awaitingReasonIds.length,
    needsFollowUpCount: needsFollowUpIds.length,
    awaitingReasonCount: awaitingReasonIds.length,
    reservations,
    customers,
  }
}

/** sessionStorage: 오늘 자동 모달 닫기 */
export function dismissCancelledMissingReasonAutoOpenForToday(): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    sessionStorage.setItem('reservations:cancelReasonQueueDismissed', today)
  } catch {
    /* ignore */
  }
}

export function isCancelledMissingReasonAutoOpenDismissedToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10)
    return sessionStorage.getItem('reservations:cancelReasonQueueDismissed') === today
  } catch {
    return false
  }
}
