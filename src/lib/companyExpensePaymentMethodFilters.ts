export type PaymentMethodFilterRow = {
  /** 필터·API용 canonical key (`payment_methods.id` 또는 미매칭 레거시 문자열) */
  value: string
  count: number
}

type PmRow = {
  id: string
  method: string | null
}

/** 지출에 저장된 `payment_method` → 필터용 canonical key (id 우선, method 문자열은 id로 통합) */
export function canonicalizeCompanyExpensePaymentMethodKey(
  raw: string,
  pmById: Map<string, PmRow>,
  pmIdByMethod: Map<string, string>
): string {
  const t = raw.trim()
  if (!t) return ''
  if (pmById.has(t)) return t
  const id = pmIdByMethod.get(t)
  if (id) return id
  return t
}

export function buildPaymentMethodFilterRows(
  rawCounts: ReadonlyArray<{ payment_method: string; cnt: number }>,
  pmRows: ReadonlyArray<PmRow>
): PaymentMethodFilterRow[] {
  const pmById = new Map<string, PmRow>()
  const pmIdByMethod = new Map<string, string>()
  for (const pm of pmRows) {
    pmById.set(pm.id, pm)
    const m = (pm.method ?? '').trim()
    if (m && !pmIdByMethod.has(m)) pmIdByMethod.set(m, pm.id)
  }

  const merged = new Map<string, number>()
  for (const row of rawCounts) {
    const key = canonicalizeCompanyExpensePaymentMethodKey(row.payment_method, pmById, pmIdByMethod)
    if (!key) continue
    merged.set(key, (merged.get(key) ?? 0) + row.cnt)
  }

  return Array.from(merged.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ko'))
}
