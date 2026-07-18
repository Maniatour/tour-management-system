/**
 * 고객 카탈로그 노출: status=active 이고 is_published=true
 * (관리자 활성/비활성과 고객 배포를 분리)
 */

export type ProductVisibilityFields = {
  status?: string | null
  is_published?: boolean | null
}

/** PostgREST 쿼리에 고객 배포 필터를 붙인다. */
export function applyCustomerCatalogProductFilter<T extends { eq: (col: string, val: unknown) => T }>(
  query: T
): T {
  return query.eq('status', 'active').eq('is_published', true)
}

/** 고객에게 카탈로그로 보여도 되는지 (클라이언트/서버 공통). */
export function isProductVisibleToCustomers(product: ProductVisibilityFields): boolean {
  const status = String(product.status || '').trim().toLowerCase()
  if (status !== 'active') return false
  // 마이그레이션 전 null 은 배포된 것으로 취급
  return product.is_published !== false
}

/** 고객 예약 가능 여부 (카탈로그 노출과 동일 기준). */
export function isProductBookableForCustomers(product: ProductVisibilityFields): boolean {
  return isProductVisibleToCustomers(product)
}
