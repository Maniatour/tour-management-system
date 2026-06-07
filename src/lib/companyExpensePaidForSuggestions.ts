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

function isStandardPaidForUnsetRow(standard_paid_for: string | null | undefined): boolean {
  return !(standard_paid_for ?? '').trim()
}

/** 목록 필터: 표준 결제내용 필터에 맞는 결제 내용(paid_for) 선택지 */
export function collectPaidForFilterOptions(args: {
  standardPaidForFilter: 'all' | 'set' | 'unset'
  expenseSuggestions: { paid_for?: string[]; paid_for_standard_unset?: string[] } | null | undefined
  expenses: ReadonlyArray<{ standard_paid_for?: string | null; paid_for?: string | null }>
}): string[] {
  const { standardPaidForFilter, expenseSuggestions, expenses } = args
  const s = new Set<string>()

  if (standardPaidForFilter === 'unset') {
    collectPaidForFromStandardUnsetExpenses(expenseSuggestions, expenses).forEach((x) => s.add(x))
  } else if (standardPaidForFilter === 'set') {
    for (const e of expenses) {
      if (isStandardPaidForUnsetRow(e.standard_paid_for)) continue
      const pf = (e.paid_for ?? '').trim()
      if (pf) s.add(pf)
    }
  } else {
    expenseSuggestions?.paid_for?.forEach((x) => {
      const t = x.trim()
      if (t) s.add(t)
    })
  }

  return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
}
