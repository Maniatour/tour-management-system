import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TICKET_BOOKING_STATEMENT_DAY_WINDOW,
  type ExpenseStatementReconContext,
} from '@/lib/expense-reconciliation-similar-lines'
import { formatStatementLineDescription } from '@/lib/statement-display'

export type TicketBookingStatementReconDisplay = {
  match_id: string | null
  statement_line_id: string
  financial_account_name: string
  posted_date: string
  /** 명세 줄 거래 금액(표시는 절대값, 부호는 direction으로 판단) */
  amount: number
  /** 입·출금 방향 — 입금(inflow)은 리펀 등 차감 표시용 */
  direction: string
  /** 이 부킹에 배정된 금액 — 분할 연결 시 명세 금액과 다를 수 있음 */
  matched_amount: number | null
  description: string
}

const MATCH_CHUNK = 200
const LINE_CHUNK = 80

/** 입장권 부킹별 연결된 명세 줄(대조됨) — 상세 모달 표시용 */
export async function fetchTicketBookingStatementReconDisplayByBookingId(
  supabase: SupabaseClient,
  bookingIds: string[]
): Promise<Map<string, TicketBookingStatementReconDisplay[]>> {
  const out = new Map<string, TicketBookingStatementReconDisplay[]>()
  const ids = [...new Set(bookingIds.filter(Boolean))]
  if (ids.length === 0) return out

  type MatchRow = {
    id: string
    source_id: string
    statement_line_id: string
    matched_amount: number | string | null
  }
  const matches: MatchRow[] = []

  for (let i = 0; i < ids.length; i += MATCH_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_CHUNK)
    const { data, error } = await supabase
      .from('reconciliation_matches')
      .select('id, source_id, statement_line_id, matched_amount')
      .eq('source_table', 'ticket_bookings')
      .in('source_id', chunk)
    if (error) throw error
    for (const row of (data || []) as MatchRow[]) {
      const mid = String(row.id ?? '').trim()
      const sid = String(row.source_id ?? '').trim()
      const lid = String(row.statement_line_id ?? '').trim()
      if (sid && lid) matches.push(row)
    }
  }

  const legacyLineByBooking = new Map<string, string>()
  for (let i = 0; i < ids.length; i += MATCH_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_CHUNK)
    const { data } = await supabase
      .from('ticket_bookings')
      .select('id, statement_line_id')
      .in('id', chunk)
      .not('statement_line_id', 'is', null)
    for (const row of (data || []) as { id: string; statement_line_id: string | null }[]) {
      const lid = String(row.statement_line_id ?? '').trim()
      if (row.id && lid && !matches.some((m) => m.source_id === row.id && m.statement_line_id === lid)) {
        matches.push({ id: '', source_id: row.id, statement_line_id: lid, matched_amount: null })
      }
      if (row.id && lid) legacyLineByBooking.set(row.id, lid)
    }
  }

  if (matches.length === 0) return out

  const lineIds = [...new Set(matches.map((m) => m.statement_line_id))]
  type LineRow = {
    id: string
    amount: number | string | null
    direction: string | null
    posted_date: string | null
    description: string | null
    merchant: string | null
    statement_import_id: string | null
  }
  const lineById = new Map<string, LineRow>()
  for (let i = 0; i < lineIds.length; i += LINE_CHUNK) {
    const chunk = lineIds.slice(i, i + LINE_CHUNK)
    const { data, error } = await supabase
      .from('statement_lines')
      .select('id, amount, direction, posted_date, description, merchant, statement_import_id')
      .in('id', chunk)
    if (error) throw error
    for (const line of (data || []) as LineRow[]) {
      if (line.id) lineById.set(line.id, line)
    }
  }

  const importIds = [
    ...new Set(
      [...lineById.values()]
        .map((l) => String(l.statement_import_id ?? '').trim())
        .filter(Boolean)
    ),
  ]
  const importToAccountId = new Map<string, string>()
  for (let i = 0; i < importIds.length; i += LINE_CHUNK) {
    const chunk = importIds.slice(i, i + LINE_CHUNK)
    const { data } = await supabase
      .from('statement_imports')
      .select('id, financial_account_id')
      .in('id', chunk)
    for (const im of (data || []) as { id: string; financial_account_id: string | null }[]) {
      if (im.id && im.financial_account_id) importToAccountId.set(im.id, String(im.financial_account_id))
    }
  }

  const accountIds = [...new Set([...importToAccountId.values()])]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += LINE_CHUNK) {
    const chunk = accountIds.slice(i, i + LINE_CHUNK)
    const { data } = await supabase.from('financial_accounts').select('id, name').in('id', chunk)
    for (const a of (data || []) as { id: string; name: string | null }[]) {
      if (a.id) accountNameById.set(a.id, String(a.name ?? '').trim() || a.id)
    }
  }

  const parseMatchedAmount = (raw: number | string | null | undefined): number | null => {
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? Math.abs(n) : null
  }

  const toDisplay = (
    lineId: string,
    matchedAmount: number | string | null | undefined
  ): Omit<TicketBookingStatementReconDisplay, 'match_id' | 'statement_line_id'> | null => {
    const line = lineById.get(lineId)
    if (!line) return null
    const importId = String(line.statement_import_id ?? '').trim()
    const accountId = importId ? importToAccountId.get(importId) : undefined
    const accountName = accountId ? accountNameById.get(accountId) || accountId : '—'
    const posted = String(line.posted_date ?? '').slice(0, 10) || '—'
    const description = formatStatementLineDescription(line.description, line.merchant) || '—'
    const lineAmt = Math.abs(Number(line.amount ?? 0))
    const alloc = parseMatchedAmount(matchedAmount)
    return {
      financial_account_name: accountName,
      posted_date: posted,
      amount: Number.isFinite(lineAmt) ? lineAmt : 0,
      direction: String(line.direction ?? '').trim(),
      matched_amount: alloc,
      description,
    }
  }

  for (const m of matches) {
    const disp = toDisplay(m.statement_line_id, m.matched_amount)
    if (!disp) continue
    const list = out.get(m.source_id) ?? []
    const entry: TicketBookingStatementReconDisplay = {
      match_id: m.id || null,
      statement_line_id: m.statement_line_id,
      ...disp,
    }
    if (
      !list.some(
        (x) =>
          (entry.match_id && x.match_id === entry.match_id) ||
          x.statement_line_id === entry.statement_line_id
      )
    ) {
      list.push(entry)
    }
    out.set(m.source_id, list)
  }

  return out
}

export type TicketBookingStatementReconSource = {
  id: string
  submit_on?: string | null
  check_in_date?: string | null
  expense?: number | null
  payment_method?: string | null
}

/** 결제방법(id 또는 method 코드)에 연결된 금융 계정 id — 모두 같을 때만 반환 */
export async function resolveFinancialAccountIdForPaymentMethodKey(
  supabase: SupabaseClient,
  paymentMethodKey: string | null | undefined
): Promise<string | null> {
  const key = String(paymentMethodKey ?? '').trim()
  if (!key) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    const { data } = await supabase
      .from('payment_methods')
      .select('financial_account_id')
      .eq('id', key)
      .maybeSingle()
    const fa = (data as { financial_account_id?: string | null } | null)?.financial_account_id
    return fa ? String(fa) : null
  }

  const { data: rows } = await supabase
    .from('payment_methods')
    .select('financial_account_id')
    .eq('method', key)
    .not('financial_account_id', 'is', null)
    .limit(40)

  const ids = new Set(
    ((rows || []) as { financial_account_id?: string | null }[])
      .map((r) => String(r.financial_account_id ?? '').trim())
      .filter(Boolean)
  )
  if (ids.size === 1) return [...ids][0]!
  return null
}

export function buildTicketBookingStatementReconContext(
  booking: TicketBookingStatementReconSource,
  financialAccountId?: string | null
): ExpenseStatementReconContext | null {
  const submitYmd = booking.submit_on ? String(booking.submit_on).slice(0, 10) : ''
  const checkInYmd = booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : ''
  const hasSubmit = /^\d{4}-\d{2}-\d{2}$/.test(submitYmd)
  const hasCheckIn = /^\d{4}-\d{2}-\d{2}$/.test(checkInYmd)
  if (!hasSubmit && !hasCheckIn) return null

  const amt = Math.abs(Number(booking.expense ?? 0))

  return {
    sourceTable: 'ticket_bookings',
    sourceId: booking.id,
    dateYmd: (hasCheckIn ? checkInYmd : submitYmd) || submitYmd,
    amount: amt > 0 ? amt : 0,
    direction: 'outflow',
    ticketBookingDateProbe: {
      submitYmd: hasSubmit ? submitYmd : null,
      checkInYmd: hasCheckIn ? checkInYmd : null,
      dayWindow: TICKET_BOOKING_STATEMENT_DAY_WINDOW,
      financialAccountId: financialAccountId ?? null,
    },
  }
}

export function isTicketBookingStatementReconDisabled(booking: TicketBookingStatementReconSource): boolean {
  const submitYmd = booking.submit_on ? String(booking.submit_on).slice(0, 10) : ''
  const checkInYmd = booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : ''
  return !/^\d{4}-\d{2}-\d{2}$/.test(submitYmd) && !/^\d{4}-\d{2}-\d{2}$/.test(checkInYmd)
}

export async function buildTicketBookingStatementReconContextResolved(
  supabase: SupabaseClient,
  booking: TicketBookingStatementReconSource
): Promise<ExpenseStatementReconContext | null> {
  const faId = await resolveFinancialAccountIdForPaymentMethodKey(supabase, booking.payment_method)
  return buildTicketBookingStatementReconContext(booking, faId)
}
