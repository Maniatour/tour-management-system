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
import { inferAutoSnapshotAxis, isListingStale, pricesChanged } from './prices'
import type { MarketListing, MarketSnapshot } from './types'

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

async function loadWatchedListings(operatorId: string, listingId?: string): Promise<MarketListing[]> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  let query = fromUntypedTable(supabaseAdmin, MARKET_LISTINGS_TABLE)
    .select(MARKET_LISTING_COLUMNS)
    .eq('operator_id', operatorId)
    .eq('watch_enabled', true)
    .order('created_at', { ascending: true })
  if (listingId) query = query.eq('id', listingId)
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
  rating?: number | null | undefined
  reviewCount?: number | null | undefined
  rawExtract?: Record<string, unknown> | undefined
}): Promise<MarketSnapshot | null> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
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
        adult_not_included: input.notIncluded,
        rating: input.rating ?? null,
        review_count: input.reviewCount ?? null,
        raw_extract: input.rawExtract || {},
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
  rating?: number | null | undefined
  reviewCount?: number | null | undefined
}): Promise<{ snapshot: MarketSnapshot; changed: boolean }> {
  const operatorId = resolveOperatorId(input.operatorId)
  const observedOn = input.observedOn || todayInLasVegas()
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
    notIncluded: input.notIncluded ?? 0,
    rating: input.rating,
    reviewCount: input.reviewCount,
    rawExtract: { source: 'manual' },
  })
  if (!snapshot) throw new Error('snapshot save failed')

  const changed = pricesChanged(
    prev
      ? { sale: prev.adult_sale_price, notIncluded: prev.adult_not_included }
      : null,
    { sale: input.sale, notIncluded: input.notIncluded ?? 0 }
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
      const axis = inferAutoSnapshotAxis(listing)
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
        last_fetch_status: axis.needsManualSplit || changed ? 'needs_manual' : 'ok',
        last_fetched_at: fetchedAt,
        last_success_at: fetchedAt,
        last_fetch_error: axis.needsManualSplit ? 'multiple_price_axes' : null,
        listing_title: listing.listing_title || result.offer.title,
      })
      if (changed && prev && snapshot) {
        await insertMarketPriceAlert(supabaseAdmin, {
          operatorId,
          listingId: listing.id,
          kind: 'price_changed',
          title: '경쟁사 가격 변경',
          body: `${listing.listing_title || result.offer.title || listing.listing_url}\n$${prev.adult_total} → $${snapshot.adult_total}`,
          canyonVariant: axis.canyon,
          offerType: axis.offer,
          oldAdultTotal: prev.adult_total,
          newAdultTotal: snapshot.adult_total,
        })
      } else if (axis.needsManualSplit && listing.last_fetch_status !== 'needs_manual') {
        await insertMarketPriceAlert(supabaseAdmin, {
          operatorId,
          listingId: listing.id,
          kind: 'fetch_failed',
          title: '경쟁사 가격 수동 확인',
          body: `${listing.listing_title || result.offer.title || listing.listing_url}\nFrom $${result.offer.price} — Lower/X 또는 포함가 구분이 필요해 수동 확인하세요.`,
        })
      }
    }

    const successAt = result.ok ? fetchedAt : listing.last_success_at
    if (!result.ok && isListingStale(successAt, now, 2) && listing.last_fetch_status !== 'never') {
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
