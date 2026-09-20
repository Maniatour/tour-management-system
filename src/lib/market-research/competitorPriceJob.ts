import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { delay, fetchPublicListing } from './fetchListing'
import { insertMarketPriceAlert } from './notify'
import { mapMarketListing, mapMarketSnapshot } from './mappers'
import {
  MARKET_LISTING_COLUMNS,
  MARKET_LISTINGS_TABLE,
  MARKET_SNAPSHOT_COLUMNS,
  MARKET_SNAPSHOTS_TABLE,
} from './tables'
import { inferAutoSnapshotAxis, isListingStale, pricesChanged, serializeSnapshotDiscount } from './prices'
import { serializeExcludedItems, sumExcludedItems } from './excludedItems'
import { parseListingBadges, serializeListingBadges } from './badges'
import type { MarketListing, MarketListingBadge, MarketSnapshot } from './types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const FETCH_GAP_MS = 1500

export type CompetitorPriceCheckSummary = {
  checked: number
  saved: number
  changed: number
  failed: number
  stale: number
}

async function loadWatchedListings(operatorId: string, listingId?: string | undefined): Promise<MarketListing[]> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  let query = fromUntypedTable(supabaseAdmin, MARKET_LISTINGS_TABLE)
    .select(MARKET_LISTING_COLUMNS)
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: true })
  if (listingId) query = query.eq('id', listingId)
  else query = query.eq('watch_enabled', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) => mapMarketListing(asRecord(row)))
    .filter((row): row is MarketListing => row != null)
}

async function loadPreviousSnapshot(
  listingId: string,
  canyon: MarketSnapshot['canyon_variant'],
  offer: MarketSnapshot['offer_type']
): Promise<MarketSnapshot | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await fromUntypedTable(supabaseAdmin, MARKET_SNAPSHOTS_TABLE)
    .select(MARKET_SNAPSHOT_COLUMNS)
    .eq('listing_id', listingId)
    .eq('canyon_variant', canyon)
    .eq('offer_type', offer)
    .order('observed_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  if (error || !Array.isArray(data) || !data[0]) return null
  return mapMarketSnapshot(asRecord(data[0]))
}

async function upsertSnapshot(input: {
  operatorId: string
  listingId: string
  observedOn: string
  source: 'auto' | 'manual'
  canyon: MarketSnapshot['canyon_variant']
  offer: MarketSnapshot['offer_type']
  currency: string
  sale: number
  notIncluded: number
  discountEnabled?: boolean | undefined
  discountPercent?: number | undefined
  rating?: number | null | undefined
  reviewCount?: number | null | undefined
  badges?: MarketListingBadge[] | undefined
  rawExtract?: Record<string, unknown> | undefined
  excludedItems?: MarketSnapshot['excluded_items'] | undefined
}): Promise<MarketSnapshot | null> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  const excludedItems = serializeExcludedItems(input.excludedItems || [])
  const badges = input.badges !== undefined ? serializeListingBadges(input.badges) : parseListingBadges(input.rawExtract)
  const discount = serializeSnapshotDiscount({
    enabled: Boolean(input.discountEnabled),
    percent: input.discountPercent ?? 0,
    list: input.sale,
  })
  const rawExtract = {
    ...(input.rawExtract || {}),
    ...(excludedItems.length ? { excludedItems } : {}),
    ...(badges.length ? { badges } : {}),
    ...(discount.enabled ? { discount: discount.raw } : {}),
  }
  const { data, error } = await fromUntypedTable(supabaseAdmin, MARKET_SNAPSHOTS_TABLE)
    .upsert(
      {
        operator_id: input.operatorId,
        listing_id: input.listingId,
        observed_on: input.observedOn,
        source: input.source,
        canyon_variant: input.canyon,
        offer_type: input.offer,
        currency: input.currency,
        adult_sale_price: input.sale,
        discount_enabled: discount.enabled,
        discount_percent: discount.percent,
        adult_discounted_price: discount.discounted,
        adult_not_included: input.notIncluded,
        rating: input.rating ?? null,
        review_count: input.reviewCount ?? null,
        raw_extract: rawExtract,
      } as never,
      { onConflict: 'listing_id,observed_on,canyon_variant,offer_type' }
    )
    .select(MARKET_SNAPSHOT_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null
  return mapMarketSnapshot(asRecord(data))
}

async function updateListingFetch(
  listingId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (!supabaseAdmin) return
  const { error } = await fromUntypedTable(supabaseAdmin, MARKET_LISTINGS_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq('id', listingId)
  if (error) throw new Error(error.message)
}

export async function saveManualSnapshot(input: {
  operatorId?: string | null | undefined
  listingId: string
  observedOn?: string | undefined
  canyon: MarketSnapshot['canyon_variant']
  offer: MarketSnapshot['offer_type']
  currency?: string | undefined
  sale: number
  notIncluded?: number | undefined
  discountEnabled?: boolean | undefined
  discountPercent?: number | undefined
  rating?: number | null | undefined
  reviewCount?: number | null | undefined
  badges?: MarketListingBadge[] | undefined
  excludedItems?: MarketSnapshot['excluded_items'] | undefined
}): Promise<{ snapshot: MarketSnapshot; changed: boolean }> {
  const operatorId = resolveOperatorId(input.operatorId)
  const observedOn = input.observedOn || todayInLasVegas()
  const excludedItems = serializeExcludedItems(input.excludedItems || [])
  const badges = serializeListingBadges(input.badges || [])
  const notIncluded =
    excludedItems.length > 0 ? sumExcludedItems(excludedItems) : input.notIncluded ?? 0
  const prev = await loadPreviousSnapshot(input.listingId, input.canyon, input.offer)
  const snapshot = await upsertSnapshot({
    operatorId,
    listingId: input.listingId,
    observedOn,
    source: 'manual',
    canyon: input.canyon,
    offer: input.offer,
    currency: input.currency || 'USD',
    sale: input.sale,
    notIncluded,
    discountEnabled: input.discountEnabled,
    discountPercent: input.discountPercent,
    rating: input.rating,
    reviewCount: input.reviewCount,
    badges,
    excludedItems,
    rawExtract: { source: 'manual' },
  })
  if (!snapshot) throw new Error('snapshot save failed')

  const changed = pricesChanged(
    prev
      ? { sale: prev.adult_sale_price, notIncluded: prev.adult_not_included }
      : null,
    { sale: input.sale, notIncluded }
  )
  await updateListingFetch(input.listingId, {
    last_fetch_status: 'ok',
    last_fetched_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_fetch_error: null,
  })
  if (changed && prev) {
    await insertMarketPriceAlert(supabaseAdmin, {
      operatorId,
      listingId: input.listingId,
      kind: 'price_changed',
      title: '경쟁사 가격 변경',
      body: `수동 입력: $${prev.adult_total} → $${snapshot.adult_total}`,
      canyonVariant: input.canyon,
      offerType: input.offer,
      oldAdultTotal: prev.adult_total,
      newAdultTotal: snapshot.adult_total,
    })
  }
  return { snapshot, changed }
}

export async function saveTodayPrices(input: {
  operatorId?: string | null | undefined
  listingId: string
  fromPrice?: number | null | undefined
  lowerSale?: number | null | undefined
  antelopeXSale?: number | null | undefined
  lowerNotIncluded?: number | null | undefined
  antelopeXNotIncluded?: number | null | undefined
  lowerExcludedItems?: MarketSnapshot['excluded_items'] | undefined
  antelopeXExcludedItems?: MarketSnapshot['excluded_items'] | undefined
  discountEnabled?: boolean | undefined
  discountPercent?: number | undefined
  rating?: number | null | undefined
  reviewCount?: number | null | undefined
  badges?: MarketListingBadge[] | undefined
  offer?: MarketSnapshot['offer_type'] | undefined
}): Promise<{ saved: number }> {
  const listingId = input.listingId.trim()
  if (!listingId) throw new Error('listingId required')
  const lowerItems = serializeExcludedItems(input.lowerExcludedItems || [])
  const antelopeXItems = serializeExcludedItems(input.antelopeXExcludedItems || [])
  const hasExcluded =
    lowerItems.length > 0 ||
    antelopeXItems.length > 0 ||
    (input.lowerNotIncluded != null && input.lowerNotIncluded > 0) ||
    (input.antelopeXNotIncluded != null && input.antelopeXNotIncluded > 0)
  const optionOffer =
    input.offer === 'sale_plus_excluded' || hasExcluded ? 'sale_plus_excluded' : 'all_inclusive'
  const points: Array<{
    canyon: MarketSnapshot['canyon_variant']
    offer: MarketSnapshot['offer_type']
    sale: number
    notIncluded: number
    excludedItems: MarketSnapshot['excluded_items']
  }> = []
  if (input.fromPrice != null && Number.isFinite(input.fromPrice)) {
    points.push({
      canyon: 'unspecified',
      offer: 'listing_from',
      sale: input.fromPrice,
      notIncluded: 0,
      excludedItems: [],
    })
  }
  if (input.lowerSale != null && Number.isFinite(input.lowerSale)) {
    points.push({
      canyon: 'lower',
      offer: optionOffer,
      sale: input.lowerSale,
      notIncluded:
        optionOffer === 'sale_plus_excluded'
          ? lowerItems.length
            ? sumExcludedItems(lowerItems)
            : input.lowerNotIncluded || 0
          : 0,
      excludedItems: optionOffer === 'sale_plus_excluded' ? lowerItems : [],
    })
  }
  if (input.antelopeXSale != null && Number.isFinite(input.antelopeXSale)) {
    points.push({
      canyon: 'antelope_x',
      offer: optionOffer,
      sale: input.antelopeXSale,
      notIncluded:
        optionOffer === 'sale_plus_excluded'
          ? antelopeXItems.length
            ? sumExcludedItems(antelopeXItems)
            : input.antelopeXNotIncluded || 0
          : 0,
      excludedItems: optionOffer === 'sale_plus_excluded' ? antelopeXItems : [],
    })
  }
  if (points.length === 0) throw new Error('at least one price required')
  for (const point of points) {
    await saveManualSnapshot({
      operatorId: input.operatorId,
      listingId,
      canyon: point.canyon,
      offer: point.offer,
      sale: point.sale,
      notIncluded: point.notIncluded,
      excludedItems: point.excludedItems,
      discountEnabled: input.discountEnabled,
      discountPercent: input.discountPercent,
      rating: input.rating,
      reviewCount: input.reviewCount,
      badges: input.badges,
    })
  }
  return { saved: points.length }
}

export async function runCompetitorPriceCheck(input: {
  operatorId?: string | null | undefined
  listingId?: string | undefined
}): Promise<CompetitorPriceCheckSummary> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  const operatorId = resolveOperatorId(input.operatorId)
  const listings = await loadWatchedListings(operatorId, input.listingId)
  const today = todayInLasVegas()
  const now = new Date()
  const summary: CompetitorPriceCheckSummary = {
    checked: listings.length,
    saved: 0,
    changed: 0,
    failed: 0,
    stale: 0,
  }

  for (const listing of listings) {
    const fetchedAt = new Date().toISOString()
    const result = await fetchPublicListing(listing.listing_url)
    if (!result.ok) {
      summary.failed += 1
      const status = result.reason === 'parse_failed' ? 'parse_failed' : 'http_error'
      const prevStatus = listing.last_fetch_status
      await updateListingFetch(listing.id, {
        last_fetch_status: status,
        last_fetched_at: fetchedAt,
        last_fetch_error: result.message,
      })
      if (prevStatus === 'ok' || prevStatus === 'never' || prevStatus === 'needs_manual') {
        await insertMarketPriceAlert(supabaseAdmin, {
          operatorId,
          listingId: listing.id,
          kind: 'fetch_failed',
          title: '경쟁사 가격 수집 실패',
          body: `${listing.listing_title || listing.listing_url}\n${result.message}`,
        })
      }
    } else {
      const axis = inferAutoSnapshotAxis()
      const prev = await loadPreviousSnapshot(listing.id, axis.canyon, axis.offer)
      const snapshot = await upsertSnapshot({
        operatorId,
        listingId: listing.id,
        observedOn: today,
        source: 'auto',
        canyon: axis.canyon,
        offer: axis.offer,
        currency: result.offer.currency,
        sale: result.offer.price,
        notIncluded: axis.offer === 'sale_plus_excluded' ? 0 : 0,
        rating: result.offer.rating,
        reviewCount: result.offer.reviewCount,
        rawExtract: {
          title: result.offer.title,
          adapter: 'jsonld',
          badges: prev?.badges || [],
        },
      })
      summary.saved += 1
      const changed = pricesChanged(
        prev
          ? { sale: prev.adult_sale_price, notIncluded: prev.adult_not_included }
          : null,
        { sale: result.offer.price, notIncluded: 0 }
      )
      if (changed) summary.changed += 1
      await updateListingFetch(listing.id, {
        last_fetch_status: 'ok',
        last_fetched_at: fetchedAt,
        last_success_at: fetchedAt,
        last_fetch_error: null,
        listing_title: listing.listing_title || result.offer.title,
      })
      if (changed && prev && snapshot) {
        await insertMarketPriceAlert(supabaseAdmin, {
          operatorId,
          listingId: listing.id,
          kind: 'price_changed',
          title: '경쟁사 가격 변경',
          body: `${listing.listing_title || result.offer.title || listing.listing_url}\nFrom $${prev.adult_total} → $${snapshot.adult_total}`,
          canyonVariant: axis.canyon,
          offerType: axis.offer,
          oldAdultTotal: prev.adult_total,
          newAdultTotal: snapshot.adult_total,
        })
      }
    }

    if (
      !result.ok &&
      listing.last_success_at &&
      isListingStale(listing.last_success_at, now, 2)
    ) {
      summary.stale += 1
      await insertMarketPriceAlert(supabaseAdmin, {
        operatorId,
        listingId: listing.id,
        kind: 'stale',
        title: '경쟁사 시세 오래됨',
        body: `${listing.listing_title || listing.listing_url}\n최근 성공 수집이 2일을 넘었습니다.`,
      })
    }

    await delay(FETCH_GAP_MS)
  }

  return summary
}


