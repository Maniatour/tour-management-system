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
