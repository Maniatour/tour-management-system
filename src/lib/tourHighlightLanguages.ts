export type TourHighlightLanguageChip = {
  code: string
  countryCode: string
  label: string
}

export const COMMON_TOUR_HIGHLIGHT_LANGUAGE_OPTIONS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
  { code: 'zh-CN', label: '中文(简体)' },
  { code: 'zh-TW', label: '中文(繁體)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const

const TOUR_LANGUAGE_ALIASES: Record<string, string> = {
  korean: 'ko',
  kr: 'ko',
  ko: 'ko',
  한국어: 'ko',
  english: 'en',
  en: 'en',
  영어: 'en',
  japanese: 'ja',
  ja: 'ja',
  jp: 'ja',
  일본어: 'ja',
  spanish: 'es',
  es: 'es',
  español: 'es',
  스페인어: 'es',
  chinese: 'zh-cn',
  zh: 'zh-cn',
  cn: 'zh-cn',
  'zh-cn': 'zh-cn',
  'zh_cn': 'zh-cn',
  중국어: 'zh-cn',
  'zh-tw': 'zh-tw',
  'zh_tw': 'zh-tw',
  taiwanese: 'zh-tw',
  대만어: 'zh-tw',
  french: 'fr',
  fr: 'fr',
  français: 'fr',
  프랑스어: 'fr',
  german: 'de',
  de: 'de',
  deutsch: 'de',
  독일어: 'de',
  italian: 'it',
  it: 'it',
  italiano: 'it',
  이탈리아어: 'it',
  portuguese: 'pt',
  pt: 'pt',
  português: 'pt',
  포르투갈어: 'pt',
  russian: 'ru',
  ru: 'ru',
  러시아어: 'ru',
  thai: 'th',
  th: 'th',
  태국어: 'th',
  vietnamese: 'vi',
  vi: 'vi',
  베트남어: 'vi',
  indonesian: 'id',
  id: 'id',
  인도네시아어: 'id',
  malay: 'ms',
  ms: 'ms',
  말레이어: 'ms',
  filipino: 'tl',
  tagalog: 'tl',
  tl: 'tl',
  필리핀어: 'tl',
}

const TOUR_LANGUAGE_HIGHLIGHT_LABELS_EN: Record<string, string> = {
  ko: 'KOREAN',
  kr: 'KOREAN',
  en: 'ENGLISH',
  ja: 'JAPANESE',
  jp: 'JAPANESE',
  'zh-cn': 'CHINESE',
  'zh-tw': 'CHINESE',
  zh: 'CHINESE',
  cn: 'CHINESE',
  es: 'SPANISH',
  fr: 'FRENCH',
  de: 'GERMAN',
  it: 'ITALIAN',
  pt: 'PORTUGUESE',
  ru: 'RUSSIAN',
  th: 'THAI',
  vi: 'VIETNAMESE',
  id: 'INDONESIAN',
  ms: 'MALAY',
  tl: 'FILIPINO',
}

const TOUR_LANGUAGE_HIGHLIGHT_LABELS_KO: Record<string, string> = {
  ko: '한국어',
  kr: '한국어',
  en: '영어',
  ja: '일본어',
  jp: '일본어',
  'zh-cn': '중국어(간체)',
  'zh-tw': '중국어(번체)',
  zh: '중국어',
  cn: '중국어',
  es: '스페인어',
  fr: '프랑스어',
  de: '독일어',
  it: '이탈리아어',
  pt: '포르투갈어',
  ru: '러시아어',
  th: '태국어',
  vi: '베트남어',
  id: '인도네시아어',
  ms: '말레이어',
  tl: '필리핀어',
}

function isKoreanHighlightLocale(locale?: string): boolean {
  const normalized = locale?.toLowerCase().trim() ?? 'ko'
  return normalized === 'ko' || normalized.startsWith('ko-')
}

/** 사용자 입력(코드·영문명·한글명)을 languages 배열용 코드로 정규화 */
export function normalizeTourLanguageToken(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const lowered = trimmed.toLowerCase()
  if (TOUR_LANGUAGE_ALIASES[lowered]) return TOUR_LANGUAGE_ALIASES[lowered]
  if (TOUR_LANGUAGE_ALIASES[trimmed]) return TOUR_LANGUAGE_ALIASES[trimmed]
  return lowered
}

export function mergeTourLanguageList(
  current: string[],
  additions: string[]
): string[] {
  const seen = new Set(current.map((code) => code.toLowerCase()))
  const next = [...current]
  for (const raw of additions) {
    const code = normalizeTourLanguageToken(raw)
    if (!code || seen.has(code)) continue
    seen.add(code)
    next.push(code)
  }
  return next
}

export function parseTourLanguagesInput(text: string): string[] {
  return mergeTourLanguageList([], text.split(/[,，;|/]/))
}

export function getTourLanguageFlagCountryCode(language: string | undefined | null): string {
  if (!language) return 'US'
  const lang = language.toLowerCase().trim()
  if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === 'korean') return 'KR'
  if (lang === 'en' || lang.startsWith('en-') || lang === 'english') return 'US'
  if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === 'japanese') return 'JP'
  if (lang === 'zh-tw' || lang === 'zh_tw') return 'TW'
  if (lang === 'zh-cn' || lang === 'zh_cn' || lang === 'zh' || lang === 'cn' || lang.startsWith('zh-'))
    return 'CN'
  if (lang === 'es' || lang.startsWith('es-') || lang === 'spanish') return 'ES'
  if (lang === 'fr' || lang.startsWith('fr-') || lang === 'french') return 'FR'
  if (lang === 'de' || lang.startsWith('de-') || lang === 'german') return 'DE'
  if (lang === 'it' || lang.startsWith('it-') || lang === 'italian') return 'IT'
  if (lang === 'pt' || lang.startsWith('pt-') || lang === 'portuguese') return 'PT'
  if (lang === 'ru' || lang.startsWith('ru-') || lang === 'russian') return 'RU'
  if (lang === 'th' || lang === 'thai') return 'TH'
  if (lang === 'vi' || lang === 'vietnamese') return 'VN'
  if (lang === 'id' || lang === 'indonesian') return 'ID'
  if (lang === 'ms' || lang === 'malay') return 'MY'
  if (lang === 'ph' || lang === 'filipino' || lang === 'tl') return 'PH'
  return 'US'
}

export function formatTourLanguageHighlightLabel(language: string, locale?: string): string {
  const normalized = normalizeTourLanguageToken(language) || language.toLowerCase().trim()
  const labels = isKoreanHighlightLocale(locale)
    ? TOUR_LANGUAGE_HIGHLIGHT_LABELS_KO
    : TOUR_LANGUAGE_HIGHLIGHT_LABELS_EN

  if (labels[normalized]) return labels[normalized]
  const base = normalized.split(/[-_]/)[0] ?? normalized
  if (base && labels[base]) return labels[base]

  if (isKoreanHighlightLocale(locale)) return language.trim()
  return language.trim().toUpperCase()
}

export function buildTourLanguageHighlightChips(
  languages: string[] | null | undefined,
  locale?: string
): TourHighlightLanguageChip[] {
  if (!languages?.length) return []

  const seen = new Set<string>()
  const chips: TourHighlightLanguageChip[] = []

  for (const raw of languages) {
    const code = raw.trim().toLowerCase()
    if (!code || seen.has(code)) continue
    seen.add(code)
    chips.push({
      code,
      countryCode: getTourLanguageFlagCountryCode(code),
      label: formatTourLanguageHighlightLabel(raw, locale),
    })
  }

  return chips
}
