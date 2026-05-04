/**
 * 거주 안내 이메일: 당일 투어용 vs 멀티데이·숙박 투어용 템플릿 구분.
 * ScheduleView·TicketBookingList와 동일한 product_code 규칙 + 상품 태그 `숙박투어`.
 */
export type ResidentInquiryEmailTourKind = 'day_tour' | 'multi_day'

const MULTI_DAY_CODE_PREFIXES = ['MNGC1N', 'MNM1', 'MNGC2N', 'MNGC3N'] as const

const MULTI_DAY_EXACT: Record<string, number> = {
  MNGC1N: 2,
  MNM1: 2,
  MNGC2N: 3,
  MNGC3N: 4,
}

function productCodeImpliesMultiDay(productCode: string): boolean {
  const code = productCode.trim()
  if (!code) return false
  if (MULTI_DAY_EXACT[code]) return true
  for (const prefix of MULTI_DAY_CODE_PREFIXES) {
    if (code.startsWith(prefix)) return true
  }
  return false
}

export function residentInquiryEmailTourKindFromProduct(
  productCode: string | null | undefined,
  tags?: string[] | null
): ResidentInquiryEmailTourKind {
  const code = (productCode ?? '').trim()
  if (productCodeImpliesMultiDay(code)) return 'multi_day'
  const tagList = tags ?? []
  if (tagList.some((t) => String(t).trim() === '숙박투어')) return 'multi_day'
  return 'day_tour'
}

export function residentInquiryEmailTourKindToApiParam(kind: ResidentInquiryEmailTourKind): string {
  return kind === 'multi_day' ? 'multi_day' : 'day_tour'
}

export function parseResidentInquiryEmailTourKindParam(
  v: string | null | undefined
): ResidentInquiryEmailTourKind | null {
  if (v === 'day_tour' || v === 'multi_day') return v
  return null
}
