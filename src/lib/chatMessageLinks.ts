const TRAILING_PUNCTUATION_RE = /[.,;:!?)]+$/

export function trimTrailingUrlPunctuation(url: string): string {
  return url.replace(TRAILING_PUNCTUATION_RE, '')
}

export const GOOGLE_MAPS_URL_RE =
  /https?:\/\/(?:www\.)?google\.com\/maps[^\s<>"']*|https?:\/\/maps\.google\.com[^\s<>"']*|https?:\/\/maps\.app\.goo\.gl[^\s<>"']*/gi

export const NAVER_MAPS_URL_RE =
  /https?:\/\/map\.naver\.com[^\s<>"']*|https?:\/\/(?:www\.)?naver\.com\/maps[^\s<>"']*/gi

export const HTTP_URL_RE = /https?:\/\/[^\s<>"']+/g

export function extractFirstUrl(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  if (!match?.[0]) return null
  return trimTrailingUrlPunctuation(match[0])
}

export function isLocationShareMessage(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false

  const hasLocationMarker =
    normalized.includes('📍') ||
    normalized.includes('My Location') ||
    normalized.includes('내 위치')

  const hasMapHint =
    normalized.includes('View on Map') ||
    normalized.includes('지도 보기') ||
    normalized.includes('Google Maps:') ||
    /google\.com\/maps\?q=/i.test(normalized) ||
    /maps\.app\.goo\.gl/i.test(normalized)

  return hasLocationMarker && hasMapHint
}

export function isGoogleMapsUrl(url: string): boolean {
  return /google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl/i.test(url)
}

export function isNaverMapsUrl(url: string): boolean {
  return /map\.naver\.com|naver\.com\/maps/i.test(url)
}

export type MapUrlMatch = {
  url: string
  start: number
  end: number
}

/** Find the next map or http URL in text (protocol required). */
export function findNextUrl(text: string, fromIndex = 0): MapUrlMatch | null {
  const slice = text.slice(fromIndex)
  const patterns = [GOOGLE_MAPS_URL_RE, NAVER_MAPS_URL_RE, HTTP_URL_RE]

  let best: MapUrlMatch | null = null

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(slice)
    if (!match?.[0] || match.index === undefined) continue

    const candidate: MapUrlMatch = {
      url: trimTrailingUrlPunctuation(match[0]),
      start: fromIndex + match.index,
      end: fromIndex + match.index + match[0].length,
    }

    if (!best || candidate.start < best.start) {
      best = candidate
    }
  }

  return best
}
