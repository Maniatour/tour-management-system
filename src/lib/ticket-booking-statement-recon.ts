import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TICKET_BOOKING_STATEMENT_DAY_WINDOW,
  type ExpenseStatementReconContext,
} from '@/lib/expense-reconciliation-similar-lines'

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
