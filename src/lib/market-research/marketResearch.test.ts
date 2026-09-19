import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adultTotal,
  inferAutoSnapshotAxis,
  isListingStale,
  priceDelta,
  pricesChanged,
  roundMoney,
} from './prices'
import { parseListingHtml } from './parseListing'
import { buildOtaCompareRows, compareGridCsv } from './compare'
import type { MarketListing, MarketSnapshot, OurPriceOverlay } from './types'

test('adultTotal adds sale and not-included', () => {
  assert.equal(adultTotal(199, 80), 279)
  assert.equal(adultTotal(199, null), 199)
  assert.equal(adultTotal(null, null), null)
  assert.equal(roundMoney(10.129), 10.13)
})

test('pricesChanged ignores first observation', () => {
  assert.equal(pricesChanged(null, { sale: 199, notIncluded: 0 }), false)
  assert.equal(pricesChanged({ sale: 199, notIncluded: 80 }, { sale: 199, notIncluded: 80 }), false)
  assert.equal(pricesChanged({ sale: 199, notIncluded: 80 }, { sale: 209, notIncluded: 80 }), true)
})

test('priceDelta vs our price', () => {
  assert.deepEqual(priceDelta(200, 220), { amount: 20, percent: 10 })
  assert.deepEqual(priceDelta(null, 220), { amount: null, percent: null })
})

test('inferAutoSnapshotAxis uses unspecified when both canyons exist', () => {
  const both = inferAutoSnapshotAxis({
    has_lower: true,
    has_antelope_x: true,
    has_all_inclusive: true,
    has_sale_plus_excluded: true,
  })
  assert.equal(both.canyon, 'unspecified')
  assert.equal(both.offer, 'all_inclusive')
  assert.equal(both.needsManualSplit, true)

  const lowerOnly = inferAutoSnapshotAxis({
    has_lower: true,
    has_antelope_x: false,
    has_all_inclusive: false,
    has_sale_plus_excluded: true,
  })
  assert.equal(lowerOnly.canyon, 'lower')
  assert.equal(lowerOnly.offer, 'sale_plus_excluded')
  assert.equal(lowerOnly.needsManualSplit, false)
})

test('isListingStale after two days', () => {
  const now = new Date('2026-09-18T18:00:00.000Z')
  assert.equal(isListingStale(null, now), true)
  assert.equal(isListingStale('2026-09-18T10:00:00.000Z', now, 2), false)
  assert.equal(isListingStale('2026-09-15T10:00:00.000Z', now, 2), true)
})

test('parseListingHtml reads JSON-LD AggregateOffer and rating', () => {
  const html = `<html><script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    name: 'Grand Canyon Sunrise',
    aggregateRating: { ratingValue: '4.8', reviewCount: '321' },
    offers: { '@type': 'AggregateOffer', lowPrice: '219.00', priceCurrency: 'USD' },
  })}</script></html>`
  const parsed = parseListingHtml(html)
  assert.equal(parsed?.title, 'Grand Canyon Sunrise')
  assert.equal(parsed?.price, 219)
  assert.equal(parsed?.currency, 'USD')
  assert.equal(parsed?.rating, 4.8)
  assert.equal(parsed?.reviewCount, 321)
})

test('parseListingHtml returns null without offer', () => {
  assert.equal(parseListingHtml('<html><body>no ld</body></html>'), null)
})

test('buildOtaCompareRows fills latest snapshot and our overlay delta', () => {
  const listing: MarketListing = {
    id: 'L1',
    operator_id: 'op',
    competitor_id: 'C1',
    ota_platform: 'viator',
    listing_url: 'https://example.com/p',
    listing_title: 'Rival sunrise',
    mapped_product_id: 'MDGCSUNRISE',
    mapped_channel_id: 'viator',
    has_lower: true,
    has_antelope_x: true,
    has_all_inclusive: true,
    has_sale_plus_excluded: true,
    watch_enabled: true,
    last_fetch_status: 'ok',
    last_fetched_at: null,
    last_success_at: null,
    last_fetch_error: null,
    duration_note: null,
    pickup_note: null,
    group_size_note: null,
    cancellation_note: null,
    language_note: null,
    itinerary_note: null,
    diff_notes: '픽업 미포함',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }
  const snapshots: MarketSnapshot[] = [
    {
      id: 's1',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-17',
      source: 'manual',
      canyon_variant: 'lower',
      offer_type: 'all_inclusive',
      currency: 'USD',
      adult_sale_price: 220,
      adult_not_included: 0,
      adult_total: 220,
      child_sale_price: null,
      child_not_included: null,
      rating: 4.7,
      review_count: 10,
      raw_extract: {},
      created_at: '2026-09-17T00:00:00.000Z',
    },
  ]
  const our: Record<string, OurPriceOverlay> = {
    L1: {
      productId: 'MDGCSUNRISE',
      channelId: 'viator',
      date: '2026-09-18',
      points: {
        'lower:all_inclusive': { sale: 200, notIncluded: 0, total: 200, source: 'dynamic' },
      },
    },
  }
  const rows = buildOtaCompareRows([listing], snapshots, our)
  const lowerInclusive = rows.find((row) => row.axisKey === 'lower:all_inclusive')
  assert.ok(lowerInclusive)
  assert.equal(lowerInclusive?.cells.L1.total, 220)
  assert.equal(lowerInclusive?.cells.L1.ourTotal, 200)
  assert.equal(lowerInclusive?.cells.L1.deltaAmount, 20)
  const csv = compareGridCsv(rows, [{ id: 'L1', label: 'Rival' }], true)
  assert.match(csv, /Lower · 전체포함/)
  assert.match(csv, /220/)
})
