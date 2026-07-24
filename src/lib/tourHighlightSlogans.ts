/** 투어 하이라이트 체크리스트에 표시되는 슬로건 컬럼 (slogan3~5) */
export const TOUR_HIGHLIGHT_SLOGAN_KEYS = ['slogan3', 'slogan4', 'slogan5'] as const

export type TourHighlightSloganKey = (typeof TOUR_HIGHLIGHT_SLOGAN_KEYS)[number]

export function readTourHighlightSloganVisibility(
  row: Record<string, unknown> | null | undefined,
  key: TourHighlightSloganKey
): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>)[key] !== false
}

export function collectVisibleTourHighlightSlogans(
  productDetails: Record<string, unknown> | null | undefined,
  showDetail: (field: string) => boolean
): string[] {
  if (!productDetails) return []

  return TOUR_HIGHLIGHT_SLOGAN_KEYS.map((key) => {
    if (!showDetail(key)) return null
    const text = String(productDetails[key] ?? '').trim()
    return text || null
  }).filter((text): text is string => Boolean(text))
}
