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

/**
 * `matched_amount`가 의미 있는 «분할» 배정 값인지 여부.
 * 0·null은 분할이 아니라 «명세 줄 전액»으로 간주합니다.
 * (예: 순비용 $0 부킹에 출금 줄을 연결하면 과거 로직이 0을 저장하던 케이스 교정)
 */
export function lineStatementHasMeaningfulAllocation(line: {
  matched_amount?: number | null
}): boolean {
  const m = line.matched_amount
  if (m == null) return false
  const n = Math.abs(Number(m))
  return Number.isFinite(n) && n > BOOKING_STATEMENT_AMOUNT_EPS
}

/** 이 부킹에 배정된 명세 금액(USD, 절대값) — 0/null 배정은 명세 줄 전액으로 폴백 */
export function lineStatementAllocatedUsd(line: TicketBookingStatementReconDisplay): number {
  const raw = lineStatementHasMeaningfulAllocation(line) ? line.matched_amount : line.amount
  const n = Math.abs(Number(raw ?? 0))
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

export type BookingStatementView = BookingStatementTotals & {
  /** lines 와 같은 순서의 줄별 표시 금액(USD, 절대값) */
  perLineUsd: number[]
}

/**
 * 부킹의 연결 명세 표시값 계산.
 *
 * - 환불(입금)이 없는 부킹: 저장된 배정값(분할 연결) 그대로 사용해 분할 워크플로우 유지.
 * - 환불(입금)이 «있는» 부킹: 환불은 부킹 순비용을 줄이므로, 출금은 «비용 + 입금합»까지
 *   채워 표시합니다. 각 출금 줄은 명세 줄 전액을 한도로 하며, 연결 순서 때문에
 *   matched_amount 가 작게 저장돼 있어도(예: 출금 $450 → 150만 저장) 표시는 교정됩니다.
 */
export function computeBookingStatementView(
  lines: TicketBookingStatementReconDisplay[],
  bookingExpenseUsd?: number | null
): BookingStatementView {
  const perLineUsd = new Array<number>(lines.length).fill(0)
  const inflowIdx: number[] = []
  const outflowIdx: number[] = []
  lines.forEach((line, i) => {
    if (isStatementLineInflow(line)) inflowIdx.push(i)
    else outflowIdx.push(i)
  })

  let inflowSum = 0
  for (const i of inflowIdx) {
    const a = lineStatementAllocatedUsd(lines[i]!)
    perLineUsd[i] = a
    inflowSum += a
  }
  inflowSum = round2(inflowSum)

  let outflowSum = 0
  if (inflowIdx.length > 0) {
    const expense = Math.abs(Number(bookingExpenseUsd ?? 0))
    let target = round2(Math.max(0, (Number.isFinite(expense) ? expense : 0) + inflowSum))
    for (const i of outflowIdx) {
      const cap = Math.abs(Number(lines[i]!.amount ?? 0))
      const give = round2(Math.min(Number.isFinite(cap) ? cap : 0, target))
      perLineUsd[i] = give
      outflowSum += give
      target = round2(Math.max(0, target - give))
    }
  } else {
    for (const i of outflowIdx) {
      const a = lineStatementAllocatedUsd(lines[i]!)
      perLineUsd[i] = a
      outflowSum += a
    }
  }
  outflowSum = round2(outflowSum)

  return {
    perLineUsd,
    outflowSum,
    inflowSum,
    netSum: round2(outflowSum - inflowSum),
  }
}

/** 지출(출금) − 입금 = 명세 합계 */
export function computeBookingStatementTotals(
  lines: TicketBookingStatementReconDisplay[],
  bookingExpenseUsd?: number | null
): BookingStatementTotals {
  const { outflowSum, inflowSum, netSum } = computeBookingStatementView(lines, bookingExpenseUsd)
  return { outflowSum, inflowSum, netSum }
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
