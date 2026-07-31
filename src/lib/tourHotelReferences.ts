export type TourHotelReference = {
  id: string
  hotel_name: string
  city: string
  website: string | null
}

/** 호텔 관리 모달·드롭다운 공통 행 */
export type TourHotelManageRow = {
  id?: string
  hotel_name: string
  city: string
  website: string | null
  /** reference = 등록됨, booking = 부킹 기록만 */
  source: 'reference' | 'booking'
}

export function mergeTourHotelManageRows(
  references: TourHotelReference[],
  bookingRows: Array<{ hotel: string; city?: string | null; website?: string | null }>
): TourHotelManageRow[] {
  const byKey = new Map<string, TourHotelManageRow>()

  for (const row of bookingRows) {
    const hotelName = String(row.hotel || '').trim()
    if (!hotelName) continue
    const key = hotelName.toLowerCase()
    if (byKey.has(key)) continue
    const cityFromBooking = String(row.city || '').trim()
    byKey.set(key, {
      hotel_name: hotelName,
      city: cityFromBooking || resolveCityFromHotelNamePrefix(hotelName) || '',
      website: row.website?.trim() ? row.website.trim() : null,
      source: 'booking',
    })
  }

  for (const ref of references) {
    const hotelName = ref.hotel_name.trim()
    if (!hotelName) continue
    byKey.set(hotelName.toLowerCase(), {
      id: ref.id,
      hotel_name: hotelName,
      city: ref.city.trim(),
      website: ref.website?.trim() ? ref.website.trim() : null,
      source: 'reference',
    })
  }

  return [...byKey.values()].sort((a, b) =>
    a.hotel_name.localeCompare(b.hotel_name, undefined, { sensitivity: 'base' })
  )
}

/** 호텔명 앞 글자(또는 약어) → 도시. P = Page 등 */
export const TOUR_HOTEL_CITY_PREFIXES: Record<string, string> = {
  P: 'Page',
  LV: 'Las Vegas',
  L: 'Las Vegas',
  K: 'Kanab',
  B: 'Bryce',
  Z: 'Zion',
  F: 'Flagstaff',
  S: 'Springdale',
  T: 'Tropic',
  M: 'Mesquite',
  C: 'Cedar City',
}

export const TOUR_HOTEL_BOOKING_STATUS_OPTIONS = [
  { value: 'confirmed', labelKo: '확정', labelEn: 'Confirmed' },
  { value: 'cancelled', labelKo: '취소', labelEn: 'Cancelled' },
] as const

export function normalizeTourHotelBookingStatus(
  status: string | null | undefined
): 'confirmed' | 'cancelled' {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'cancelled') return 'cancelled'
  return 'confirmed'
}

export const DEFAULT_TOUR_HOTEL_ROOM_TYPE = '2QUEEN'

export function addDaysToYmd(ymd: string, days: number): string {
  const trimmed = String(ymd || '').trim().slice(0, 10)
  if (!trimmed) return ''
  const d = new Date(`${trimmed}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function prefixMatchesHotelName(hotelName: string, prefix: string): boolean {
  const upper = hotelName.toUpperCase()
  const p = prefix.toUpperCase()
  if (!upper.startsWith(p)) return false
  const next = upper[p.length]
  if (!next) return true
  return next === ' ' || next === '-' || next === '_'
}

export function resolveCityFromHotelNamePrefix(hotelName: string): string | null {
  const trimmed = hotelName.trim()
  if (!trimmed) return null
  const prefixes = Object.keys(TOUR_HOTEL_CITY_PREFIXES).sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (prefixMatchesHotelName(trimmed, prefix)) {
      return TOUR_HOTEL_CITY_PREFIXES[prefix]
    }
  }
  return null
}

export function resolveHotelReferenceFields(
  hotelName: string,
  references: TourHotelReference[]
): { city: string; website?: string } | null {
  const trimmed = hotelName.trim()
  if (!trimmed) return null

  const ref = references.find(
    (r) => r.hotel_name.trim().toLowerCase() === trimmed.toLowerCase()
  )
  if (ref) {
    return {
      city: ref.city.trim(),
      ...(ref.website?.trim() ? { website: ref.website.trim() } : {}),
    }
  }

  const cityFromPrefix = resolveCityFromHotelNamePrefix(trimmed)
  if (cityFromPrefix) return { city: cityFromPrefix }
  return null
}

export function isCancelledTourHotelBooking(status: string | null | undefined): boolean {
  return String(status || '').trim().toLowerCase() === 'cancelled'
}

/** 투어 상세 부킹 관리 — 기본 목록(취소 제외) */
export function isActiveTourHotelBookingForList(status: string | null | undefined): boolean {
  return !isCancelledTourHotelBooking(status)
}

export function tourHotelBookingStatusLabel(
  status: string | null | undefined,
  locale: string
): string {
  const normalized = normalizeTourHotelBookingStatus(status)
  const opt = TOUR_HOTEL_BOOKING_STATUS_OPTIONS.find((o) => o.value === normalized)
  if (opt) return locale === 'ko' ? opt.labelKo : opt.labelEn
  return normalized
}
