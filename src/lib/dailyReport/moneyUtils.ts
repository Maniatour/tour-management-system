export function roundUsd(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function amountToNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function formatUsd(n: number): string {
  return `$${roundUsd(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function mergeCategoryAmounts(
  rows: Array<{ category: string; amount: number }>
): Array<{ category: string; amount: number }> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = row.category.trim() || '기타'
    map.set(key, roundUsd((map.get(key) ?? 0) + row.amount))
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
