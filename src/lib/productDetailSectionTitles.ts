import { parseSectionTitlesMap } from '@/lib/fetchProductDetailsForEmail'

type TranslateFn = (key: string, values?: Record<string, string | number>) => string

/**
 * product_details_multilingual.section_titles 오버라이드 → i18n 폴백 순으로 섹션 제목 반환.
 */
export function resolveProductDetailSectionTitle(
  fieldKey: string,
  sectionTitlesRaw: unknown,
  t: TranslateFn,
  i18nFallbackKey: string
): string {
  const map = parseSectionTitlesMap(sectionTitlesRaw)
  const custom = map[fieldKey]?.trim()
  if (custom) return custom
  return t(i18nFallbackKey)
}
