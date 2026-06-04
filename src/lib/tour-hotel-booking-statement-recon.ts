import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TICKET_BOOKING_STATEMENT_DAY_WINDOW,
  type ExpenseStatementReconContext,
} from '@/lib/expense-reconciliation-similar-lines'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  resolveFinancialAccountIdForPaymentMethodKey,
  type TicketBookingStatementReconDisplay,
} from '@/lib/ticket-booking-statement-recon'

export type TourHotelBookingStatementReconDisplay = TicketBookingStatementReconDisplay

const MATCH_CHUNK = 200
const LINE_CHUNK = 80

function isDuplicateStatementReconEntry(
  list: TourHotelBookingStatementReconDisplay[],
  entry: TourHotelBookingStatementReconDisplay
): boolean {
  const mid = String(entry.match_id ?? '').trim()
  if (mid) {
    return list.some((x) => String(x.match_id ?? '').trim() === mid)
  }
  return list.some(
    (x) =>
      !String(x.match_id ?? '').trim() &&
      x.statement_line_id === entry.statement_line_id
  )
}

/** 투어 호텔 부킹별 연결된 명세 줄 — 테이블 뷰 표시용 */
export async function fetchTourHotelBookingStatementReconDisplayByBookingId(
  supabase: SupabaseClient,
  bookingIds: string[]
): Promise<Map<string, TourHotelBookingStatementReconDisplay[]>> {
  const out = new Map<string, TourHotelBookingStatementReconDisplay[]>()
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
      .eq('source_table', 'tour_hotel_bookings')
      .in('source_id', chunk)
    if (error) throw error
    for (const row of (data || []) as MatchRow[]) {
      const sid = String(row.source_id ?? '').trim()
      const lid = String(row.statement_line_id ?? '').trim()
      if (sid && lid) matches.push(row)
    }
  }

  if (matches.length === 0) return out

  const lineIds = [...new Set(matches.map((m) => m.statement_line_id))]
  type LineRow = {
    id: string
    amount: number | string | null
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
      .select('id, amount, posted_date, description, merchant, statement_import_id')
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
  ): Omit<TourHotelBookingStatementReconDisplay, 'match_id' | 'statement_line_id'> | null => {
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
      matched_amount: alloc,
      description,
    }
  }

  for (const m of matches) {
    const disp = toDisplay(m.statement_line_id, m.matched_amount)
    if (!disp) continue
    const list = out.get(m.source_id) ?? []
    const entry: TourHotelBookingStatementReconDisplay = {
      match_id: m.id || null,
      statement_line_id: m.statement_line_id,
      ...disp,
    }
    if (!isDuplicateStatementReconEntry(list, entry)) {
      list.push(entry)
    }
    out.set(m.source_id, list)
  }

  return out
}

export type TourHotelBookingStatementReconSource = {
  id: string
  submit_on?: string | null
  check_in_date?: string | null
  event_date?: string | null
  total_price?: number | null
  payment_method?: string | null
}

function hotelBookingStatementDateYmd(booking: TourHotelBookingStatementReconSource): string {
  for (const raw of [booking.check_in_date, booking.submit_on, booking.event_date]) {
    const ymd = raw ? String(raw).slice(0, 10) : ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  }
  return ''
}

export function buildTourHotelBookingStatementReconContext(
  booking: TourHotelBookingStatementReconSource,
  financialAccountId?: string | null
): ExpenseStatementReconContext | null {
  const dateYmd = hotelBookingStatementDateYmd(booking)
  if (!dateYmd) return null
  const amt = Math.abs(Number(booking.total_price ?? 0))
  if (amt <= 0) return null
  const ctx: ExpenseStatementReconContext = {
    sourceTable: 'tour_hotel_bookings',
    sourceId: booking.id,
    dateYmd,
    amount: amt,
    direction: 'outflow',
    ticketBookingDateProbe: {
      submitYmd: booking.submit_on ? String(booking.submit_on).slice(0, 10) : null,
      checkInYmd: booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : null,
      dayWindow: TICKET_BOOKING_STATEMENT_DAY_WINDOW,
      financialAccountId: financialAccountId ?? null,
    },
  }
  return ctx
}

export function isTourHotelBookingStatementReconDisabled(
  booking: TourHotelBookingStatementReconSource
): boolean {
  const dateYmd = hotelBookingStatementDateYmd(booking)
  const amt = Math.abs(Number(booking.total_price ?? 0))
  return !dateYmd || amt <= 0
}

export async function buildTourHotelBookingStatementReconContextResolved(
  supabase: SupabaseClient,
  booking: TourHotelBookingStatementReconSource
): Promise<ExpenseStatementReconContext | null> {
  const faId = await resolveFinancialAccountIdForPaymentMethodKey(supabase, booking.payment_method)
  return buildTourHotelBookingStatementReconContext(booking, faId)
}
