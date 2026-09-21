export const MARKET_COMPETITORS_TABLE = 'market_competitors'
export const MARKET_LISTINGS_TABLE = 'market_competitor_listings'
export const MARKET_SNAPSHOTS_TABLE = 'market_competitor_price_snapshots'
export const MARKET_ALERTS_TABLE = 'market_competitor_price_alerts'
export const MARKET_FOCUS_PRODUCTS_TABLE = 'market_research_focus_products'
export const MARKET_BADGES_TABLE = 'market_research_badges'
export const MARKET_COMPARE_ITEMS_TABLE = 'market_research_compare_items'
export const MARKET_OUR_OFFERS_TABLE = 'market_research_our_offers'

export const MARKET_COMPETITOR_COLUMNS =
  'id, operator_id, name, website_url, notes, is_active, created_at, updated_at'

export const MARKET_LISTING_COLUMNS = [
  'id',
  'operator_id',
  'competitor_id',
  'ota_platform',
  'listing_url',
  'listing_title',
  'mapped_product_id',
  'mapped_channel_id',
  'has_lower',
  'has_antelope_x',
  'has_all_inclusive',
  'has_sale_plus_excluded',
  'watch_enabled',
  'last_fetch_status',
  'last_fetched_at',
  'last_success_at',
  'last_fetch_error',
  'duration_note',
  'pickup_note',
  'group_size_note',
  'cancellation_note',
  'language_note',
  'itinerary_note',
  'diff_notes',
  'inclusion_items',
  'created_at',
  'updated_at',
].join(', ')

export const MARKET_SNAPSHOT_COLUMNS = [
  'id',
  'operator_id',
  'listing_id',
  'observed_on',
  'source',
  'canyon_variant',
  'offer_type',
  'currency',
  'adult_sale_price',
  'discount_enabled',
  'discount_percent',
  'adult_discounted_price',
  'adult_not_included',
  'adult_total',
  'child_sale_price',
  'child_not_included',
  'rating',
  'review_count',
  'raw_extract',
  'created_at',
].join(', ')

export const MARKET_ALERT_COLUMNS = [
  'id',
  'operator_id',
  'listing_id',
  'kind',
  'title',
  'body',
  'canyon_variant',
  'offer_type',
  'old_adult_total',
  'new_adult_total',
  'created_at',
].join(', ')

export const MARKET_FOCUS_PRODUCT_COLUMNS = 'operator_id, product_id, sort_order, created_at'

export const MARKET_BADGE_COLUMNS =
  'operator_id, badge_id, label_ko, label_en, sort_order, is_preset, created_at'

export const MARKET_COMPARE_ITEM_COLUMNS =
  'operator_id, item_id, label_ko, label_en, sort_order, is_preset, created_at'

export const MARKET_OUR_OFFER_COLUMNS =
  'operator_id, product_id, ota_platform, inclusion_items, excluded_items, channel_settings, created_at, updated_at'
