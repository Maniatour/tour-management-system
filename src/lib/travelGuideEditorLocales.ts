/** Travel Guide 에디터·표시용 언어 (DB 컬럼 추가 시 여기 확장) */
export type TravelGuideEditorLocale = 'en' | 'ko'

export type TravelGuideEditorLocaleConfig = {
  code: TravelGuideEditorLocale
  label: string
  shortLabel: string
  /** 사이트 표시 fallback 기준 */
  isFallback?: boolean
}

export const TRAVEL_GUIDE_EDITOR_LOCALES: TravelGuideEditorLocaleConfig[] = [
  { code: 'en', label: 'English', shortLabel: 'EN', isFallback: true },
  { code: 'ko', label: '한국어', shortLabel: 'KO' },
  // { code: 'zh', label: '中文', shortLabel: 'ZH' },
  // { code: 'ja', label: '日本語', shortLabel: 'JA' },
]

export const TRAVEL_GUIDE_FALLBACK_LOCALE: TravelGuideEditorLocale = 'en'

export type TravelGuideLocalizedStrings = Partial<Record<TravelGuideEditorLocale, string>>

export function createEmptyTravelGuideLocalizedStrings(
  initial = ''
): Record<TravelGuideEditorLocale, string> {
  return TRAVEL_GUIDE_EDITOR_LOCALES.reduce(
    (acc, locale) => {
      acc[locale.code] = initial
      return acc
    },
    {} as Record<TravelGuideEditorLocale, string>
  )
}

/** 공개 페이지: 해당 언어 미작성 시 영어 → 기타 순 fallback */
export function pickTravelGuideLocalizedField(
  locale: string,
  byLocale: TravelGuideLocalizedStrings
): string {
  const code = locale.trim().toLowerCase()
  const direct = byLocale[code as TravelGuideEditorLocale]?.trim()
  if (direct) return direct

  if (code !== TRAVEL_GUIDE_FALLBACK_LOCALE) {
    const english = byLocale[TRAVEL_GUIDE_FALLBACK_LOCALE]?.trim()
    if (english) return english
  }

  for (const localeConfig of TRAVEL_GUIDE_EDITOR_LOCALES) {
    const value = byLocale[localeConfig.code]?.trim()
    if (value) return value
  }

  return ''
}

export function travelGuideRowToLocalized(
  row: {
    title_en: string
    title_ko: string
    body_en: string
    body_ko: string
    category_en: string
    category_ko: string
  },
  field: 'title' | 'body' | 'category'
): Record<TravelGuideEditorLocale, string> {
  if (field === 'title') {
    return { en: row.title_en, ko: row.title_ko }
  }
  if (field === 'body') {
    return { en: row.body_en, ko: row.body_ko }
  }
  return { en: row.category_en, ko: row.category_ko }
}

export function localizedToTravelGuidePayload(localized: {
  title: Record<TravelGuideEditorLocale, string>
  body: Record<TravelGuideEditorLocale, string>
  category: Record<TravelGuideEditorLocale, string>
}) {
  return {
    titleEn: localized.title.en.trim(),
    titleKo: localized.title.ko.trim() || localized.title.en.trim(),
    bodyEn: localized.body.en,
    bodyKo: localized.body.ko,
    categoryEn: localized.category.en.trim() || 'Travel Tips',
    categoryKo: localized.category.ko.trim() || localized.category.en.trim() || 'Travel Tips',
  }
}
