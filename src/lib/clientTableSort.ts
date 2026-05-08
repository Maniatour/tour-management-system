export type SortDir = 'asc' | 'desc'

function isEmptySortValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string' && !String(v).trim()) return true
  return false
}

/**
 * 클라이언트 테이블 정렬용 비교. 빈 값은 항상 끝으로 보냅니다.
 */
export function compareSortValues(a: unknown, b: unknown, dir: SortDir, locale?: string): number {
  const emA = isEmptySortValue(a)
  const emB = isEmptySortValue(b)
  if (emA && emB) return 0
  if (emA) return 1
  if (emB) return -1

  if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
    const c = a - b
    return dir === 'asc' ? c : -c
  }

  const sa = String(a)
  const sb = String(b)
  const c = sa.localeCompare(sb, locale, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? c : -c
}
