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

/** Whether a catalog hotel belongs to a Wyndham scrape destination (Page AZ / Kanab UT). */
export function hotelMatchesDestination(
  hotel: { name?: string | null; city?: string | null; state?: string | null },
  destination: string
): boolean {
  const resolved = resolveTourHotelPriceCheckDestination(
    hotel.name || '',
    [hotel.city, hotel.state].filter(Boolean).join(' ')
  )
  return resolved.toLowerCase() === destination.trim().toLowerCase()
}

/**
 * Match a tour_hotel_bookings.hotel label (e.g. P-Wingate) to a hotels catalog row.
 */
export function findBestCatalogHotel<
  T extends {
    hotel_id: string
    name: string
    supplier_hotel_id?: string | null
    city?: string | null
    state?: string | null
  },
>(hotels: T[], bookingHotel: string, destination?: string | null): T | null {
  if (!hotels.length || !String(bookingHotel || '').trim()) return null

  const candidates =
    destination && destination.trim()
      ? hotels.filter((h) => hotelMatchesDestination(h, destination))
      : hotels
  const pool = candidates.length > 0 ? candidates : hotels

  let best: T | null = null
  let bestScore = -1
  for (const h of pool) {
    const hay = `${h.name} ${h.supplier_hotel_id || ''}`
    const score = Math.max(
      scoreHotelQuoteMatch({ name: bookingHotel, supplierHotelId: bookingHotel }, hay),
      scoreHotelQuoteMatch(
        {
          name: h.name,
          ...(h.supplier_hotel_id ? { supplierHotelId: h.supplier_hotel_id } : {}),
        },
        bookingHotel
      )
    )
    if (score > bestScore) {
      bestScore = score
      best = h
    }
  }
  return bestScore >= 20 ? best : null
}

export function parseDestinationCityState(destination: string): {
  city: string
  state: string
} {
  const d = destination.trim()
  if (/page/i.test(d)) return { city: 'Page', state: 'AZ' }
  if (/kanab/i.test(d)) return { city: 'Kanab', state: 'UT' }
  const parts = d.split(/\s+/)
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(' '),
      state: parts[parts.length - 1] || '',
    }
  }
  return { city: d, state: '' }
}
