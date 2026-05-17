/** 환급 추적용 — DB `reimbursed_amount` 및 미환급 잔액 계산 */

export function parseReimbursedAmount(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function reimbursementOutstanding(amount: unknown, reimbursed: unknown): number {
  const a = typeof amount === 'number' ? amount : parseFloat(String(amount ?? 0))
  const amt = Number.isFinite(a) ? a : 0
  const r = parseReimbursedAmount(reimbursed)
  return Math.max(0, amt - r)
}

/** 지출 폼 「환급 내용이 있음」이 켜진 경우와 동일 — 환급·일자·메모 중 하나라도 있을 때 */
export function expenseHasReimbursementTracking(expense: {
  reimbursed_amount?: unknown
  reimbursed_on?: string | null
  reimbursement_note?: string | null
}): boolean {
  return (
    parseReimbursedAmount(expense.reimbursed_amount) > 0.009 ||
    Boolean(String(expense.reimbursed_on ?? '').trim()) ||
    Boolean(String(expense.reimbursement_note ?? '').trim())
  )
}
