import { supabase } from '@/lib/supabase'
import {
  hotelAmountForSettlement,
  isHotelBookingActiveForReports,
  isTicketBookingIncludedInSettlement,
} from '@/lib/bookingSettlement'
import { formatStatementLineDescription } from '@/lib/statement-display'
import { fetchAllSupabasePages } from '@/lib/supabasePaginatedFetch'

/** 통합 PNL·expense_category_mappings.original_value (tour_hotel_bookings 공통 키) */
export const PNL_TOUR_HOTEL_BOOKING_MAPPING_ORIGINAL = 'Tour hotel booking'

/** Antelope Canyon admission (tour COGS leaf) */
export const PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID = 'CAT024-003'

export type PnlPaymentRecordRow = {
  id: string
  amount: unknown
  payment_status: string | null
  payment_method: string | null
  reservation_id: string
  submit_on: string | null
  note: string | null
  submit_by: string | null
}

const PAYMENT_RECORD_SELECT =
  'id, amount, payment_status, payment_method, reservation_id, submit_on, note, submit_by'

/** 통합 PNL 입금: 기간 내 payment_records 전부 (PostgREST 1000행 제한 순회) */
export async function fetchPaymentRecordsForPnlReport(startISO: string, endISO: string) {
  const { data, error } = await fetchAllSupabasePages<PnlPaymentRecordRow>((from, to) =>
    supabase
      .from('payment_records')
      .select(PAYMENT_RECORD_SELECT)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlPaymentRecordRow[], error }
  const byId = new Map<string, PnlPaymentRecordRow>()
  for (const r of data) byId.set(r.id, r)
  return { data: [...byId.values()], error: null }
}

export type PnlTourExpenseRow = {
  id: string
  amount: unknown
  paid_for: string | null
  paid_to: string | null
  note: string | null
  payment_method: string | null
  exclude_from_pnl: boolean | null
  tour_date?: string | null
  tour_id?: string | null
  submit_on: string | null
  created_at: string | null
}

export type PnlCompanyExpenseRow = {
  id: string
  amount: unknown
  paid_for: string | null
  category: string | null
  standard_paid_for: string | null
  expense_type: string | null
  paid_to: string | null
  notes: string | null
  description: string | null
  payment_method: string | null
  exclude_from_pnl: boolean | null
  accounting_period?: string | null
  submit_on: string | null
  created_at: string | null
}

export type PnlTicketBookingRow = {
  id: string
  expense: unknown
  category: string | null
  company: string | null
  note: string | null
  payment_method: string | null
  status?: string | null
  check_in_date?: string | null
  tour_id?: string | null
  reservation_id?: string | null
  rn_number?: string | null
  submit_on: string | null
  created_at: string | null
}

export type PnlTourHotelBookingRow = {
  id: string
  total_price: unknown
  unit_price: unknown
  rooms: unknown
  hotel: string | null
  reservation_name: string | null
  payment_method: string | null
  status: string | null
  check_in_date?: string | null
  tour_id?: string | null
  submit_on: string | null
  created_at: string | null
}

export type PnlReservationExpenseRow = {
  id: string
  amount: unknown
  paid_for: string | null
  paid_to: string | null
  note: string | null
  payment_method: string | null
  exclude_from_pnl: boolean | null
  reservation_id?: string | null
  tour_id?: string | null
  tour_date?: string | null
  submit_on: string | null
  created_at: string | null
}

export async function fetchTourExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlTourExpenseRow>((from, to) =>
    supabase
      .from('tour_expenses')
      .select(
        'id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, tour_date, tour_id, submit_on, created_at'
      )
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

/** 통합 PNL COGS 투어지출: tour_date 기준 */
export async function fetchTourExpensesForPnlByTourDate(startYmd: string, endYmd: string) {
  return fetchAllSupabasePages<PnlTourExpenseRow>((from, to) =>
    supabase
      .from('tour_expenses')
      .select(
        'id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, tour_date, tour_id, submit_on, created_at'
      )
      .is('deleted_at', null)
      .gte('tour_date', startYmd)
      .lte('tour_date', endYmd)
      .order('tour_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

export async function fetchReservationExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlReservationExpenseRow>((from, to) =>
    supabase
      .from('reservation_expenses')
      .select(
        'id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, reservation_id, tour_id, submit_on, created_at'
      )
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

/** 통합 PNL COGS 예약지출 — 연결 예약의 tour_date 기준 */
export async function fetchReservationExpensesForPnlByTourDate(startYmd: string, endYmd: string) {
  const { data: reservations, error: resErr } = await fetchAllSupabasePages<{
    id: string
    tour_date: string | null
  }>((from, to) =>
    supabase
      .from('reservations')
      .select('id, tour_date')
      .gte('tour_date', startYmd)
      .lte('tour_date', endYmd)
      .order('tour_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (resErr) return { data: [] as PnlReservationExpenseRow[], error: resErr }

  const tourDateByReservationId = new Map<string, string>()
  for (const r of reservations || []) {
    const ymd = String(r.tour_date ?? '').slice(0, 10)
    if (ymd) tourDateByReservationId.set(r.id, ymd)
  }
  const reservationIds = [...tourDateByReservationId.keys()]
  if (reservationIds.length === 0) return { data: [], error: null }

  const rows: PnlReservationExpenseRow[] = []
  for (let i = 0; i < reservationIds.length; i += 200) {
    const chunk = reservationIds.slice(i, i + 200)
    const { data, error } = await supabase
      .from('reservation_expenses')
      .select(
        'id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, reservation_id, tour_id, submit_on, created_at'
      )
      .is('deleted_at', null)
      .in('reservation_id', chunk)
    if (error) return { data: [] as PnlReservationExpenseRow[], error }
    for (const row of data || []) {
      const rid = String(row.reservation_id ?? '')
      const tourYmd = tourDateByReservationId.get(rid)
      if (!tourYmd) continue
      rows.push({ ...row, tour_date: tourYmd })
    }
  }
  return { data: rows, error: null }
}

export async function fetchCompanyExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlCompanyExpenseRow>((from, to) =>
    supabase
      .from('company_expenses')
      .select(
        'id, amount, paid_for, category, standard_paid_for, expense_type, paid_to, notes, description, payment_method, exclude_from_pnl, accounting_period, submit_on, created_at'
      )
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

/** 통합 PNL COGS 회사지출 — accounting_period(YYYY-MM) 문자열 범위 */
export async function fetchCompanyExpensesForPnlByAccountingPeriod(startYm: string, endYm: string) {
  return fetchAllSupabasePages<PnlCompanyExpenseRow>((from, to) =>
    supabase
      .from('company_expenses')
      .select(
        'id, amount, paid_for, category, standard_paid_for, expense_type, paid_to, notes, description, payment_method, exclude_from_pnl, accounting_period, submit_on, created_at'
      )
      .is('deleted_at', null)
      .gte('accounting_period', startYm)
      .lte('accounting_period', endYm)
      .order('accounting_period', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

/** 통합 PNL 입장권 — submit_on(등록일) 기준 */
export async function fetchTicketBookingsForPnlBySubmitOn(startISO: string, endISO: string) {
  const { data, error } = await fetchAllSupabasePages<PnlTicketBookingRow>((from, to) =>
    supabase
      .from('ticket_bookings')
      .select(
        'id, expense, category, company, note, payment_method, status, check_in_date, tour_id, reservation_id, rn_number, submit_on, created_at'
      )
      .is('deleted_at', null)
      .is('deletion_requested_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlTicketBookingRow[], error }
  const filtered = data.filter((r) => isTicketBookingIncludedInSettlement(r.status))
  return { data: filtered, error: null }
}

/** 통합 PNL COGS 입장권 — check_in_date(투어일) 기준. 취소만 제외 */
export async function fetchTicketBookingsForPnlByCheckIn(startYmd: string, endYmd: string) {
  const { data, error } = await fetchAllSupabasePages<PnlTicketBookingRow>((from, to) =>
    supabase
      .from('ticket_bookings')
      .select(
        'id, expense, category, company, note, payment_method, status, check_in_date, tour_id, reservation_id, rn_number, submit_on, created_at'
      )
      .is('deleted_at', null)
      .is('deletion_requested_at', null)
      .gte('check_in_date', startYmd)
      .lte('check_in_date', endYmd)
      .order('check_in_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlTicketBookingRow[], error }
  const filtered = data.filter((r) => isTicketBookingIncludedInSettlement(r.status))
  return { data: filtered, error: null }
}

/** 통합 PNL 지출: 기간 내 tour_hotel_bookings (등록일 submit_on) */
export async function fetchTourHotelBookingsForPnlReport(startISO: string, endISO: string) {
  const { data, error } = await fetchAllSupabasePages<PnlTourHotelBookingRow>((from, to) =>
    supabase
      .from('tour_hotel_bookings')
      .select(
        'id, total_price, unit_price, rooms, hotel, reservation_name, payment_method, status, check_in_date, tour_id, submit_on, created_at, deletion_requested_at'
      )
      .is('deletion_requested_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlTourHotelBookingRow[], error }
  const filtered = data.filter((r) => isHotelBookingActiveForReports(r))
  return { data: filtered, error: null }
}

/** 통합 PNL COGS 투어 호텔 — check_in_date(투어일) 기준 */
export async function fetchTourHotelBookingsForPnlByCheckIn(startYmd: string, endYmd: string) {
  const { data, error } = await fetchAllSupabasePages<PnlTourHotelBookingRow>((from, to) =>
    supabase
      .from('tour_hotel_bookings')
      .select(
        'id, total_price, unit_price, rooms, hotel, reservation_name, payment_method, status, check_in_date, tour_id, submit_on, created_at, deletion_requested_at'
      )
      .is('deletion_requested_at', null)
      .gte('check_in_date', startYmd)
      .lte('check_in_date', endYmd)
      .order('check_in_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlTourHotelBookingRow[], error }
  const filtered = data.filter((r) => isHotelBookingActiveForReports(r))
  return { data: filtered, error: null }
}

export function tourHotelBookingAmountForPnl(row: PnlTourHotelBookingRow): number {
  return hotelAmountForSettlement(row)
}

export type PnlStatementInflowRow = {
  id: string
  posted_date: string
  amount: unknown
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string | null
  exclude_from_pnl: boolean | null
  is_personal: boolean | null
  statement_import_id: string | null
}

export type PnlStatementInflowLine = {
  id: string
  yearMonth: string
  posted_date: string
  amount: number
  description: string
  matched_status: string | null
  financial_account_name: string | null
  exclude_from_pnl: boolean
  is_personal: boolean
  /** 명세 입금·참고 순익 집계 포함 여부 */
  pnlIncluded: boolean
}

/** 집계 제외 여부와 무관 — 기간·금액·방향만 맞는 inflow */
function isPnlStatementInflowEligible(r: PnlStatementInflowRow): boolean {
  if (r.direction !== 'inflow') return false
  const amt = Number(r.amount) || 0
  if (amt === 0) return false
  if (!yearMonthFromPostedDate(r.posted_date)) return false
  return true
}

/** 통합 PNL 참고 — 기간 내 명세 수입(입금) 줄 (posted_date 기준) */
export async function fetchStatementInflowsForPnlReport(startYmd: string, endYmd: string) {
  return fetchAllSupabasePages<PnlStatementInflowRow>((from, to) =>
    supabase
      .from('statement_lines')
      .select(
        'id, posted_date, amount, direction, description, merchant, matched_status, exclude_from_pnl, is_personal, statement_import_id'
      )
      .eq('direction', 'inflow')
      .gte('posted_date', startYmd)
      .lte('posted_date', endYmd)
      .order('posted_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

function isPnlStatementInflowIncluded(r: PnlStatementInflowRow): boolean {
  if (!isPnlStatementInflowEligible(r)) return false
  if (r.exclude_from_pnl) return false
  if (r.is_personal) return false
  return true
}

async function fetchFinancialAccountNameByImportId(
  importIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uniq = [...new Set(importIds.filter(Boolean))]
  if (uniq.length === 0) return out

  const importToAccount = new Map<string, string>()
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200)
    const { data, error } = await supabase
      .from('statement_imports')
      .select('id, financial_account_id')
      .in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const id = String((row as { id: string }).id ?? '').trim()
      const fa = String((row as { financial_account_id: string | null }).financial_account_id ?? '').trim()
      if (id && fa) importToAccount.set(id, fa)
    }
  }

  const accountIds = [...new Set(importToAccount.values())]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 200) {
    const chunk = accountIds.slice(i, i + 200)
    const { data, error } = await supabase.from('financial_accounts').select('id, name').in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const id = String((row as { id: string }).id ?? '').trim()
      const name = String((row as { name: string }).name ?? '').trim()
      if (id && name) accountNameById.set(id, name)
    }
  }

  for (const [importId, accountId] of importToAccount) {
    const name = accountNameById.get(accountId)
    if (name) out.set(importId, name)
  }
  return out
}

export function yearMonthFromPostedDate(postedDate: string): string {
  const ymd = String(postedDate ?? '').trim()
  if (ymd.length >= 7 && /^\d{4}-\d{2}/.test(ymd)) return ymd.slice(0, 7)
  return ''
}

/** 명세 입금 — exclude_from_pnl·개인(use) 제외, amount 합산 */
export function aggregatePnlStatementInflows(rows: PnlStatementInflowRow[]): {
  monthly: Record<string, number>
  total: number
  lineCount: number
} {
  const monthly: Record<string, number> = {}
  let total = 0
  let lineCount = 0
  for (const r of rows) {
    if (!isPnlStatementInflowIncluded(r)) continue
    const amt = Number(r.amount) || 0
    const ym = yearMonthFromPostedDate(r.posted_date)!
    monthly[ym] = (monthly[ym] || 0) + amt
    total += amt
    lineCount += 1
  }
  return { monthly, total, lineCount }
}

/** 명세 입금 상세 모달용 줄 (금융 계정명 해석 포함) */
export async function buildPnlStatementInflowDetailLines(
  rows: PnlStatementInflowRow[]
): Promise<PnlStatementInflowLine[]> {
  const eligible = rows.filter(isPnlStatementInflowEligible)
  const importIds = eligible
    .map((r) => r.statement_import_id)
    .filter((x): x is string => Boolean(x?.trim()))
  const accountByImport = await fetchFinancialAccountNameByImportId(importIds)

  const lines: PnlStatementInflowLine[] = []
  for (const r of eligible) {
    const amt = Number(r.amount) || 0
    const ym = yearMonthFromPostedDate(r.posted_date)!
    const importId = (r.statement_import_id || '').trim()
    const exclude = Boolean(r.exclude_from_pnl)
    const personal = Boolean(r.is_personal)
    lines.push({
      id: r.id,
      yearMonth: ym,
      posted_date: r.posted_date,
      amount: amt,
      description: formatStatementLineDescription(r.description, r.merchant),
      matched_status: r.matched_status,
      financial_account_name: importId ? accountByImport.get(importId) ?? null : null,
      exclude_from_pnl: exclude,
      is_personal: personal,
      pnlIncluded: !exclude && !personal,
    })
  }
  lines.sort((a, b) => {
    const d = a.posted_date.localeCompare(b.posted_date)
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })
  return lines
}
