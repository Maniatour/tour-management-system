/**
 * 영수증 OCR 규칙 UI — 일반 문구 ↔ 정규식(부분 일치) 및 템플릿 id
 * 파서는 여전히 RegExp만 사용합니다.
 */

export function escapeRegExpFragment(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** OCR 한 줄 안에 이 글자가 포함되면 매칭 — flags i 권장 */
export function plainPhraseToLineContainsPattern(phrase: string): string {
  const t = phrase.trim()
  if (!t) return ''
  return escapeRegExpFragment(t)
}

/** 분류 규칙 템플릿 — paid_for·키워드는 UI에서 locale별 라벨로 덮어씀 가능 */
export const RECEIPT_OCR_CATEGORY_TEMPLATE_IDS = [
  'gas',
  'parking',
  'food',
  'grocery',
  'toll',
  'hotel',
] as const

export type ReceiptOcrCategoryTemplateId = (typeof RECEIPT_OCR_CATEGORY_TEMPLATE_IDS)[number]

export const RECEIPT_OCR_CATEGORY_TEMPLATE_DEFAULTS: Record<
  ReceiptOcrCategoryTemplateId,
  { paid_for: string; keywords: string[] }
> = {
  gas: {
    paid_for: '주유',
    keywords: ['shell', 'chevron', 'exxon', 'mobil', '76', 'arco', 'bp ', ' gas ', 'fuel', '주유', '주유소'],
  },
  parking: {
    paid_for: '주차',
    keywords: ['parking', 'parkmobile', 'spothero', '주차', 'parking fee'],
  },
  food: {
    paid_for: '식비',
    keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', '식당', '카페', '커피'],
  },
  grocery: {
    paid_for: '식료품',
    keywords: ['costco', 'walmart', 'target', 'whole foods', 'trader', 'safeway', '마트', '코스트코'],
  },
  toll: {
    paid_for: '통행료',
    keywords: ['toll', 'ezpass', 'fastrak', '통행', '톨게이트'],
  },
  hotel: {
    paid_for: '숙박',
    keywords: ['hotel', 'inn', 'marriott', 'hilton', 'hyatt', 'booking', '숙박', '호텔'],
  },
}

export const RECEIPT_OCR_SKIP_LINE_TEMPLATE_IDS = [
  'thank_you',
  'www',
  'receipt_hash',
  'tel',
  'store_number',
] as const

export type ReceiptOcrSkipLineTemplateId = (typeof RECEIPT_OCR_SKIP_LINE_TEMPLATE_IDS)[number]

/** 줄에 포함되면 가맹점 후보에서 제외 — plain phrase */
export const RECEIPT_OCR_SKIP_LINE_PLAIN: Record<ReceiptOcrSkipLineTemplateId, string> = {
  thank_you: 'thank you',
  www: 'www.',
  receipt_hash: 'receipt #',
  tel: 'tel:',
  store_number: 'store #',
}

export const RECEIPT_OCR_AMOUNT_LINE_TEMPLATE_IDS = [
  'total',
  'grand_total',
  'amount_due',
  'balance',
  'total_ko',
  'payment_ko',
  'card_total',
] as const

export type ReceiptOcrAmountLineTemplateId = (typeof RECEIPT_OCR_AMOUNT_LINE_TEMPLATE_IDS)[number]

/** 금액을 먼저 찾을 줄 — plain phrase (부분 일치) */
export const RECEIPT_OCR_AMOUNT_LINE_PLAIN: Record<ReceiptOcrAmountLineTemplateId, string> = {
  total: 'total',
  grand_total: 'grand total',
  amount_due: 'amount due',
  balance: 'balance',
  total_ko: '합계',
  payment_ko: '결제',
  card_total: 'card total',
}

/** 관리자 «본문 보정» 템플릿 — Horseshoe Bend 입장·주차 영수증 등 */
export const RECEIPT_OCR_BODY_MATCH_TEMPLATE_HORSESHOE = {
  contains_phrase: 'horseshoe bend',
  paid_to: 'Horseshoe Bend',
  paid_for: 'Entrance Fee',
  payment_use_cc_label: true,
} as const
