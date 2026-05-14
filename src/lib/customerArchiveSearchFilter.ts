/** DB `customers.archive === true` 인 보관 고객 */
export function isCustomerRowArchived(archive: boolean | null | undefined): boolean {
  return archive === true
}

/**
 * 예약 관리 고객 id 보조 조회와 동일: 검색어가 있을 때,
 * 비보관(archive !== true) 행 중 매칭이 하나라도 있으면 그 결과만,
 * 없으면 보관(archive === true) 매칭만 반환.
 */
export function filterRowsByArchiveSearchTier<T extends { archive?: boolean | null }>(
  rows: T[],
  searchTerm: string,
  matches: (row: T) => boolean
): T[] {
  const t = searchTerm.trim()
  if (!t) return rows
  const hit = rows.filter(matches)
  const nonArchived = hit.filter((r) => !isCustomerRowArchived(r.archive))
  if (nonArchived.length > 0) return nonArchived
  return hit.filter((r) => isCustomerRowArchived(r.archive))
}
