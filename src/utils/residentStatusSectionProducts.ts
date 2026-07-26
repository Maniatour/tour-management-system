/**
 * 거주 상태별 인원·금액(미국 거주자 구분 연동) UI는 아래 상품 코드에서만 표시합니다.
 * - 기존 전체 코드 화이트리스트
 * - 또는 코드에 목적지·투어 약어(gcs, zcn, brc, gct)가 포함된 경우
 */
const RESIDENT_STATUS_SECTION_PRODUCT_CODES = new Set(
  [
    'MDGCSUNRISE',
    'MDGC1D',
    'MNGC1N',
    'MNGC2N',
    'MNGC3N',
    'MNCUSTOM',
    'MSGUIDE',
    'MNM1',
    'MDZB',
    'MDGCSOUTH',
  ].map((c) => c.toUpperCase())
)

/** 빌더 목적지·투어 약어 — product_code에 포함 시 거주자 UI 표시 */
const RESIDENT_STATUS_CODE_SUBSTRINGS = ['GCS', 'ZCN', 'BRC', 'GCT'] as const

export function productShowsResidentStatusSectionByCode(
  productCode: string | null | undefined
): boolean {
  if (productCode == null) return false
  const n = String(productCode).trim()
  if (!n) return false
  const upper = n.toUpperCase()
  if (RESIDENT_STATUS_SECTION_PRODUCT_CODES.has(upper)) return true
  return RESIDENT_STATUS_CODE_SUBSTRINGS.some((token) => upper.includes(token))
}
