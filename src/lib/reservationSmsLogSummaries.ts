import { supabase } from '@/lib/supabase'
import {
  resolveSmsLogDeliveryState,
  type SmsLogDeliveryState,
  type SmsLogRowForDelivery,
} from '@/lib/smsLogDeliveryState'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'

export type ReservationSmsCategoryLogSummary = {
  categoryId: ReservationOutboundSmsCategoryId | string
  deliveryState: SmsLogDeliveryState
  createdAt: string
}

export type ReservationSmsLogSummary = {
  /** 가장 최근 발송 기록 (카드 버튼 아이콘·테두리용) */
  latest: ReservationSmsCategoryLogSummary | null
  /** 카테고리별 최신 발송 기록 (메뉴 뱃지용) */
  byCategory: Partial<Record<string, ReservationSmsCategoryLogSummary>>
}

export type ReservationSmsLogRow = SmsLogRowForDelivery & {
  id?: string
  reservation_id: string
  category_id?: string | null
  created_at: string
}

export function buildReservationSmsLogSummaryFromRows(
  rows: ReservationSmsLogRow[]
): ReservationSmsLogSummary {
  const byCategory: Partial<Record<string, ReservationSmsCategoryLogSummary>> = {}
  let latest: ReservationSmsCategoryLogSummary | null = null

  for (const row of rows) {
    const categoryId = String(row.category_id ?? 'pre_tour_contact').trim() || 'pre_tour_contact'
    const createdAt = row.created_at
    const deliveryState = resolveSmsLogDeliveryState(row)
    const entry: ReservationSmsCategoryLogSummary = { categoryId, deliveryState, createdAt }

    if (!latest || createdAt > latest.createdAt) {
      latest = entry
    }

    const existing = byCategory[categoryId]
    if (!existing || createdAt > existing.createdAt) {
      byCategory[categoryId] = entry
    }
  }

  return { latest, byCategory }
}

export function buildReservationSmsLogSummariesMap(
  rows: ReservationSmsLogRow[]
): Map<string, ReservationSmsLogSummary> {
  const byReservation = new Map<string, ReservationSmsLogRow[]>()
  for (const row of rows) {
    const rid = String(row.reservation_id ?? '').trim()
    if (!rid) continue
    const list = byReservation.get(rid) ?? []
    list.push(row)
    byReservation.set(rid, list)
  }

  const out = new Map<string, ReservationSmsLogSummary>()
  for (const [rid, list] of byReservation) {
    out.set(rid, buildReservationSmsLogSummaryFromRows(list))
  }
  return out
}

export async function fetchReservationSmsLogSummaries(
  reservationIds: string[]
): Promise<Map<string, ReservationSmsLogSummary>> {
  const ids = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (ids.length === 0) return new Map()

  const { data, error } = await (supabase as any)
    .from('pre_tour_contact_sms_logs')
    .select(
      'id, reservation_id, category_id, status, delivered_at, failed_at, error_message, created_at'
    )
    .in('reservation_id', ids)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchReservationSmsLogSummaries]', error)
    return new Map()
  }

  return buildReservationSmsLogSummariesMap((data ?? []) as ReservationSmsLogRow[])
}
