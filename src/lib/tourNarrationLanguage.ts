export const NARRATION_LANGUAGE_TAB_ORDER = ['en', 'ko', 'ja', 'zh'] as const

export function normalizeNarrationLanguage(language: string | null | undefined): string {
  const raw = (language || '').trim().toLowerCase()
  if (!raw) return 'ko'
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('ko') || raw === 'kr') return 'ko'
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('zh') || raw === 'cn') return 'zh'
  return raw
}

export function narrationLanguageFlagCode(language: string): string {
  switch (language) {
    case 'ko':
      return 'KR'
    case 'en':
      return 'US'
    case 'ja':
      return 'JP'
    case 'zh':
      return 'CN'
    default:
      return 'US'
  }
}

export function narrationLanguageTabLabel(language: string): string {
  switch (language) {
    case 'en':
      return 'English'
    case 'ko':
      return '한국어'
    case 'ja':
      return '日本語'
    case 'zh':
      return '中文'
    default:
      return language.toUpperCase()
  }
}

export function preferredNarrationLanguageFromLocale(locale: string): string {
  if (locale === 'en') return 'en'
  if (locale === 'ja') return 'ja'
  if (locale.startsWith('zh')) return 'zh'
  return 'ko'
}

export type NarrationLanguageTab = {
  code: string
  count: number
  label: string
  flag: string
}

export function buildNarrationLanguageTabs(
  materials: Array<{ file_type?: string | null; language?: string | null }>
): NarrationLanguageTab[] {
  const counts = new Map<string, number>()
  for (const material of materials) {
    if (material.file_type && material.file_type !== 'audio') continue
    const code = normalizeNarrationLanguage(material.language)
    counts.set(code, (counts.get(code) || 0) + 1)
  }
  const known = NARRATION_LANGUAGE_TAB_ORDER.filter((code) => counts.has(code))
  const extra = [...counts.keys()].filter(
    (code) => !(NARRATION_LANGUAGE_TAB_ORDER as readonly string[]).includes(code)
  )
  extra.sort()
  return [...known, ...extra].map((code) => ({
    code,
    count: counts.get(code) || 0,
    label: narrationLanguageTabLabel(code),
    flag: narrationLanguageFlagCode(code),
  }))
}
