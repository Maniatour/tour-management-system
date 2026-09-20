export const MARKET_OTA_PLATFORMS = [
  'viator',
  'getyourguide',
  'klook',
  'kkday',
  'tripadvisor',
  'tripcom',
  'myrealtrip',
  'expedia',
  'other',
] as const

export type MarketOtaPlatform = (typeof MARKET_OTA_PLATFORMS)[number]

export const MARKET_CANYON_VARIANTS = ['lower', 'antelope_x', 'unspecified'] as const
export type MarketCanyonVariant = (typeof MARKET_CANYON_VARIANTS)[number]

export const MARKET_OFFER_TYPES = ['all_inclusive', 'sale_plus_excluded', 'listing_from'] as const
export type MarketOfferType = (typeof MARKET_OFFER_TYPES)[number]

export const MARKET_FETCH_STATUSES = [
  'ok',
  'needs_manual',
  'parse_failed',
  'http_error',
  'never',
] as const
export type MarketFetchStatus = (typeof MARKET_FETCH_STATUSES)[number]

export const MARKET_SNAPSHOT_SOURCES = ['auto', 'manual'] as const
export type MarketSnapshotSource = (typeof MARKET_SNAPSHOT_SOURCES)[number]

export const MARKET_ALERT_KINDS = ['price_changed', 'fetch_failed', 'stale'] as const
export type MarketAlertKind = (typeof MARKET_ALERT_KINDS)[number]

export const MARKET_PRICE_AXES = [
  { canyon: 'unspecified', offer: 'listing_from' },
  { canyon: 'lower', offer: 'all_inclusive' },
  { canyon: 'lower', offer: 'sale_plus_excluded' },
  { canyon: 'antelope_x', offer: 'all_inclusive' },
  { canyon: 'antelope_x', offer: 'sale_plus_excluded' },
] as const satisfies ReadonlyArray<{ canyon: MarketCanyonVariant; offer: MarketOfferType }>

export type MarketPriceAxis = (typeof MARKET_PRICE_AXES)[number]

export type MarketCompetitor = {
  id: string
  operator_id: string
  name: string
  website_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MarketListing = {
  id: string
  operator_id: string
  competitor_id: string
  ota_platform: MarketOtaPlatform
  listing_url: string
  listing_title: string | null
  mapped_product_id: string | null
  mapped_channel_id: string | null
  has_lower: boolean
  has_antelope_x: boolean
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
  watch_enabled: boolean
  last_fetch_status: MarketFetchStatus
  last_fetched_at: string | null
  last_success_at: string | null
  last_fetch_error: string | null
  duration_note: string | null
  pickup_note: string | null
  group_size_note: string | null
  cancellation_note: string | null
  language_note: string | null
  itinerary_note: string | null
  diff_notes: string | null
  inclusion_items: MarketInclusionMap
  created_at: string
  updated_at: string
}

export type MarketExcludedItem = {
  id: string
  label: string
  amount: number
}

export type MarketInclusionStatus = 'included' | 'excluded'
export type MarketInclusionMap = Record<string, MarketInclusionStatus>

export type MarketListingBadge = {
  id: string
  label: string
}

export type MarketBadgeCatalogItem = {
  operator_id: string
  badge_id: string
  label_ko: string
  label_en: string
  sort_order: number
  is_preset: boolean
  created_at: string
}

export type MarketCompareItemCatalog = {
  operator_id: string
  item_id: string
  label_ko: string
  label_en: string
  sort_order: number
  is_preset: boolean
  created_at: string
}

export type MarketOurOffer = {
  operator_id: string
  product_id: string
  ota_platform: MarketOtaPlatform
  inclusion_items: MarketInclusionMap
  excluded_items: MarketExcludedItem[]
  created_at: string
  updated_at: string
}

export type MarketSnapshot = {
  id: string
  operator_id: string
  listing_id: string
  observed_on: string
  source: MarketSnapshotSource
  canyon_variant: MarketCanyonVariant
  offer_type: MarketOfferType
  currency: string
  adult_sale_price: number
  discount_enabled?: boolean
  discount_percent?: number
  adult_discounted_price?: number | null
  adult_not_included: number
  adult_total: number
  child_sale_price: number | null
  child_not_included: number | null
  rating: number | null
  review_count: number | null
  badges: MarketListingBadge[]
  excluded_items: MarketExcludedItem[]
  raw_extract: Record<string, unknown>
  created_at: string
}

export type MarketPriceAlert = {
  id: string
  operator_id: string
  listing_id: string | null
  kind: MarketAlertKind
  title: string
  body: string
  canyon_variant: string | null
  offer_type: string | null
  old_adult_total: number | null
  new_adult_total: number | null
  created_at: string
}

export type MarketFocusProduct = {
  operator_id: string
  product_id: string
  sort_order: number
  created_at: string
}

export type MarketCatalogProduct = {
  id: string
  name: string | null
  name_ko: string | null
  name_en: string | null
}

export type MarketCatalogChannel = {
  id: string
  name: string | null
}

export type OurPricePoint = {
  sale: number | null
  discounted?: number | null
  discountPercent?: number | null
  notIncluded: number | null
  total: number | null
  source: 'dynamic' | 'choice' | 'product' | 'none'
}

export type OurPriceOverlay = {
  productId: string | null
  channelId: string | null
  date: string | null
  points: Record<string, OurPricePoint>
}

export function marketPriceAxisKey(
  canyon: MarketCanyonVariant,
  offer: MarketOfferType
): string {
  return `${canyon}:${offer}`
}

export function isMarketOtaPlatform(value: string): value is MarketOtaPlatform {
  return (MARKET_OTA_PLATFORMS as readonly string[]).includes(value)
}

export function isMarketCanyonVariant(value: string): value is MarketCanyonVariant {
  return (MARKET_CANYON_VARIANTS as readonly string[]).includes(value)
}

export function isMarketOfferType(value: string): value is MarketOfferType {
  return (MARKET_OFFER_TYPES as readonly string[]).includes(value)
}
