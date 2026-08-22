import type { SupabaseClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  computeAssignedReservationDisplayBalance,
  type AssignedBalanceOptionRow,
  type AssignedBalanceReservationInput,
} from '@/lib/assignedReservationBalance'
import { isAbortLikeError } from '@/lib/isAbortLikeError'
import { isDateChangedReservationStatus } from '@/lib/reservationStatus'
import {
  tourSettlementProductExcludedFromNoReceiptCheck,
} from '@/lib/tourSettlementTodo'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  isTourDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'

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
  has_expense: boolean
}

function todayYmdLv(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

function productNameBlob(p: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): string {
  return [p.name, p.name_ko, p.name_en]
    .map((s) => String(s ?? '').toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 지출 없는 투어 목록에서 제외: 야경·골프 등 + 공항 픽드롭·공항 샌딩·공항 픽업 8주년 */
function productExcludedFromNoExpenseList(p: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): boolean {
  if (tourSettlementProductExcludedFromNoReceiptCheck(p)) return true
  const blob = productNameBlob(p)
  if (!blob) return false
  const compact = blob.replace(/\s/g, '')
  if (compact.includes('공항픽드롭') || blob.includes('airport pick drop') || compact.includes('pickdrop')) {
    return true
  }
  if (compact.includes('공항샌딩') || blob.includes('airport sending') || blob.includes('airport drop-off') || blob.includes('airport dropoff')) {
    return true
  }
  if (
    (compact.includes('8주년') || blob.includes('8th anniversary') || blob.includes('8th-anniversary')) &&
    (compact.includes('공항픽업') || blob.includes('airport pickup') || blob.includes('airport pick-up'))
  ) {
    return true
  }
  return false
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
      if (productExcludedFromNoExpenseList(row)) {
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

async function fetchTourIdsHavingExpenses(
  supabase: SupabaseClient,
  tourIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  await fetchAllInChunks(tourIds, 200, async (chunk) => {
    const { data, error } = await supabase.from('tour_expenses').select('tour_id').in('tour_id', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: tour_expenses', error)
      return []
    }
    for (const row of data || []) {
      const tid = String((row as { tour_id?: string | null }).tour_id ?? '').trim()
      if (tid) out.add(tid)
    }
    return []
  })
  return out
}

const BALANCE_REMAINING_EPS = 0.009

function shouldSkipReservationBalance(status: string | null | undefined): boolean {
  return (
    isReservationCancelledStatus(status) ||
    isReservationDeletedStatus(status) ||
    isDateChangedReservationStatus(status)
  )
}

/** DB `balance_amount`만 — 실제 잔금 재계산 후보를 좁히기 위한 1차 조회 */
async function fetchStoredBalanceByReservationId(
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

/**
 * 배정 카드·가격 탭과 동일한 잔금.
 * DB `balance_amount`가 남아 있어도 입금(잔금 수령)으로 이미 0이면 0으로 본다.
 */
async function fetchDisplayBalanceByReservationId(
  supabase: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (reservationIds.length === 0) return map

  const reservations = await fetchAllInChunks(reservationIds, 200, async (chunk) => {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, status, adults, child, infant')
      .in('id', chunk)
    if (error) {
      logFollowUpError('schedulePastTourFollowUp: balance reservations', error)
      return []
    }
    return (data || []) as AssignedBalanceReservationInput[]
  })

  const reservationById = new Map<string, AssignedBalanceReservationInput>()
  const activeIds: string[] = []
  for (const row of reservations) {
    const id = String(row.id ?? '').trim()
    if (!id) continue
    if (shouldSkipReservationBalance(row.status)) {
      map.set(id, 0)
      continue
    }
    reservationById.set(id, { ...row, id })
    activeIds.push(id)
  }

  if (activeIds.length === 0) return map

  const [pricingRows, payRows, optRows, custRows] = await Promise.all([
    fetchAllInChunks(activeIds, 200, async (chunk) => {
      const { data, error } = await supabase.from('reservation_pricing').select('*').in('reservation_id', chunk)
      if (error) {
        logFollowUpError('schedulePastTourFollowUp: display pricing', error)
        return []
      }
      return data || []
    }),
    fetchAllInChunks(activeIds, 200, async (chunk) => {
      const { data, error } = await supabase
        .from('payment_records')
        .select('reservation_id, payment_status, amount')
        .in('reservation_id', chunk)
      if (error) {
        logFollowUpError('schedulePastTourFollowUp: display payments', error)
        return []
      }
      return data || []
    }),
    fetchAllInChunks(activeIds, 200, async (chunk) => {
      const { data, error } = await supabase
        .from('reservation_options')
        .select('reservation_id, total_price, option_id, status')
        .in('reservation_id', chunk)
      if (error) {
        logFollowUpError('schedulePastTourFollowUp: display options', error)
        return []
      }
      return data || []
    }),
    fetchAllInChunks(activeIds, 200, async (chunk) => {
      const { data, error } = await supabase
        .from('reservation_customers')
        .select('reservation_id, resident_status')
        .in('reservation_id', chunk)
      if (error) {
        logFollowUpError('schedulePastTourFollowUp: display customers', error)
        return []
      }
      return data || []
    }),
  ])

  const pricingById = new Map<string, Record<string, unknown>>()
  for (const row of pricingRows) {
    const id = String((row as { reservation_id: string }).reservation_id).trim()
    if (id) pricingById.set(id, row as Record<string, unknown>)
  }

  const paymentsById = new Map<string, PaymentRecordLike[]>()
  for (const row of payRows) {
    const id = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
    if (!id) continue
    const list = paymentsById.get(id) || []
    list.push({
      payment_status: String((row as { payment_status?: string | null }).payment_status || ''),
      amount: Number((row as { amount?: unknown }).amount) || 0,
    })
    paymentsById.set(id, list)
  }

  const optionsById = new Map<string, AssignedBalanceOptionRow[]>()
  for (const row of optRows) {
    const id = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
    if (!id) continue
    const list = optionsById.get(id) || []
    list.push(row as AssignedBalanceOptionRow)
    optionsById.set(id, list)
  }

  const customersById = new Map<string, Array<{ resident_status?: string | null }>>()
  for (const row of custRows) {
    const id = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
    if (!id) continue
    const list = customersById.get(id) || []
    list.push({
      resident_status: (row as { resident_status?: string | null }).resident_status ?? null,
    })
    customersById.set(id, list)
  }

  for (const id of activeIds) {
    const reservation = reservationById.get(id)
    const pricing = pricingById.get(id)
    if (!reservation || !pricing) {
      map.set(id, 0)
      continue
    }
    map.set(
      id,
      computeAssignedReservationDisplayBalance({
        reservation,
        pricing,
        paymentRecords: paymentsById.get(id) || [],
        optionRows: optionsById.get(id) || [],
        customerRows: customersById.get(id) || [],
      })
    )
  }

  return map
}

function tourBalanceTotal(
  reservationIdsRaw: unknown,
  balanceByReservation: Map<string, number>
): number {
  let sum = 0
  for (const id of normalizeReservationIds(reservationIdsRaw)) {
    const amount = balanceByReservation.get(String(id).trim()) ?? 0
    if (amount > BALANCE_REMAINING_EPS) sum += amount
  }
  return sum
}

function toFollowUpRow(
  t: RawPastTour,
  productLabel: Map<string, string>,
  teamMap: Map<string, string>,
  balanceTotal = 0,
  hasExpense = false
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
    has_expense: hasExpense,
  }
}

/**
 * 오늘 이전(당일 제외) 투어 중 지출 없음 / 잔금 남음 목록.
 * 잔금은 배정 카드·가격 탭과 동일하게 입금 내역을 반영하며, 취소·삭제·날짜변경 예약은 제외한다.
 */
export async function fetchSchedulePastTourFollowUp(supabase: SupabaseClient): Promise<{
  missingReceipts: SchedulePastFollowUpTour[]
  missingReceiptsHidden: SchedulePastFollowUpTour[]
  balanceRemaining: SchedulePastFollowUpTour[]
}> {
  const today = todayYmdLv()
  const startYmd = dayjs.tz(today, LV_TZ).subtract(SCHEDULE_PAST_FOLLOW_UP_LOOKBACK_DAYS, 'day').format('YYYY-MM-DD')
  const pastTours = await fetchPastToursInWindow(supabase, startYmd, today)
  if (pastTours.length === 0) {
    return { missingReceipts: [], missingReceiptsHidden: [], balanceRemaining: [] }
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
  const tourIdsWithExpense = await fetchTourIdsHavingExpenses(supabase, tourIds)

  const allReservationIds = new Set<string>()
  for (const t of visible) {
    for (const rid of normalizeReservationIds(t.reservation_ids)) {
      allReservationIds.add(String(rid).trim())
    }
  }
  const storedBalanceByReservation = await fetchStoredBalanceByReservationId(supabase, [...allReservationIds])
  const candidateIds = [...allReservationIds].filter(
    (id) => (storedBalanceByReservation.get(id) ?? 0) > BALANCE_REMAINING_EPS
  )
  const balanceByReservation = await fetchDisplayBalanceByReservationId(supabase, candidateIds)

  const missingReceipts: SchedulePastFollowUpTour[] = []
  const missingReceiptsHidden: SchedulePastFollowUpTour[] = []
  const balanceRemaining: SchedulePastFollowUpTour[] = []

  for (const t of visible) {
    const tid = String(t.id).trim()
    const pid = t.product_id != null ? String(t.product_id).trim() : ''
    const guideAssigned = String(t.tour_guide_id ?? '').trim().length > 0
    const receiptNotRequired = Boolean(t.receipt_not_required)
    const excludedProduct = pid !== '' && excludedNoReceiptIds.has(pid)
    const hasExpense = tourIdsWithExpense.has(tid)
    const balanceTotal = tourBalanceTotal(t.reservation_ids, balanceByReservation)

    if (guideAssigned && !excludedProduct && !hasExpense) {
      const row = toFollowUpRow(t, labelById, teamMap, balanceTotal, hasExpense)
      if (receiptNotRequired) missingReceiptsHidden.push(row)
      else missingReceipts.push(row)
    }
    if (balanceTotal > BALANCE_REMAINING_EPS) {
      balanceRemaining.push(toFollowUpRow(t, labelById, teamMap, balanceTotal, hasExpense))
    }
  }

  const sortDesc = (a: SchedulePastFollowUpTour, b: SchedulePastFollowUpTour) =>
    (b.tour_date || '').localeCompare(a.tour_date || '')
  missingReceipts.sort(sortDesc)
  missingReceiptsHidden.sort(sortDesc)
  balanceRemaining.sort(sortDesc)

  return { missingReceipts, missingReceiptsHidden, balanceRemaining }
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

export async function markTourReceiptRequired(
  supabase: SupabaseClient,
  tourId: string
): Promise<{ error: string | null }> {
  const tid = String(tourId).trim()
  if (!tid) return { error: 'Missing tour id' }
  const { error } = await supabase
    .from('tours')
    .update({
      receipt_not_required: false,
      receipt_not_required_at: null,
      receipt_not_required_by: null,
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

  const storedBalanceMap = await fetchStoredBalanceByReservationId(supabase, reservationIds)
  const candidateIds = reservationIds.filter((id) => (storedBalanceMap.get(id) ?? 0) > BALANCE_REMAINING_EPS)
  const balanceMap = await fetchDisplayBalanceByReservationId(supabase, candidateIds)

  const { data: reservRows, error: reservErr } = await supabase
    .from('reservations')
    .select('id, customer_id, channel_rn, total_people, adults, child, infant, status')
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
    if (shouldSkipReservationBalance((row as { status?: string | null }).status)) continue
    const bal = balanceMap.get(rid) ?? 0
    if (bal <= BALANCE_REMAINING_EPS) continue
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
