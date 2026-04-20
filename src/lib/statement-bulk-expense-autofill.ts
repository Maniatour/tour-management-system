/** 명세 줄 설명 → 회사 지출 paid_for·category 채우기 (규칙 + 과거 지출 설명 유사도) */

export type StatementAutofillRuleRow = {
  id: string
  financial_account_id: string | null
  pattern: string
  match_mode: 'contains' | 'startswith'
  paid_to: string
  paid_for: string
  category: string
  priority: number
  source: 'template' | 'learned'
}

export type CompanyExpenseHistoryHint = {
  norm: string
  paid_to: string
  paid_for: string
  category: string
}

export function collapseWhitespaceLower(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function statementLineMatchText(description: string | null, merchant: string | null): string {
  const d = (description ?? '').trim()
  const m = (merchant ?? '').trim()
  if (d && m) return collapseWhitespaceLower(`${m} ${d}`)
  return collapseWhitespaceLower(d || m || '')
}

/** 과거 지출 description 정규화 (너무 짧으면 매칭 후보에서 제외) */
export function normalizeExpenseDescriptionForMatch(desc: string | null | undefined): string | null {
  const t = collapseWhitespaceLower(String(desc ?? ''))
  if (t.length < 5) return null
  return t.length > 160 ? t.slice(0, 160) : t
}

export function pickRuleForLine(
  rules: StatementAutofillRuleRow[],
  financialAccountId: string,
  lineHaystack: string
): StatementAutofillRuleRow | null {
  const hay = lineHaystack
  if (!hay) return null

  const scoped = rules.filter(
    (r) => !r.financial_account_id || r.financial_account_id === financialAccountId
  )
  const sorted = [...scoped].sort((a, b) => {
    const aAcc = a.financial_account_id === financialAccountId ? 1 : 0
    const bAcc = b.financial_account_id === financialAccountId ? 1 : 0
    if (aAcc !== bAcc) return bAcc - aAcc
    if (b.priority !== a.priority) return b.priority - a.priority
    return b.pattern.length - a.pattern.length
  })

  for (const r of sorted) {
    const p = collapseWhitespaceLower(r.pattern)
    if (p.length < 2) continue
    if (r.match_mode === 'startswith') {
      if (hay.startsWith(p)) return r
    } else if (hay.includes(p)) {
      return r
    }
  }
  return null
}

/** 명세 문자열에 포함된 과거 설명이 가장 긴 행을 선택 (퀵북식 “이전 거래 기억”) */
export function pickHistoryHintForLine(
  lineHaystack: string,
  history: CompanyExpenseHistoryHint[]
): CompanyExpenseHistoryHint | null {
  if (!lineHaystack) return null
  let best: CompanyExpenseHistoryHint | null = null
  let bestLen = 0
  for (const h of history) {
    const n = h.norm
    if (n.length < 5) continue
    if (lineHaystack.includes(n) && n.length > bestLen) {
      best = h
      bestLen = n.length
    }
  }
  return best
}
