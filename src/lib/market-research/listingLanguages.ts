export const MARKET_LISTING_LANGUAGES = [
  { id: 'ko', ko: '한국어', en: 'Korean' },
  { id: 'en', ko: '영어', en: 'English' },
  { id: 'ja', ko: '일본어', en: 'Japanese' },
  { id: 'zh', ko: '중국어', en: 'Chinese' },
  { id: 'es', ko: '스페인어', en: 'Spanish' },
] as const

export type MarketListingLanguageId = (typeof MARKET_LISTING_LANGUAGES)[number]['id']

const LANGUAGE_BY_TOKEN = new Map<string, MarketListingLanguageId>()
for (const row of MARKET_LISTING_LANGUAGES) {
  LANGUAGE_BY_TOKEN.set(row.id, row.id)
  LANGUAGE_BY_TOKEN.set(row.ko, row.id)
  LANGUAGE_BY_TOKEN.set(row.en.toLowerCase(), row.id)
}

export function parseListingLanguages(value: string | null | undefined): MarketListingLanguageId[] {
  if (!value?.trim()) return []
  const seen = new Set<MarketListingLanguageId>()
  for (const token of value.split(/[,·/|]+/)) {
    const key = token.trim()
    if (!key) continue
    const id = LANGUAGE_BY_TOKEN.get(key) || LANGUAGE_BY_TOKEN.get(key.toLowerCase())
    if (id) seen.add(id)
  }
  return MARKET_LISTING_LANGUAGES.map((row) => row.id).filter((id) => seen.has(id))
}

export function formatListingLanguages(ids: readonly string[]): string {
  const allowed = new Set(MARKET_LISTING_LANGUAGES.map((row) => row.id))
  return ids.filter((id) => allowed.has(id as MarketListingLanguageId)).join(',')
}

export function listingLanguageLabel(id: string, isKo: boolean): string {
  const row = MARKET_LISTING_LANGUAGES.find((item) => item.id === id)
  if (!row) return id
  return isKo ? row.ko : row.en
}
