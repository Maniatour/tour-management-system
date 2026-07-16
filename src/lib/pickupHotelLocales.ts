import type { PickupHotel } from '@/utils/pickupHotelUtils'

/** Content locales for pickup hotel card text (English is default). */
export const PICKUP_CONTENT_LOCALES = [
  { code: 'en', countryCode: 'US', label: 'English (Default)' },
  { code: 'ko', countryCode: 'KR', label: '한국어' },
  { code: 'ja', countryCode: 'JP', label: '日本語' },
  { code: 'zh-CN', countryCode: 'CN', label: '简体中文' },
  { code: 'zh-TW', countryCode: 'TW', label: '繁體中文' },
  { code: 'es', countryCode: 'ES', label: 'Español' },
  { code: 'fr', countryCode: 'FR', label: 'Français' },
  { code: 'de', countryCode: 'DE', label: 'Deutsch' },
] as const

export type PickupContentLocale = (typeof PICKUP_CONTENT_LOCALES)[number]['code']

export const DEFAULT_PICKUP_CONTENT_LOCALE: PickupContentLocale = 'en'

export type PickupI18nField =
  | 'description'
  | 'from_inside_hotel'
  | 'from_outside_hotel'
  | 'to_representative_hotel'

export type PickupLocaleTextMap = Partial<Record<PickupContentLocale, string>>

export type PickupHotelContentI18n = Partial<Record<PickupI18nField, PickupLocaleTextMap>>

const FALLBACK_ORDER: PickupContentLocale[] = [
  'en',
  'ko',
  'ja',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
]

export function isPickupContentLocale(value: string): value is PickupContentLocale {
  return PICKUP_CONTENT_LOCALES.some((item) => item.code === value)
}

export function getPickupContentLocaleMeta(code: PickupContentLocale) {
  return PICKUP_CONTENT_LOCALES.find((item) => item.code === code) ?? PICKUP_CONTENT_LOCALES[0]
}

function legacyField(
  hotel: PickupHotel,
  field: PickupI18nField,
  locale: 'ko' | 'en'
): string {
  if (field === 'description') {
    return (locale === 'ko' ? hotel.description_ko : hotel.description_en) || ''
  }
  if (field === 'from_inside_hotel') {
    return (locale === 'ko' ? hotel.from_inside_hotel_ko : hotel.from_inside_hotel_en) || ''
  }
  if (field === 'from_outside_hotel') {
    return (locale === 'ko' ? hotel.from_outside_hotel_ko : hotel.from_outside_hotel_en) || ''
  }
  return (
    (locale === 'ko' ? hotel.to_representative_hotel_ko : hotel.to_representative_hotel_en) || ''
  )
}

/** Merge JSONB i18n with legacy ko/en columns for a complete map. */
export function getPickupI18nMap(
  hotel: PickupHotel,
  field: PickupI18nField
): PickupLocaleTextMap {
  const raw = (hotel.content_i18n || {}) as PickupHotelContentI18n
  const fromJson = { ...((raw[field] || {}) as PickupLocaleTextMap) }
  const ko = fromJson.ko || legacyField(hotel, field, 'ko')
  const en = fromJson.en || legacyField(hotel, field, 'en')
  if (ko) fromJson.ko = ko
  else delete fromJson.ko
  if (en) fromJson.en = en
  else delete fromJson.en
  return fromJson
}

export function getPickupLocalizedText(
  hotel: PickupHotel,
  field: PickupI18nField,
  locale: PickupContentLocale
): string {
  const map = getPickupI18nMap(hotel, field)
  if (map[locale]?.trim()) return map[locale]!.trim()
  for (const code of FALLBACK_ORDER) {
    if (map[code]?.trim()) return map[code]!.trim()
  }
  return ''
}

export function setPickupI18nField(
  current: PickupHotelContentI18n | null | undefined,
  field: PickupI18nField,
  locale: PickupContentLocale,
  value: string
): PickupHotelContentI18n {
  const next: PickupHotelContentI18n = { ...(current || {}) }
  const fieldMap: PickupLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

/** Keep legacy columns aligned when writing content_i18n. */
export function legacyColumnsFromI18n(i18n: PickupHotelContentI18n): Partial<PickupHotel> {
  const text = (field: PickupI18nField, locale: 'ko' | 'en') =>
    i18n[field]?.[locale]?.trim() || null

  return {
    description_ko: text('description', 'ko'),
    description_en: text('description', 'en'),
    from_inside_hotel_ko: text('from_inside_hotel', 'ko'),
    from_inside_hotel_en: text('from_inside_hotel', 'en'),
    from_outside_hotel_ko: text('from_outside_hotel', 'ko'),
    from_outside_hotel_en: text('from_outside_hotel', 'en'),
    to_representative_hotel_ko: text('to_representative_hotel', 'ko'),
    to_representative_hotel_en: text('to_representative_hotel', 'en'),
  }
}

export function mergeHotelI18n(
  hotel: PickupHotel,
  field: PickupI18nField,
  locale: PickupContentLocale,
  value: string
): Partial<PickupHotel> {
  const base: PickupHotelContentI18n = {
    description: getPickupI18nMap(hotel, 'description'),
    from_inside_hotel: getPickupI18nMap(hotel, 'from_inside_hotel'),
    from_outside_hotel: getPickupI18nMap(hotel, 'from_outside_hotel'),
    to_representative_hotel: getPickupI18nMap(hotel, 'to_representative_hotel'),
  }
  const content_i18n = setPickupI18nField(base, field, locale, value)
  return {
    ...legacyColumnsFromI18n(content_i18n),
    content_i18n,
  }
}
