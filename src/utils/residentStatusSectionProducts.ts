/**
 * 거주 상태별 인원·금액(미국 거주자 구분 연동) UI는 아래 상품 코드에서만 표시합니다.
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

export function productShowsResidentStatusSectionByCode(
  productCode: string | null | undefined
): boolean {
  if (productCode == null) return false
  const n = String(productCode).trim()
  if (!n) return false
  return RESIDENT_STATUS_SECTION_PRODUCT_CODES.has(n.toUpperCase())
}
