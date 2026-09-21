import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adultTotal,
  discountedPrice,
  inferAutoSnapshotAxis,
  isListingStale,
  listingRecordedPrices,
  priceDelta,
  pricesChanged,
  roundMoney,
} from './prices'
import { parseListingHtml } from './parseListing'
import { buildOtaCompareRows, compareGridCsv, compareRowLabel } from './compare'
import { buildOurPricingBoardColumns, buildPricingBoardColumns, cellValue, pricingBoardRows, toggleAllOrItem } from './pricingBoard'
import {
  inferExcludedItemId,
  parseExcludedItems,
  parseInclusionMap,
  inclusionHasExcluded,
  sumExcludedItems,
} from './excludedItems'
import { formatListingLanguages, parseListingLanguages } from './listingLanguages'
import {
  canyonOtaSaleFromChoices,
  overlayFromContext,
  resolveOtaChannelId,
} from './ourPrice'
import { MARKET_BADGE_PRESETS, findCatalogBadgeByLabel, sortBadgeCatalog } from './badges'
import type { MarketListing, MarketSnapshot, OurPriceOverlay } from './types'

test('adultTotal adds sale and not-included', () => {
  assert.equal(adultTotal(199, 80), 279)
  assert.equal(adultTotal(199, null), 199)
  assert.equal(adultTotal(null, null), null)
  assert.equal(roundMoney(10.129), 10.13)
})

test('discountedPrice applies coupon percent to list price', () => {
  assert.equal(discountedPrice(384, 9), 349.44)
  assert.equal(discountedPrice(361, 9), 328.51)
  assert.equal(discountedPrice(384, 0), null)
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

test('inferAutoSnapshotAxis stores public From price', () => {
  const both = inferAutoSnapshotAxis()
  assert.equal(both.canyon, 'unspecified')
  assert.equal(both.offer, 'listing_from')
  assert.equal(both.needsManualSplit, false)

  const lowerOnly = inferAutoSnapshotAxis()
  assert.equal(lowerOnly.canyon, 'unspecified')
  assert.equal(lowerOnly.offer, 'listing_from')
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

test('parseListingHtml reads visible From price without JSON-LD', () => {
  const parsed = parseListingHtml('<html><body>From $346 per person</body></html>')
  assert.equal(parsed?.price, 346)
  assert.equal(parsed?.currency, 'USD')
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
    inclusion_items: {},
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
      badges: [],
      excluded_items: [],
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
  assert.match(csv, /Lower · 옵션 판매가/)
  assert.match(csv, /220/)
})

test('listingRecordedPrices keeps From, Lower, and Antelope X separate', () => {
  const snapshots: MarketSnapshot[] = [
    {
      id: 'from',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'auto',
      canyon_variant: 'unspecified',
      offer_type: 'listing_from',
      currency: 'USD',
      adult_sale_price: 346,
      adult_not_included: 0,
      adult_total: 346,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
    {
      id: 'legacy-from',
      operator_id: 'op',
      listing_id: 'L2',
      observed_on: '2026-09-19',
      source: 'auto',
      canyon_variant: 'unspecified',
      offer_type: 'all_inclusive',
      currency: 'USD',
      adult_sale_price: 346,
      adult_not_included: 0,
      adult_total: 346,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
    {
      id: 'lower',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'manual',
      canyon_variant: 'lower',
      offer_type: 'all_inclusive',
      currency: 'USD',
      adult_sale_price: 399,
      adult_not_included: 0,
      adult_total: 399,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
    {
      id: 'x',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'manual',
      canyon_variant: 'antelope_x',
      offer_type: 'all_inclusive',
      currency: 'USD',
      adult_sale_price: 429,
      adult_not_included: 0,
      adult_total: 429,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
  ]
  const recorded = listingRecordedPrices(snapshots, 'L1')
  assert.equal(recorded.from?.adult_total, 346)
  assert.equal(recorded.lower?.adult_sale_price, 399)
  assert.equal(recorded.antelopeX?.adult_sale_price, 429)
  assert.equal(listingRecordedPrices(snapshots, 'L2').from?.adult_total, 346)
})

test('parseExcludedItems maps labeled fees and sums to 95', () => {
  const items = parseExcludedItems([
    { label: '앤텔롭 캐년', amount: 82 },
    { label: '그랜드캐년', amount: 8 },
    { label: '홀스슈밴드', amount: 5 },
  ])
  assert.equal(inferExcludedItemId('Antelope Canyon'), 'antelope_canyon')
  assert.equal(items.length, 3)
  assert.equal(items[0]?.id, 'antelope_canyon')
  assert.equal(sumExcludedItems(items), 95)
})

test('parseInclusionMap keeps per-item included and excluded flags', () => {
  const map = parseInclusionMap({ grand_canyon: 'included', guide_tip: 'excluded' }, true)
  assert.equal(map.grand_canyon, 'included')
  assert.equal(map.guide_tip, 'excluded')
  assert.equal(map.breakfast, 'included')
  assert.equal(map.lunch, 'included')
  assert.equal(inclusionHasExcluded(map), true)
  assert.equal(inclusionHasExcluded(parseInclusionMap({}, true)), false)
})

test('pricingBoardRows uses master compare item catalog', () => {
  const rows = pricingBoardRows([], true, [
    { id: 'entrance_fee', labelKo: '입장료', labelEn: 'Entrance fee' },
    { id: 'guide_tip', labelKo: '가이드 팁', labelEn: 'Guide tip' },
  ])
  assert.ok(rows.some((row) => row.id === 'entrance_fee' && row.kind === 'excluded'))
  assert.ok(rows.some((row) => row.id === 'guide_tip' && row.kind === 'excluded'))
  assert.equal(rows.some((row) => row.id === 'dinner'), false)
})

test('ours pricing column uses overlay sale and saved include/exclude', () => {
  const columns = buildOurPricingBoardColumns({
    productId: 'MDGCSUNRISE',
    listings: [],
    offers: [
      {
        operator_id: 'op',
        product_id: 'MDGCSUNRISE',
        ota_platform: 'getyourguide',
        inclusion_items: { grand_canyon: 'included', guide_tip: 'excluded' },
        excluded_items: [{ id: 'guide_tip', label: '가이드 팁', amount: 10 }],
        channel_settings: {
          discountMode: 'inherit',
          discountPercent: null,
          lowerSale: null,
          antelopeXSale: null,
        },
        created_at: '2026-09-19T00:00:00.000Z',
        updated_at: '2026-09-19T00:00:00.000Z',
      },
    ],
    overlays: {
      'MDGCSUNRISE:getyourguide': {
        productId: 'MDGCSUNRISE',
        channelId: 'getyourguide',
        date: '2026-09-19',
        points: {
          'lower:sale_plus_excluded': { sale: 389, notIncluded: 10, total: 399, source: 'dynamic' },
          'antelope_x:sale_plus_excluded': { sale: 349, notIncluded: 10, total: 359, source: 'dynamic' },
        },
      },
    },
    otas: ['getyourguide'],
    oursLabel: '자사',
  })
  assert.equal(columns[0]?.kind, 'ours')
  assert.equal(columns[0]?.lowerSale, 389)
  assert.equal(columns[0]?.inclusionItems.grand_canyon, 'included')
  assert.equal(columns[0]?.excludedById.guide_tip, 10)
  assert.equal(columns[0]?.lowerFinal, 399)
})

test('ours pricing column shows list and coupon discounted sale', () => {
  const columns = buildOurPricingBoardColumns({
    productId: 'MDGCSUNRISE',
    listings: [],
    offers: [],
    overlays: {
      'MDGCSUNRISE:getyourguide': {
        productId: 'MDGCSUNRISE',
        channelId: 'Partner5',
        date: '2026-09-20',
        points: {
          'lower:all_inclusive': {
            sale: 384,
            discounted: 349.44,
            discountPercent: 9,
            notIncluded: 0,
            total: 349.44,
            source: 'dynamic',
          },
          'antelope_x:all_inclusive': {
            sale: 361,
            discounted: 328.51,
            discountPercent: 9,
            notIncluded: 0,
            total: 328.51,
            source: 'dynamic',
          },
        },
      },
    },
    otas: ['getyourguide'],
    oursLabel: '자사',
  })
  assert.equal(columns[0]?.fromPrice, 361)
  assert.equal(columns[0]?.fromDiscounted, 328.51)
  assert.equal(columns[0]?.discountPercent, 9)
  assert.equal(columns[0]?.lowerSale, 384)
  assert.equal(columns[0]?.lowerDiscounted, 349.44)
  assert.equal(columns[0]?.lowerFinal, 349.44)
})

test('our channel settings can drop Viator discount and override the list price', () => {
  const overlay = {
    productId: 'MDGCSUNRISE',
    channelId: 'Partner6',
    date: '2026-09-20',
    points: {
      'lower:all_inclusive': {
        sale: 384,
        discounted: 349.44,
        discountPercent: 9,
        notIncluded: 0,
        total: 349.44,
        source: 'dynamic' as const,
      },
      'antelope_x:all_inclusive': {
        sale: 361,
        discounted: 328.51,
        discountPercent: 9,
        notIncluded: 0,
        total: 328.51,
        source: 'dynamic' as const,
      },
    },
  }
  const offerBase = {
    operator_id: 'op',
    product_id: 'MDGCSUNRISE',
    ota_platform: 'viator' as const,
    inclusion_items: {},
    excluded_items: [],
    created_at: '2026-09-21T00:00:00.000Z',
    updated_at: '2026-09-21T00:00:00.000Z',
  }
  const withoutDiscount = buildOurPricingBoardColumns({
    productId: 'MDGCSUNRISE',
    listings: [],
    offers: [
      {
        ...offerBase,
        channel_settings: {
          discountMode: 'none',
          discountPercent: null,
          lowerSale: null,
          antelopeXSale: null,
        },
      },
    ],
    overlays: { 'MDGCSUNRISE:viator': overlay },
    otas: ['viator'],
    oursLabel: '자사',
  })
  assert.equal(withoutDiscount[0]?.lowerSale, 384)
  assert.equal(withoutDiscount[0]?.lowerDiscounted, null)
  assert.equal(withoutDiscount[0]?.discountPercent, null)
  assert.equal(withoutDiscount[0]?.lowerFinal, 384)
  assert.equal(withoutDiscount[0]?.fromPrice, 361)
  assert.equal(withoutDiscount[0]?.fromDiscounted, null)

  const custom = buildOurPricingBoardColumns({
    productId: 'MDGCSUNRISE',
    listings: [],
    offers: [
      {
        ...offerBase,
        channel_settings: {
          discountMode: 'custom',
          discountPercent: 10,
          lowerSale: 400,
          antelopeXSale: null,
        },
      },
    ],
    overlays: { 'MDGCSUNRISE:viator': overlay },
    otas: ['viator'],
    oursLabel: '자사',
  })
  assert.equal(custom[0]?.lowerSale, 400)
  assert.equal(custom[0]?.lowerDiscounted, 360)
  assert.equal(custom[0]?.antelopeXSale, 361)
  assert.equal(custom[0]?.antelopeXDiscounted, 324.9)
  assert.equal(custom[0]?.discountPercent, 10)
})

test('resolveOtaChannelId uses channels.name when PLATFORM_CHANNEL_MAP id is missing', () => {
  const channels = [
    { id: 'Partner5', name: 'GetYourGuide' },
    { id: 'Partner6', name: 'Viator' },
    { id: 'M00001', name: 'Homepage' },
  ]
  assert.equal(resolveOtaChannelId('getyourguide', channels), 'Partner5')
  assert.equal(resolveOtaChannelId('viator', channels), 'Partner6')
  assert.equal(resolveOtaChannelId('getyourguide', [{ id: 'getyourguide', name: 'GYG' }]), 'getyourguide')
})

test('canyonOtaSaleFromChoices uses ota_sale_price keyed by option_key, not adult_price', () => {
  const choicesPricing = {
    '77035d92-8485-478f-a330-c384abe80944': { ota_sale_price: 361, adult_price: 72 },
    '8f8a7270-f6f1-4460-a57a-10724c55a51a': { ota_sale_price: 384, adult_price: 82 },
    '350a356d-1d95-4078-98dd-0a9b34409fc1+8f8a7270-f6f1-4460-a57a-10724c55a51a': {
      ota_sale_price: 384,
      adult_price: 82,
    },
  }
  assert.equal(
    canyonOtaSaleFromChoices(choicesPricing, {
      id: '010c5310-new-lower',
      option_key: '8f8a7270-f6f1-4460-a57a-10724c55a51a',
    }).sale,
    384
  )
  assert.equal(
    canyonOtaSaleFromChoices(choicesPricing, {
      id: '58c77309-new-x',
      option_key: '77035d92-8485-478f-a330-c384abe80944',
    }).sale,
    361
  )
})

test('overlayFromContext reads Partner5 ota_sale_price and ignores other channels', () => {
  const options = [
    {
      id: 'lower-id',
      canyon_key: 'L',
      canonical_option_key: 'lower_antelope',
      option_key: '8f8a7270-f6f1-4460-a57a-10724c55a51a',
      adult_price: 82,
    },
    {
      id: 'x-id',
      canyon_key: 'X',
      canonical_option_key: 'antelope_x',
      option_key: '77035d92-8485-478f-a330-c384abe80944',
      adult_price: 72,
    },
  ]
  const overlay = overlayFromContext(
    'MDGCSUNRISE',
    'Partner5',
    {
      productBase: new Map([['MDGCSUNRISE', 239]]),
      optionsByProduct: new Map([['MDGCSUNRISE', options]]),
      pricingRows: [
        {
          product_id: 'MDGCSUNRISE',
          channel_id: 'M00001',
          date: '2026-09-20',
          adult_price: 239,
          not_included_price: 0,
          variant_key: 'default',
          choices_pricing: { '8f8a7270-f6f1-4460-a57a-10724c55a51a': { ota_sale_price: 72 } },
        },
        {
          product_id: 'MDGCSUNRISE',
          channel_id: 'Partner5',
          date: '2026-09-20',
          adult_price: 289,
          not_included_price: 0,
          coupon_percent: 9,
          variant_key: 'default',
          choices_pricing: {
            '8f8a7270-f6f1-4460-a57a-10724c55a51a': { ota_sale_price: 384, adult_price: 82 },
            '77035d92-8485-478f-a330-c384abe80944': { ota_sale_price: 361, adult_price: 72 },
          },
        },
      ],
    }
  )
  assert.equal(overlay.channelId, 'Partner5')
  assert.equal(overlay.points['lower:all_inclusive']?.sale, 384)
  assert.equal(overlay.points['lower:all_inclusive']?.discounted, 349.44)
  assert.equal(overlay.points['lower:all_inclusive']?.discountPercent, 9)
  assert.equal(overlay.points['antelope_x:all_inclusive']?.sale, 361)
  assert.equal(overlay.points['antelope_x:all_inclusive']?.discounted, 328.51)
  const missing = overlayFromContext('MDGCSUNRISE', 'getyourguide', {
    productBase: new Map([['MDGCSUNRISE', 239]]),
    optionsByProduct: new Map([['MDGCSUNRISE', options]]),
    pricingRows: overlay.channelId
      ? [
          {
            product_id: 'MDGCSUNRISE',
            channel_id: 'Partner5',
            date: '2026-09-20',
            adult_price: 289,
            not_included_price: 0,
            variant_key: 'default',
            choices_pricing: {
              '8f8a7270-f6f1-4460-a57a-10724c55a51a': { ota_sale_price: 384 },
            },
          },
        ]
      : [],
  })
  assert.equal(missing.points['lower:all_inclusive']?.sale, null)
})

test('buildOtaCompareRows adds excluded item rows for table compare', () => {
  const listing: MarketListing = {
    id: 'L1',
    operator_id: 'op',
    competitor_id: 'C1',
    ota_platform: 'getyourguide',
    listing_url: 'https://example.com/p',
    listing_title: 'Rival sunrise',
    mapped_product_id: 'MDGCSUNRISE',
    mapped_channel_id: 'getyourguide',
    has_lower: true,
    has_antelope_x: true,
    has_all_inclusive: false,
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
    diff_notes: null,
    inclusion_items: {},
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }
  const snapshots: MarketSnapshot[] = [
    {
      id: 's1',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'manual',
      canyon_variant: 'lower',
      offer_type: 'sale_plus_excluded',
      currency: 'USD',
      adult_sale_price: 399,
      adult_not_included: 95,
      adult_total: 494,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [
        { id: 'antelope_canyon', label: '앤텔롭 캐년', amount: 82 },
        { id: 'grand_canyon', label: '그랜드캐년', amount: 8 },
        { id: 'horseshoe_bend', label: '홀스슈밴드', amount: 5 },
      ],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
  ]
  const rows = buildOtaCompareRows([listing], snapshots, {})
  const antelope = rows.find((row) => row.axisKey === 'excluded:lower:antelope_canyon')
  const total = rows.find((row) => row.axisKey === 'excluded:lower:total')
  assert.ok(antelope)
  assert.equal(antelope?.cells.L1.total, 82)
  assert.equal(total?.cells.L1.total, 95)
  assert.match(compareRowLabel(antelope!, true), /앤텔롭 캐년/)
})

test('pricingBoard shows From, option sales, excluded rows, and customer total', () => {
  const listing: MarketListing = {
    id: 'L1',
    operator_id: 'op',
    competitor_id: 'C1',
    ota_platform: 'getyourguide',
    listing_url: 'https://example.com/p',
    listing_title: 'Rival sunrise',
    mapped_product_id: 'MDGCSUNRISE',
    mapped_channel_id: 'getyourguide',
    has_lower: true,
    has_antelope_x: true,
    has_all_inclusive: false,
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
    diff_notes: null,
    inclusion_items: {},
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }
  const snapshots: MarketSnapshot[] = [
    {
      id: 'from',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'auto',
      canyon_variant: 'unspecified',
      offer_type: 'listing_from',
      currency: 'USD',
      adult_sale_price: 346,
      adult_not_included: 0,
      adult_total: 346,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
    {
      id: 'lower',
      operator_id: 'op',
      listing_id: 'L1',
      observed_on: '2026-09-19',
      source: 'manual',
      canyon_variant: 'lower',
      offer_type: 'sale_plus_excluded',
      currency: 'USD',
      adult_sale_price: 399,
      adult_not_included: 95,
      adult_total: 494,
      child_sale_price: null,
      child_not_included: null,
      rating: null,
      review_count: null,
      badges: [],
      excluded_items: [
        { id: 'antelope_canyon', label: '앤텔롭 캐년 입장료', amount: 82 },
        { id: 'grand_canyon', label: '그랜드캐년 입장료', amount: 8 },
        { id: 'horseshoe_bend', label: '홀스슈밴드 입장료', amount: 5 },
      ],
      raw_extract: {},
      created_at: '2026-09-19T00:00:00.000Z',
    },
  ]
  const columns = buildPricingBoardColumns(
    [listing],
    [{ id: 'C1', operator_id: 'op', name: 'Fun Tour', website_url: null, notes: null, is_active: true, created_at: '', updated_at: '' }],
    snapshots,
    'MDGCSUNRISE',
    'getyourguide'
  )
  assert.equal(columns[0]?.fromPrice, 346)
  assert.equal(columns[0]?.lowerSale, 399)
  assert.equal(columns[0]?.excludedById.antelope_canyon, 82)
  assert.equal(columns[0]?.lowerFinal, 494)
  const rows = pricingBoardRows(columns, true)
  assert.ok(rows.some((row) => row.kind === 'section'))
  const final = rows.find((row) => row.kind === 'final')
  assert.equal(cellValue(columns[0]!, final!).primary, 494)
})

test('pricingBoard 전체 view names competitor-OTA cards and intersects filters', () => {
  const base: MarketListing = {
    id: 'L1',
    operator_id: 'op',
    competitor_id: 'C1',
    ota_platform: 'getyourguide',
    listing_url: 'https://example.com/gyg',
    listing_title: 'Fun GYG',
    mapped_product_id: 'MDGCSUNRISE',
    mapped_channel_id: null,
    has_lower: true,
    has_antelope_x: true,
    has_all_inclusive: false,
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
    diff_notes: null,
    inclusion_items: {},
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }
  const listings: MarketListing[] = [
    base,
    { ...base, id: 'L2', ota_platform: 'viator', listing_url: 'https://example.com/viator', listing_title: 'Fun Viator' },
    { ...base, id: 'L3', competitor_id: 'C2', ota_platform: 'viator', listing_url: 'https://example.com/other', listing_title: 'Other Viator' },
  ]
  const competitors = [
    { id: 'C1', operator_id: 'op', name: 'Fun Tour', website_url: null, notes: null, is_active: true, created_at: '', updated_at: '' },
    { id: 'C2', operator_id: 'op', name: 'Other Co', website_url: null, notes: null, is_active: true, created_at: '', updated_at: '' },
  ]
  const all = buildPricingBoardColumns(listings, competitors, [], 'MDGCSUNRISE', {
    otaLabel: (platform) => (platform === 'getyourguide' ? 'GetYourGuide' : 'Viator'),
  })
  assert.equal(all.length, 3)
  assert.deepEqual(
    all.map((col) => col.columnTitle),
    ['Fun Tour - Viator', 'Fun Tour - GetYourGuide', 'Other Co - Viator']
  )
  const crossed = buildPricingBoardColumns(listings, competitors, [], 'MDGCSUNRISE', {
    otas: ['viator'],
    competitorIds: ['C1'],
    otaLabel: () => 'Viator',
  })
  assert.equal(crossed.length, 1)
  assert.equal(crossed[0]?.listing?.id, 'L2')
  assert.deepEqual(toggleAllOrItem([], 'viator'), ['viator'])
  assert.deepEqual(toggleAllOrItem(['viator'], 'getyourguide'), ['viator', 'getyourguide'])
  assert.deepEqual(toggleAllOrItem(['viator'], 'viator'), [])
})

test('OTA badge catalog includes Top rated and reuses typed labels', () => {
  assert.equal(
    MARKET_BADGE_PRESETS.some((row) => row.id === 'top_rated' && row.labelEn === 'Top rated'),
    true
  )
  const catalog = [
    {
      operator_id: 'op',
      badge_id: 'top_rated',
      label_ko: 'Top rated',
      label_en: 'Top rated',
      sort_order: 2,
      is_preset: true,
      created_at: '',
    },
    {
      operator_id: 'op',
      badge_id: 'free_cancellation',
      label_ko: 'Free cancellation',
      label_en: 'Free cancellation',
      sort_order: 9,
      is_preset: false,
      created_at: '',
    },
  ]
  assert.equal(findCatalogBadgeByLabel(catalog, 'Top rated')?.badge_id, 'top_rated')
  assert.equal(findCatalogBadgeByLabel(catalog, 'free cancellation')?.badge_id, 'free_cancellation')
  assert.equal(findCatalogBadgeByLabel(catalog, 'New badge'), undefined)
  assert.equal(sortBadgeCatalog(catalog)[0]?.badge_id, 'top_rated')
})

test('parseListingLanguages accepts ids and labels', () => {
  assert.deepEqual(parseListingLanguages('ko,en,ja'), ['ko', 'en', 'ja'])
  assert.deepEqual(parseListingLanguages('한국어 · English / Japanese'), ['ko', 'en', 'ja'])
  assert.equal(formatListingLanguages(['ko', 'es', 'xx']), 'ko,es')
})
