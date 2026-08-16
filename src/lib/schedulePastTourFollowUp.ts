import type { SupabaseClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { isAbortLikeError } from '@/lib/isAbortLikeError'
import {
  tourExpenseHasReceiptAttachment,
  tourSettlementProductExcludedFromNoReceiptCheck,
} from '@/lib/tourSettlementTodo'
import { isTourDeletedStatus, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

/** 오늘 이전 투어 조회 기간 (라스베이거스 기준) */
export const SCHEDULE_PAST_FOLLOW_UP_LOOKBACK_DAYS = 730

export type SchedulePastFollowUpTour = {
  id: string
  tour_date: string | null
  tour_status: string | null
  product_id: string | null
  product_name: string | null
  guide_name: string | null
  balance_total: number
}

function todayYmdLv(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

function numBalance(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

function logFollowUpError(label: string, err: unknown): void {
  if (isAbortLikeError(err)) return
  console.error(label, err)
}

async function fetchAllInChunks<T>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))]
  const out: T[] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    out.push(...(await fetchChunk(chunk)))
  }
  return out
}

type RawPastTour = {
  id: string
  tour_date: string | null
  tour_status: string | null
  product_id: string | null
  tour_guide_id: string | null
  reservation_ids: unknown
  receipt_not_required: boolean | null
}

async function fetchPastToursInWindow(
  supabase: SupabaseClient,
  startYmd: string,
  todayYmd: string
): Promise<RawPastTour[]> {
  const pageSize = 1000
  const rows: RawPastTour[] = []
  for (let from = 0, iter = 0; iter < 200; iter++) {
    const { data, error } = await supabase
      .from('tours')
      .select(
        'id, tour_date, tour_status, product_id, tour_guide_id, reservation_ids, receipt_not_required'
      )
      .gte('tour_date', startYmd)
      .lt('tour_date', todayYmd)
      .order('tour_date', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      logFollowUpError('schedulePastTourFollowUp: tours', error)
      break
    }
    const batch = (data || []) as RawPastTour[]
    if (batch.length === 0) break
    for (const t of batch) {
      if (isTourDeletedStatus(t.tour_status)) continue
      if (isTourCancelled((t.tour_status || '').toString())) continue
      rows.push(t)
    }
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function fetchProductMeta(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<{
  labelById: Map<string, string>
  activeIds: Set<string>
  excludedNoReceiptIds: Set<string>
}> {
  const labelById = new Map<string, string>()
  const activeIds = new Set<string>()
  const excludedNoReceiptIds = new Set<string>()
  if (productIds.length === 0) return { labelById, activeIds, excludedNoReceiptIds }

  await fetchAllInChunks(productIds, 200, async (chunk) => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, name_ko, name_en, status')
      .in('id', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: products', error)
      return []
    }
    for (const p of data || []) {
      const row = p as {
        id: string
        name?: string | null
        name_ko?: string | null
        name_en?: string | null
        status?: string | null
      }
      const pid = String(row.id)
      const st = String(row.status || '').toLowerCase()
      if (st === 'inactive') continue
      activeIds.add(pid)
      labelById.set(pid, row.name || row.name_ko || row.name_en || pid)
      if (tourSettlementProductExcludedFromNoReceiptCheck(row)) {
        excludedNoReceiptIds.add(pid)
      }
    }
    return []
  })

  return { labelById, activeIds, excludedNoReceiptIds }
}

async function fetchGuideNameByEmail(
  supabase: SupabaseClient,
  emails: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (emails.length === 0) return map
  await fetchAllInChunks(emails, 200, async (chunk) => {
    const { data, error } = await supabase.from('team').select('email, name_ko, nick_name').in('email', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: team', error)
      return []
    }
    for (const m of data || []) {
      const row = m as { email: string; name_ko?: string | null; nick_name?: string | null }
      map.set(row.email, (row.nick_name && row.nick_name.trim()) || row.name_ko || row.email)
    }
    return []
  })
  return map
}

async function fetchTourIdsWithReceiptAttachment(
  supabase: SupabaseClient,
  tourIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  await fetchAllInChunks(tourIds, 200, async (chunk) => {
    const { data, error } = await supabase
      .from('tour_expenses')
      .select('tour_id, image_url, file_path')
      .in('tour_id', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: tour_expenses', error)
      return []
    }
    for (const row of data || []) {
      const exp = row as { tour_id?: string | null; image_url?: string | null; file_path?: string | null }
      const tid = String(exp.tour_id ?? '').trim()
      if (!tid) continue
      if (tourExpenseHasReceiptAttachment({
        image_url: exp.image_url ?? null,
        file_path: exp.file_path ?? null,
      })) out.add(tid)
    }
    return []
  })
  return out
}

async function fetchBalanceByReservationId(
  supabase: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  await fetchAllInChunks(reservationIds, 500, async (chunk) => {
    const { data, error } = await supabase
      .from('reservation_pricing')
      .select('reservation_id, balance_amount')
      .in('reservation_id', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: reservation_pricing', error)
      return []
    }
    for (const row of data || []) {
      const r = row as { reservation_id: string; balance_amount?: unknown }
      map.set(String(r.reservation_id), numBalance(r.balance_amount))
    }
    return []
  })
  return map
}

function tourBalanceTotal(
  reservationIdsRaw: unknown,
  balanceByReservation: Map<string, number>
): number {
  let sum = 0
  for (const id of normalizeReservationIds(reservationIdsRaw)) {
    sum += balanceByReservation.get(String(id).trim()) ?? 0
  }
  return sum
}

function toFollowUpRow(
  t: RawPastTour,
  productLabel: Map<string, string>,
  teamMap: Map<string, string>,
  balanceTotal = 0
): SchedulePastFollowUpTour {
  const pid = t.product_id != null ? String(t.product_id) : null
  const guide = t.tour_guide_id ? teamMap.get(t.tour_guide_id) : null
  return {
    id: String(t.id),
    tour_date: t.tour_date ?? null,
    tour_status: t.tour_status ?? null,
    product_id: pid,
    product_name: pid ? productLabel.get(pid) ?? null : null,
    guide_name: guide ?? null,
    balance_total: balanceTotal,
  }
}

/**
 * 오늘 이전(당일 제외) 투어 중 영수증 미첨부 / 잔금 남음 목록.
 */
export async function fetchSchedulePastTourFollowUp(supabase: SupabaseClient): Promise<{
  missingReceipts: SchedulePastFollowUpTour[]
  balanceRemaining: SchedulePastFollowUpTour[]
}> {
  const today = todayYmdLv()
  const startYmd = dayjs.tz(today, LV_TZ).subtract(SCHEDULE_PAST_FOLLOW_UP_LOOKBACK_DAYS, 'day').format('YYYY-MM-DD')
  const pastTours = await fetchPastToursInWindow(supabase, startYmd, today)
  if (pastTours.length === 0) {
    return { missingReceipts: [], balanceRemaining: [] }
  }

  const productIds = [...new Set(pastTours.map((t) => t.product_id).filter((id): id is string => id != null))]
  const { labelById, activeIds, excludedNoReceiptIds } = await fetchProductMeta(supabase, productIds)
  const visible = pastTours.filter((t) => {
    const pid = t.product_id as string | null | undefined
    return pid ? activeIds.has(pid) : true
  })

  const guideEmails = [
    ...new Set(visible.map((t) => t.tour_guide_id).filter((e): e is string => e != null && e !== '')),
  ]
  const teamMap = await fetchGuideNameByEmail(supabase, guideEmails)

  const tourIds = visible.map((t) => String(t.id))
  const tourIdsWithReceipt = await fetchTourIdsWithReceiptAttachment(supabase, tourIds)

  const allReservationIds = new Set<string>()
  for (const t of visible) {
    for (const rid of normalizeReservationIds(t.reservation_ids)) {
      allReservationIds.add(String(rid).trim())
    }
  }
  const balanceByReservation = await fetchBalanceByReservationId(supabase, [...allReservationIds])

  const missingReceipts: SchedulePastFollowUpTour[] = []
  const balanceRemaining: SchedulePastFollowUpTour[] = []

  for (const t of visible) {
    const tid = String(t.id).trim()
    const pid = t.product_id != null ? String(t.product_id).trim() : ''
    const guideAssigned = String(t.tour_guide_id ?? '').trim().length > 0
    const receiptNotRequired = Boolean(t.receipt_not_required)
    const excludedProduct = pid !== '' && excludedNoReceiptIds.has(pid)
    const hasReceipt = tourIdsWithReceipt.has(tid)
    const balanceTotal = tourBalanceTotal(t.reservation_ids, balanceByReservation)

    if (guideAssigned && !receiptNotRequired && !excludedProduct && !hasReceipt) {
      missingReceipts.push(toFollowUpRow(t, labelById, teamMap, balanceTotal))
    }
    if (balanceTotal > 0.009) {
      balanceRemaining.push(toFollowUpRow(t, labelById, teamMap, balanceTotal))
    }
  }

  const sortDesc = (a: SchedulePastFollowUpTour, b: SchedulePastFollowUpTour) =>
    (b.tour_date || '').localeCompare(a.tour_date || '')
  missingReceipts.sort(sortDesc)
  balanceRemaining.sort(sortDesc)

  return { missingReceipts, balanceRemaining }
}

export async function markTourReceiptNotRequired(
  supabase: SupabaseClient,
  tourId: string,
  actorEmail: string | null
): Promise<{ error: string | null }> {
  const tid = String(tourId).trim()
  if (!tid) return { error: 'Missing tour id' }
  const { error } = await supabase
    .from('tours')
    .update({
      receipt_not_required: true,
      receipt_not_required_at: new Date().toISOString(),
      receipt_not_required_by: actorEmail ? actorEmail.trim() : null,
    })
    .eq('id', tid)
  if (error) return { error: error.message }
  return { error: null }
}

export type SchedulePastBalanceReservationItem = {
  reservationId: string
  displayLabel: string | null
  totalPeople: number
  balanceAmount: number
}

export async function fetchSchedulePastTourBalanceDetails(
  supabase: SupabaseClient,
  tourId: string
): Promise<SchedulePastBalanceReservationItem[]> {
  const tid = String(tourId).trim()
  if (!tid) return []
  const { data: tourRow, error: tourErr } = await supabase
    .from('tours')
    .select('reservation_ids')
    .eq('id', tid)
    .maybeSingle()
  if (tourErr) {
    logFollowUpError('schedulePastTourFollowUp: balance tour', tourErr)
    return []
  }
  const reservationIds = normalizeReservationIds((tourRow as { reservation_ids?: unknown } | null)?.reservation_ids)
  if (reservationIds.length === 0) return []

  const { data: pricingRows, error: pricingErr } = await supabase
    .from('reservation_pricing')
    .select('reservation_id, balance_amount')
    .in('reservation_id', reservationIds)
  if (pricingErr) {
    logFollowUpError('schedulePastTourFollowUp: balance pricing', pricingErr)
    return []
  }
  const balanceMap = new Map<string, number>()
  for (const p of pricingRows || []) {
    const row = p as { reservation_id: string; balance_amount?: unknown }
    const rid = String(row.reservation_id).trim()
    if (rid) balanceMap.set(rid, numBalance(row.balance_amount))
  }

  const { data: reservRows, error: reservErr } = await supabase
    .from('reservations')
    .select('id, customer_id, channel_rn, total_people, adults, child, infant')
    .in('id', reservationIds)
  if (reservErr) {
    logFollowUpError('schedulePastTourFollowUp: balance reservations', reservErr)
    return []
  }

  const customerIds = [
    ...new Set(
      (reservRows || [])
        .map((r) => (r as { customer_id?: string | null }).customer_id)
        .filter((cid): cid is string => cid != null && String(cid).trim() !== '')
        .map((cid) => String(cid).trim())
    ),
  ]
  const customerNameById = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: customerRows } = await supabase.from('customers').select('id, name').in('id', customerIds)
    for (const c of customerRows || []) {
      const row = c as { id: string; name?: string | null }
      customerNameById.set(String(row.id), String(row.name || '').trim())
    }
  }

  const details: SchedulePastBalanceReservationItem[] = []
  for (const r of reservRows || []) {
    const row = r as {
      id: string
      customer_id?: string | null
      channel_rn?: string | null
      total_people?: number | null
      adults?: number | null
      child?: number | null
      infant?: number | null
    }
    const rid = String(row.id).trim()
    if (!rid) continue
    const bal = balanceMap.get(rid) ?? 0
    if (bal <= 0.009) continue
    const custId = row.customer_id ? String(row.customer_id).trim() : ''
    const label = (custId ? customerNameById.get(custId) : null) || String(row.channel_rn || '').trim() || null
    const totalPeople =
      Number(row.total_people) > 0
        ? Number(row.total_people)
        : (Number(row.adults) || 0) + (Number(row.child) || 0) + (Number(row.infant) || 0)
    details.push({
      reservationId: rid,
      displayLabel: label,
      totalPeople,
      balanceAmount: bal,
    })
  }
  details.sort((a, b) => b.balanceAmount - a.balanceAmount)
  return details
}
