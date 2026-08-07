import { WYNDHAM_URLS } from '@/lib/hotels/suppliers/wyndham/selectors'

/** Known destination → Wyndham SRP slug (+ Google place loc when required). */
const DESTINATION_PRESETS: Array<{
  match: RegExp
  slug: string
  loc?: string
}> = [
  {
    match: /\bpage\b/i,
    slug: 'page-az-usa',
    loc: 'ChIJj3XN_VsTNIcROU44U1EvmG4',
  },
  {
    match: /\bkanab\b/i,
    slug: 'kanab-ut-usa',
    loc: 'ChIJA1v4CiHUNIcRF9NvpSmDTog',
  },
]

/** YYYY-MM-DD → M/D/YYYY for Wyndham query strings */
export function toWyndhamQueryDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Invalid date: ${isoDate}`)
  return `${m}/${d}/${y}`
}

export function resolveDestinationPreset(destination: string): {
  slug: string
  loc?: string
} | null {
  const text = destination.trim()
  if (!text) return null
  for (const preset of DESTINATION_PRESETS) {
    if (preset.match.test(text)) {
      return { slug: preset.slug, ...(preset.loc ? { loc: preset.loc } : {}) }
    }
  }
  return null
}

/**
 * Build a guest search-results URL. Prefer slug+loc presets (fast, reliable).
 * Returns null when destination is unknown — caller should fall back to form fill.
 */
export function buildWyndhamResultsUrl(params: {
  destination?: string
  checkIn: string
  checkOut: string
  adults?: number
  rooms?: number
}): string | null {
  const destination = params.destination?.trim() || ''
  const preset = resolveDestinationPreset(destination)
  if (!preset) return null

  const home = (process.env.WYNDHAM_HOME_URL || WYNDHAM_URLS.home).replace(/\/$/, '')
  const qs = new URLSearchParams({
    brand_id: 'ALL',
    checkInDate: toWyndhamQueryDate(params.checkIn),
    checkOutDate: toWyndhamQueryDate(params.checkOut),
    useWRPoints: 'false',
    children: '0',
    adults: String(params.adults ?? 1),
    rooms: String(params.rooms ?? 1),
  })
  if (preset.loc) qs.set('loc', preset.loc)

  return `${home}/hotels/${preset.slug}?${qs.toString()}`
}
