/** 표준 결제내용(standard_paid_for) 미저장 지출의 paid_for 고유값 */
export function collectPaidForFromStandardUnsetExpenses(
  expenseSuggestions: { paid_for_standard_unset?: string[] } | null | undefined,
  expenses: ReadonlyArray<{ standard_paid_for?: string | null; paid_for?: string | null }>
): string[] {
  const s = new Set<string>()
  expenseSuggestions?.paid_for_standard_unset?.forEach((x) => {
    const t = x.trim()
    if (t) s.add(t)
  })
  for (const e of expenses) {
    if ((e.standard_paid_for ?? '').trim()) continue
    const pf = (e.paid_for ?? '').trim()
    if (pf) s.add(pf)
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
}
