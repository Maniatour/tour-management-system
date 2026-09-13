import { getPickupI18nMap, type PickupHotelContentI18n } from '@/lib/pickupHotelLocales'
import { getPickupHotelPrimaryName, type PickupHotel } from '@/utils/pickupHotelUtils'

export type PickupChatShareKind = 'maps' | 'images' | 'description' | 'inside' | 'outside'

export type PickupChatShareHotel = {
  id: string
  hotel: string
  internal_name?: string | null
  pick_up_location?: string
  address?: string
  link?: string | null
  google_maps_link?: string
  media?: string[] | null
  description_ko?: string | null
  description_en?: string | null
  from_inside_hotel_ko?: string | null
  from_inside_hotel_en?: string | null
  from_outside_hotel_ko?: string | null
  from_outside_hotel_en?: string | null
  content_i18n?: PickupHotelContentI18n | null
}

export function getPickupMapsUrl(hotel: PickupChatShareHotel): string {
  return (hotel.link || hotel.google_maps_link || '').trim()
}

export function getPickupHotelMediaUrls(hotel: PickupChatShareHotel): string[] {
  const media = hotel.media
  if (!Array.isArray(media)) return []
  return media
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url) => url.length > 0 && !url.startsWith('data:'))
    .slice(0, 4)
}

function hotelForLocale(hotel: PickupChatShareHotel): PickupHotel {
  return hotel as PickupHotel
}

function pickupName(hotel: PickupChatShareHotel): string {
  return getPickupHotelPrimaryName({
    hotel: hotel.hotel,
    internal_name: hotel.internal_name,
  })
}

export function pickupSectionText(
  hotel: PickupChatShareHotel,
  field: 'description' | 'from_inside_hotel' | 'from_outside_hotel',
  locale: 'ko' | 'en'
): string {
  const map = getPickupI18nMap(hotelForLocale(hotel), field)
  return map[locale]?.trim() || ''
}

export function pickupChatShareAvailability(
  hotel: PickupChatShareHotel
): Record<PickupChatShareKind, boolean> {
  return {
    maps: Boolean(getPickupMapsUrl(hotel)),
    images: getPickupHotelMediaUrls(hotel).length > 0,
    description: Boolean(
      pickupSectionText(hotel, 'description', 'en') ||
        pickupSectionText(hotel, 'description', 'ko')
    ),
    inside: Boolean(
      pickupSectionText(hotel, 'from_inside_hotel', 'en') ||
        pickupSectionText(hotel, 'from_inside_hotel', 'ko')
    ),
    outside: Boolean(
      pickupSectionText(hotel, 'from_outside_hotel', 'en') ||
        pickupSectionText(hotel, 'from_outside_hotel', 'ko')
    ),
  }
}

function isKoreanCustomerLanguage(value: string | null | undefined): boolean {
  const v = (value || '').trim().toLowerCase()
  return v === 'ko' || v === 'kr' || v === '한국어' || v.startsWith('ko-')
}

/** 투어 채팅은 고객이 읽음. 영어 고객이 있으면 영어, 전원 한국어일 때만 한글. */
export function pickupChatContentLocale(
  customerLanguages: Array<string | null | undefined>
): 'ko' | 'en' {
  const known = customerLanguages.map((l) => (l || '').trim()).filter(Boolean)
  if (known.length === 0) return 'en'
  if (known.every(isKoreanCustomerLanguage)) return 'ko'
  return 'en'
}

function pickupNameForCustomers(hotel: PickupChatShareHotel): string {
  return (hotel.hotel || '').trim() || pickupName(hotel)
}

function sectionBodyForChat(
  hotel: PickupChatShareHotel,
  field: 'description' | 'from_inside_hotel' | 'from_outside_hotel',
  locale: 'ko' | 'en'
): string {
  const preferred = pickupSectionText(hotel, field, locale)
  if (preferred) return preferred
  if (locale === 'ko') return pickupSectionText(hotel, field, 'en')
  return ''
}

export function buildPickupMapsChatText(
  hotel: PickupChatShareHotel,
  locale: 'ko' | 'en'
): string {
  const name = pickupNameForCustomers(hotel)
  const mapsUrl = getPickupMapsUrl(hotel)
  const location = (hotel.pick_up_location || '').trim()
  const address = (hotel.address || '').trim()
  const lines = [`📍 ${name}`]
  if (locale === 'ko') {
    if (location) lines.push(`픽업 장소: ${location}`)
    if (address) lines.push(`주소: ${address}`)
    if (mapsUrl) lines.push(`Google Maps: ${mapsUrl}`)
  } else {
    if (location) lines.push(`Pickup location: ${location}`)
    if (address) lines.push(`Address: ${address}`)
    if (mapsUrl) lines.push(`Google Maps: ${mapsUrl}`)
  }
  return lines.join('\n')
}

export function buildPickupSectionChatText(
  hotel: PickupChatShareHotel,
  kind: 'description' | 'inside' | 'outside',
  locale: 'ko' | 'en'
): string {
  const name = pickupNameForCustomers(hotel)
  const field =
    kind === 'inside'
      ? 'from_inside_hotel'
      : kind === 'outside'
        ? 'from_outside_hotel'
        : 'description'
  const body = sectionBodyForChat(hotel, field, locale)
  if (!body) return ''
  const title =
    kind === 'inside'
      ? locale === 'ko'
        ? '호텔 내부에서'
        : 'From Inside Hotel'
      : kind === 'outside'
        ? locale === 'ko'
          ? '호텔 외부에서'
          : 'From Outside Hotel'
        : locale === 'ko'
          ? '위치 설명'
          : 'Location Description'
  return `📍 ${name}\n${title}\n${body}`.trim()
}

export function pickupImageCaption(
  hotel: PickupChatShareHotel,
  locale: 'ko' | 'en'
): string {
  const name = pickupNameForCustomers(hotel)
  return locale === 'ko' ? `${name} 픽업 장소` : `${name} pickup location`
}

export type PickupChatShareDraft = {
  kind: PickupChatShareKind
  text: string
  imageUrls: string[]
  mapsUrl: string
}

export function buildPickupShareDraft(
  hotel: PickupChatShareHotel,
  kind: PickupChatShareKind,
  locale: 'ko' | 'en'
): PickupChatShareDraft | null {
  if (kind === 'maps') {
    const text = buildPickupMapsChatText(hotel, locale)
    const mapsUrl = getPickupMapsUrl(hotel)
    if (!text && !mapsUrl) return null
    return { kind, text, imageUrls: [], mapsUrl }
  }
  if (kind === 'images') {
    const imageUrls = getPickupHotelMediaUrls(hotel)
    if (imageUrls.length === 0) return null
    return {
      kind,
      text: pickupImageCaption(hotel, locale),
      imageUrls,
      mapsUrl: '',
    }
  }
  const text = buildPickupSectionChatText(hotel, kind, locale)
  if (!text) return null
  return { kind, text, imageUrls: [], mapsUrl: '' }
}
