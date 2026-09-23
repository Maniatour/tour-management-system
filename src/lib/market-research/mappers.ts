import type {
  MarketCatalogChannel,
  MarketCatalogProduct,
  MarketCompetitor,
  MarketFetchStatus,
  MarketListing,
  MarketOtaPlatform,
  MarketSnapshot,
} from './types'
import { isMarketCanyonVariant, isMarketOfferType, isStoredOtaPlatform } from './types'
import {
  parseExcludedItems,
  parseInclusionMap,
  sumExcludedItems,
  type MarketCompareItemDef,
} from './excludedItems'
import { parseListingBadges } from './badges'
import { parseSnapshotDiscount } from './prices'
import { parseOurChannelSettings } from './ourChannelSettings'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function mapMarketCompetitor(row: Record<string, unknown>): MarketCompetitor | null {
  const id = asString(row.id)
  const name = asString(row.name)
  const createdAt = asString(row.created_at)
  const updatedAt = asString(row.updated_at)
  if (!id || !name || !createdAt || !updatedAt) return null
  return {
    id,
    operator_id: asString(row.operator_id) || '',
    name,
    website_url: asString(row.website_url),
    notes: asString(row.notes),
    is_active: asBool(row.is_active, true),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

export function mapMarketListing(
  row: Record<string, unknown>,
  items?: readonly MarketCompareItemDef[] | null
): MarketListing | null {
  const id = asString(row.id)
  const competitorId = asString(row.competitor_id)
  const url = asString(row.listing_url)
  const platform = asString(row.ota_platform)
  const createdAt = asString(row.created_at)
  const updatedAt = asString(row.updated_at)
  if (!id || !competitorId || !url || !platform || !isStoredOtaPlatform(platform) || !createdAt || !updatedAt) {
    return null
  }
  const status = asString(row.last_fetch_status) || 'never'
  const fetchStatus: MarketFetchStatus =
    status === 'ok' ||
    status === 'needs_manual' ||
    status === 'parse_failed' ||
    status === 'http_error' ||
    status === 'never'
      ? status
      : 'never'
  return {
    id,
    operator_id: asString(row.operator_id) || '',
    competitor_id: competitorId,
    ota_platform: platform as MarketOtaPlatform,
    listing_url: url,
    listing_title: asString(row.listing_title),
    mapped_product_id: asString(row.mapped_product_id),
    mapped_channel_id: asString(row.mapped_channel_id),
    has_lower: asBool(row.has_lower, true),
    has_antelope_x: asBool(row.has_antelope_x, true),
    has_all_inclusive: asBool(row.has_all_inclusive, true),
    has_sale_plus_excluded: asBool(row.has_sale_plus_excluded, true),
    watch_enabled: asBool(row.watch_enabled, true),
    last_fetch_status: fetchStatus,
    last_fetched_at: asString(row.last_fetched_at),
    last_success_at: asString(row.last_success_at),
    last_fetch_error: asString(row.last_fetch_error),
    duration_note: asString(row.duration_note),
    pickup_note: asString(row.pickup_note),
    group_size_note: asString(row.group_size_note),
    cancellation_note: asString(row.cancellation_note),
    language_note: asString(row.language_note),
    itinerary_note: asString(row.itinerary_note),
    diff_notes: asString(row.diff_notes),
    inclusion_items: parseInclusionMap(
      row.inclusion_items,
      !(asBool(row.has_sale_plus_excluded, false) && !asBool(row.has_all_inclusive, true)),
      items
    ),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

export function mapMarketSnapshot(row: Record<string, unknown>): MarketSnapshot | null {
  const id = asString(row.id)
  const listingId = asString(row.listing_id)
  const observedOn = asString(row.observed_on)
  const canyon = asString(row.canyon_variant)
  const offer = asString(row.offer_type)
  const source = asString(row.source)
  const createdAt = asString(row.created_at)
  const sale = asNumber(row.adult_sale_price)
  if (
    !id ||
    !listingId ||
    !observedOn ||
    !canyon ||
    !offer ||
    !createdAt ||
    sale == null ||
    !isMarketCanyonVariant(canyon) ||
    !isMarketOfferType(offer) ||
    (source !== 'auto' && source !== 'manual')
  ) {
    return null
  }
  const raw = row.raw_extract
  const rawExtract = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const excludedItems = parseExcludedItems(rawExtract)
  const notIncluded =
    asNumber(row.adult_not_included) ?? (excludedItems.length ? sumExcludedItems(excludedItems) : 0)
  const total = asNumber(row.adult_total) ?? sale + notIncluded
  const discount = parseSnapshotDiscount(row, rawExtract)
  return {
    id,
    operator_id: asString(row.operator_id) || '',
    listing_id: listingId,
    observed_on: observedOn.slice(0, 10),
    source,
    canyon_variant: canyon,
    offer_type: offer,
    currency: asString(row.currency) || 'USD',
    adult_sale_price: sale,
    discount_enabled: discount.enabled,
    discount_percent: discount.percent,
    adult_discounted_price: discount.discounted,
    adult_not_included: notIncluded,
    adult_total: total,
    child_sale_price: asNumber(row.child_sale_price),
    child_not_included: asNumber(row.child_not_included),
    rating: asNumber(row.rating),
    review_count: asNumber(row.review_count),
    badges: parseListingBadges(rawExtract),
    excluded_items: excludedItems,
    raw_extract: rawExtract,
    created_at: createdAt,
  }
}

export function mapCatalogProduct(row: Record<string, unknown>): MarketCatalogProduct | null {
  const id = asString(row.id)
  if (!id) return null
  return {
    id,
    name: asString(row.name),
    name_ko: asString(row.name_ko),
    name_en: asString(row.name_en),
  }
}

export function mapCatalogChannel(row: Record<string, unknown>): MarketCatalogChannel | null {
  const id = asString(row.id)
  if (!id) return null
  return {
    id,
    name: asString(row.name),
    type: asString(row.type),
    category: asString(row.category),
    status: asString(row.status),
  }
}

export function mapFocusProduct(row: Record<string, unknown>): import('./types').MarketFocusProduct | null {
  const productId = asString(row.product_id)
  const createdAt = asString(row.created_at)
  if (!productId || !createdAt) return null
  return {
    operator_id: asString(row.operator_id) || '',
    product_id: productId,
    sort_order: asNumber(row.sort_order) ?? 0,
    created_at: createdAt,
  }
}

export function mapMarketBadge(row: Record<string, unknown>): import('./types').MarketBadgeCatalogItem | null {
  const badgeId = asString(row.badge_id)
  const labelKo = asString(row.label_ko)
  const labelEn = asString(row.label_en)
  const createdAt = asString(row.created_at)
  if (!badgeId || !labelKo || !labelEn || !createdAt) return null
  return {
    operator_id: asString(row.operator_id) || '',
    badge_id: badgeId,
    label_ko: labelKo,
    label_en: labelEn,
    sort_order: asNumber(row.sort_order) ?? 0,
    is_preset: asBool(row.is_preset, false),
    created_at: createdAt,
  }
}

export function mapMarketCompareItem(row: Record<string, unknown>): import('./types').MarketCompareItemCatalog | null {
  const itemId = asString(row.item_id)
  const labelKo = asString(row.label_ko)
  const labelEn = asString(row.label_en)
  const createdAt = asString(row.created_at)
  if (!itemId || !labelKo || !labelEn || !createdAt) return null
  return {
    operator_id: asString(row.operator_id) || '',
    item_id: itemId,
    label_ko: labelKo,
    label_en: labelEn,
    sort_order: asNumber(row.sort_order) ?? 0,
    is_preset: asBool(row.is_preset, false),
    created_at: createdAt,
  }
}

export function mapMarketOurOffer(
  row: Record<string, unknown>,
  items?: readonly MarketCompareItemDef[] | null
): import('./types').MarketOurOffer | null {
  const productId = asString(row.product_id)
  const platform = asString(row.ota_platform)
  const createdAt = asString(row.created_at)
  const updatedAt = asString(row.updated_at)
  if (!productId || !platform || !isStoredOtaPlatform(platform) || !createdAt || !updatedAt) return null
  return {
    operator_id: asString(row.operator_id) || '',
    product_id: productId,
    ota_platform: platform as MarketOtaPlatform,
    inclusion_items: parseInclusionMap(row.inclusion_items, true, items),
    excluded_items: parseExcludedItems(row.excluded_items),
    channel_settings: parseOurChannelSettings(row.channel_settings),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}
