import type { HotelRateQuote } from '@/lib/hotels/types'

const BRAND_KEYS = [
  'wingate',
  'days inn',
  'la quinta',
  'super 8',
  'travelodge',
  'ramada',
  'baymont',
  'microtel',
  'hawthorn',
  'tryp',
] as const

/** Strip ops abbreviations like P-Wingate / K-La Quinta */
export function normalizeTourHotelLabel(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^p-/i, '')
    .replace(/^k-/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Score how well a scraped property name matches a catalog / booking hotel label.
 */
export function scoreHotelQuoteMatch(
  hotel: { name: string; supplierHotelId?: string },
  quoteRoomType: string
): number {
  const hay = quoteRoomType.toLowerCase()
  const needle = normalizeTourHotelLabel(
    `${hotel.name} ${hotel.supplierHotelId || ''}`
  )

  let score = 0
  for (const brand of BRAND_KEYS) {
    if (needle.includes(brand) && hay.includes(brand)) score += 20
  }

  const tokens = needle
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !['wyndham', 'hotel', 'suites', 'inn'].includes(t))
  for (const t of tokens) {
    if (hay.includes(t)) score += 2
  }

  return score
}

/** Pick the best matching quote set for one hotel (usually 1 property × N nights). */
export function pickQuotesForHotel(
  hotel: { name: string; supplierHotelId?: string },
  quotes: HotelRateQuote[]
): HotelRateQuote[] {
  if (quotes.length === 0) return []

  const byRoom = new Map<string, HotelRateQuote[]>()
  for (const q of quotes) {
    const key = q.roomType || q.supplierRoomId || 'unknown'
    const list = byRoom.get(key) || []
    list.push(q)
    byRoom.set(key, list)
  }

  let bestKey: string | null = null
  let bestScore = -1
  for (const [key] of byRoom) {
    const score = scoreHotelQuoteMatch(hotel, key)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }

  if (!bestKey || bestScore < 20) return []
  return byRoom.get(bestKey) || []
}

/** Page / Kanab destination for Wyndham direct URL presets */
export function resolveTourHotelPriceCheckDestination(
  hotel: string,
  city?: string | null
): string {
  const h = String(hotel || '')
  const c = String(city || '')
  if (/^p-/i.test(h) || /\bpage\b/i.test(h) || /\bpage\b/i.test(c)) return 'Page AZ'
  if (/^k-/i.test(h) || /\bkanab\b/i.test(h) || /\bkanab\b/i.test(c)) return 'Kanab UT'
  if (/\baz\b/i.test(c) || /arizona/i.test(c)) {
    return /\baz\b/i.test(c) ? c : `${c} AZ`
  }
  if (/\but\b/i.test(c) || /utah/i.test(c)) {
    return /\but\b/i.test(c) ? c : `${c} UT`
  }
  return c.trim() || h.trim() || 'Page AZ'
}
