/**
 * 영수증 OCR 텍스트에서 분류(지출 유형) 추정용 기본 키워드 — DB 규칙과 병합 시 항상 내장 목록이 뒤에 옵니다.
 */
export const RECEIPT_OCR_BUILTIN_CATEGORY_KEYWORDS: ReadonlyArray<{
  readonly paidFor: string
  readonly keywords: readonly string[]
}> = [
  {
    paidFor: 'Gas',
    keywords: ['gas', 'fuel', 'shell', 'chevron', 'arco', 'exxon', 'mobil', '76', 'circle k', 'speedway'],
  },
  {
    paidFor: 'Meals',
    keywords: [
      'restaurant',
      'cafe',
      'diner',
      'burger',
      'pizza',
      'grill',
      'kitchen',
      'mcdonald',
      'subway',
      'starbucks',
    ],
  },
  {
    paidFor: 'Entrance Fee',
    keywords: ['admission', 'entrance', 'ticket', 'park fee', 'canyon', 'national park'],
  },
  { paidFor: 'Parking', keywords: ['parking'] },
]
