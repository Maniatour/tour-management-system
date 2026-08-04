export const REVIEW_SOURCE_GOOGLE = 'google' as const

export const OTA_REVIEW_SOURCES = [
  'getyourguide',
  'viator',
  'tripadvisor',
  'klook',
  'kkday',
  'tripcom',
  'other',
] as const

export type OtaReviewSource = (typeof OTA_REVIEW_SOURCES)[number]
export type ReviewSource = typeof REVIEW_SOURCE_GOOGLE | OtaReviewSource

export type ReviewSourceTab = {
  id: ReviewSource
  labelKo: string
  labelEn: string
}

/** Tabs that show total review count badges in admin review integration UI. */
export const REVIEW_SOURCE_TABS_WITH_COUNT = [
  REVIEW_SOURCE_GOOGLE,
  ...OTA_REVIEW_SOURCES,
] as const

export type ReviewSourceTabWithCount = (typeof REVIEW_SOURCE_TABS_WITH_COUNT)[number]

export function isReviewSourceTabWithCount(value: string): value is ReviewSourceTabWithCount {
  return (REVIEW_SOURCE_TABS_WITH_COUNT as readonly string[]).includes(value)
}

export const REVIEW_SOURCE_TABS: ReviewSourceTab[] = [
  { id: 'google', labelKo: 'Google', labelEn: 'Google' },
  { id: 'getyourguide', labelKo: 'GetYourGuide', labelEn: 'GetYourGuide' },
  { id: 'viator', labelKo: 'Viator', labelEn: 'Viator' },
  { id: 'tripadvisor', labelKo: 'TripAdvisor', labelEn: 'TripAdvisor' },
  { id: 'klook', labelKo: 'Klook', labelEn: 'Klook' },
  { id: 'kkday', labelKo: 'KKday', labelEn: 'KKday' },
  { id: 'tripcom', labelKo: 'Trip.com', labelEn: 'Trip.com' },
  { id: 'other', labelKo: '기타 OTA', labelEn: 'Other OTA' },
]

export function isOtaReviewSource(value: string): value is OtaReviewSource {
  return (OTA_REVIEW_SOURCES as readonly string[]).includes(value)
}

export function isReviewSource(value: string): value is ReviewSource {
  return value === REVIEW_SOURCE_GOOGLE || isOtaReviewSource(value)
}

export function getReviewSourceLabel(source: ReviewSource, locale: string): string {
  const tab = REVIEW_SOURCE_TABS.find((row) => row.id === source)
  if (!tab) return source
  return locale === 'ko' ? tab.labelKo : tab.labelEn
}

export function otaLocationPlaceholder(source: OtaReviewSource): string {
  return `ota:${source}`
}

export function defaultAdminGoogleReviewListSort(source: ReviewSource): 'imported_at' | 'review_created_at' {
  return source === REVIEW_SOURCE_GOOGLE ? 'review_created_at' : 'imported_at'
}
