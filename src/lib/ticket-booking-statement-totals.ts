import type { TicketBookingStatementReconDisplay } from '@/lib/ticket-booking-statement-recon'

/** 부킹 명세 합계 vs 비용 비교 허용 오차(USD) */
export const BOOKING_STATEMENT_AMOUNT_EPS = 0.02

export type BookingStatementTotals = {
  /** 연결 명세 출금(지출) 합 — 배정 금액 우선 */
  outflowSum: number
  /** 연결 명세 입금 합 */
  inflowSum: number
  /** 출금 − 입금 (명세 순합) */
  netSum: number
}

export function isStatementLineInflow(line: { direction?: string | null }): boolean {
  const d = String(line.direction ?? '').trim().toLowerCase()
  return d === 'inflow' || d === 'credit' || d === 'deposit'
}

/** 이 부킹에 배정된 명세 금액(USD, 절대값) */
export function lineStatementAllocatedUsd(line: TicketBookingStatementReconDisplay): number {
  const raw = line.matched_amount != null ? line.matched_amount : line.amount
  const n = Math.abs(Number(raw ?? 0))
  return Number.isFinite(n) ? n : 0
}

/** 지출(출금) − 입금 = 명세 합계 */
export function computeBookingStatementTotals(
  lines: TicketBookingStatementReconDisplay[]
): BookingStatementTotals {
  let outflowSum = 0
  let inflowSum = 0
  for (const line of lines) {
    const amt = lineStatementAllocatedUsd(line)
    if (isStatementLineInflow(line)) inflowSum += amt
    else outflowSum += amt
  }
  const netSum = Math.round((outflowSum - inflowSum) * 100) / 100
  return {
    outflowSum: Math.round(outflowSum * 100) / 100,
    inflowSum: Math.round(inflowSum * 100) / 100,
    netSum,
  }
}

export function bookingStatementMatchesExpense(
  totals: BookingStatementTotals,
  bookingExpense: number | null | undefined,
  eps = BOOKING_STATEMENT_AMOUNT_EPS
): boolean {
  const expense = Math.abs(Number(bookingExpense ?? 0))
  if (!Number.isFinite(expense)) return totals.netSum === 0
  return Math.abs(totals.netSum - expense) <= eps
}
