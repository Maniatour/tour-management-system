export type CashLedgerSource =
  | 'cash_transactions'
  | 'payment_records'
  | 'company_expenses'
  | 'reservation_expenses'

const SOURCE_ORDER: Record<CashLedgerSource, number> = {
  cash_transactions: 0,
  payment_records: 1,
  company_expenses: 2,
  reservation_expenses: 3,
}

export function cashLedgerTimeMs(value: string | null | undefined): number {
  const t = Date.parse(value ?? '')
  return Number.isFinite(t) ? t : 0
}

/** 현금 원장 시간순(오래된 것 먼저). 잔액 누적과 날짜 정렬이 같은 순서를 쓰도록 합니다. */
export function compareCashLedgerChronology(
  a: {
    occurredAt: string
    createdAt?: string | null | undefined
    source?: string | undefined
    id: string
  },
  b: {
    occurredAt: string
    createdAt?: string | null | undefined
    source?: string | undefined
    id: string
  }
): number {
  const occurred = cashLedgerTimeMs(a.occurredAt) - cashLedgerTimeMs(b.occurredAt)
  if (occurred !== 0) return occurred
  const created = cashLedgerTimeMs(a.createdAt) - cashLedgerTimeMs(b.createdAt)
  if (created !== 0) return created
  const sa = SOURCE_ORDER[a.source as CashLedgerSource] ?? 99
  const sb = SOURCE_ORDER[b.source as CashLedgerSource] ?? 99
  if (sa !== sb) return sa - sb
  return a.id.localeCompare(b.id)
}
