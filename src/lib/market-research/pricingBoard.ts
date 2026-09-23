import type {
  MarketCompetitor,
  MarketExcludedItem,
  MarketListing,
  MarketOtaPlatform,
  MarketOurOffer,
  MarketSnapshot,
  OurPriceOverlay,
} from './types'
import { orderOtaKeys, otaPlatformRank } from './otaChannels'
import {
  collectExcludedItemIds,
  compareItemLabel,
  excludedAmountFor,
  excludedItemsFromInclusion,
  inclusionHasExcluded,
  parseInclusionMap,
  resolveCompareItems,
  snapshotExcludedItems,
  sumExcludedItems,
  type MarketCompareItemDef,
} from './excludedItems'
import { discountedPrice, effectiveSalePrice, listingObservedMeta, listingRecordedPrices, roundMoney } from './prices'
import { applyOurChannelSettings, parseOurChannelSettings } from './ourChannelSettings'
import { overlayAxisPoint, ourProductPlatformKey } from './ourPrice'

export const UNMAPPED_PRODUCT_ID = '__unmapped'

export const COLUMN_TONES = [
  { bar: 'bg-emerald-500', soft: 'bg-emerald-50' },
  { bar: 'bg-blue-600', soft: 'bg-blue-50' },
  { bar: 'bg-violet-600', soft: 'bg-violet-50' },
  { bar: 'bg-amber-500', soft: 'bg-amber-50' },
  { bar: 'bg-[#0B5FFF]', soft: 'bg-blue-50' },
] as const

export const OUR_COLUMN_TONE = { bar: 'bg-[#0B5FFF]', soft: 'bg-blue-50' } as const

export type PricingBoardColumn = {
  columnId: string
  kind: 'ours' | 'competitor'
  listing: MarketListing | null
  otaPlatform: MarketOtaPlatform
  competitorId: string
  competitorName: string
  otaLabel: string
  columnTitle: string
  showOtaLabel: boolean
  fromPrice: number | null
  fromDiscounted: number | null
  discountPercent: number | null
  lowerSale: number | null
  lowerDiscounted: number | null
  antelopeXSale: number | null
  antelopeXDiscounted: number | null
  excludedById: Record<string, number | null>
  lowerExcludedTotal: number
  antelopeXExcludedTotal: number
  lowerFinal: number | null
  antelopeXFinal: number | null
  rating: number | null
  reviewCount: number | null
  badges: MarketSnapshot['badges']
  observedOn: string | null
  inclusionItems: MarketListing['inclusion_items']
  toneIndex: number
}

export type PricingBoardFilter = {
  otas?: readonly MarketOtaPlatform[]
  competitorIds?: readonly string[]
  otaLabel?: (platform: MarketOtaPlatform) => string
  includeOtaInName?: boolean
  compareItems?: readonly MarketCompareItemDef[]
}

export type PricingBoardRow =
  | { kind: 'sale'; id: 'lower' | 'antelope_x'; label: string }
  | { kind: 'section'; id: string; label: string }
  | { kind: 'excluded'; id: string; label: string }
  | { kind: 'final'; id: 'final'; label: string }

export function listingsForProduct(
  listings: MarketListing[],
  productId: string
): MarketListing[] {
  if (productId === UNMAPPED_PRODUCT_ID) {
    return listings.filter((row) => !row.mapped_product_id)
  }
  return listings.filter((row) => row.mapped_product_id === productId)
}

export function otasForProduct(listings: MarketListing[], productId: string): MarketOtaPlatform[] {
  const found = new Set<string>()
  for (const row of listingsForProduct(listings, productId)) found.add(row.ota_platform)
  return orderOtaKeys([...found]) as MarketOtaPlatform[]
}

export function competitorsForProduct(
  listings: MarketListing[],
  competitors: MarketCompetitor[],
  productId: string
): MarketCompetitor[] {
  const ids = new Set(listingsForProduct(listings, productId).map((row) => row.competitor_id))
  return competitors.filter((row) => ids.has(row.id))
}

export function toggleAllOrItem<T extends string>(selected: T[], id: T): T[] {
  if (selected.length === 0) return [id]
  if (selected.includes(id)) return selected.filter((item) => item !== id)
  return [...selected, id]
}

export function listingsForBoard(
  listings: MarketListing[],
  productId: string,
  otas?: readonly MarketOtaPlatform[],
  competitorIds?: readonly string[]
): MarketListing[] {
  return listingsForProduct(listings, productId).filter((row) => {
    if (otas && otas.length > 0 && !otas.includes(row.ota_platform)) return false
    if (competitorIds && competitorIds.length > 0 && !competitorIds.includes(row.competitor_id)) {
      return false
    }
    return true
  })
}

function normalizeBoardFilter(
  filter: MarketOtaPlatform | PricingBoardFilter
): PricingBoardFilter {
  return typeof filter === 'string' ? { otas: [filter] } : filter
}

function snapshotPricePair(row: MarketSnapshot | null | undefined): {
  list: number | null
  discounted: number | null
  percent: number | null
} {
  const list = row?.adult_sale_price ?? null
  const percent = row?.discount_percent && row.discount_percent > 0 ? row.discount_percent : null
  const discounted =
    row?.adult_discounted_price ??
    (percent != null ? discountedPrice(list, percent) : null)
  return { list, discounted, percent }
}

function firstDiscountPercent(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && value > 0) return value
  }
  return null
}

function mergeExcluded(
  lower: MarketExcludedItem[],
  antelopeX: MarketExcludedItem[],
  items?: readonly MarketCompareItemDef[] | null
): Record<string, number | null> {
  const catalog = resolveCompareItems(items)
  const ids = collectExcludedItemIds(
    [
      { excluded_items: lower, raw_extract: {} } as MarketSnapshot,
      { excluded_items: antelopeX, raw_extract: {} } as MarketSnapshot,
    ],
    catalog
  )
  const map: Record<string, number | null> = {}
  for (const preset of catalog) map[preset.id] = null
  for (const item of ids) {
    map[item.id] = excludedAmountFor(lower, item.id) ?? excludedAmountFor(antelopeX, item.id)
  }
  for (const preset of catalog) {
    if (map[preset.id] == null) {
      map[preset.id] = excludedAmountFor(lower, preset.id) ?? excludedAmountFor(antelopeX, preset.id)
    }
  }
  return map
}

export function buildPricingBoardColumns(
  listings: MarketListing[],
  competitors: MarketCompetitor[],
  snapshots: MarketSnapshot[],
  productId: string,
  filter: MarketOtaPlatform | PricingBoardFilter
): PricingBoardColumn[] {
  const options = normalizeBoardFilter(filter)
  const nameById = new Map(competitors.map((row) => [row.id, row.name]))
  const labelOta = options.otaLabel || ((platform: MarketOtaPlatform) => platform)
  const showOtaLabel = options.includeOtaInName ?? (!options.otas || options.otas.length !== 1)
  const rows = listingsForBoard(listings, productId, options.otas, options.competitorIds).slice()
  rows.sort((a, b) => {
    const nameA = nameById.get(a.competitor_id) || a.listing_title || a.id
    const nameB = nameById.get(b.competitor_id) || b.listing_title || b.id
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'en')
    return otaPlatformRank(a.ota_platform) - otaPlatformRank(b.ota_platform)
  })
  return rows.map((listing, index) => {
    const recorded = listingRecordedPrices(snapshots, listing.id)
    const lowerItems = snapshotExcludedItems(recorded.lower)
    const xItems = snapshotExcludedItems(recorded.antelopeX)
    const excludedById = mergeExcluded(lowerItems, xItems, options.compareItems)
    const lowerExcludedTotal = lowerItems.length
      ? sumExcludedItems(lowerItems)
      : recorded.lower?.adult_not_included || 0
    const antelopeXExcludedTotal = xItems.length
      ? sumExcludedItems(xItems)
      : recorded.antelopeX?.adult_not_included || 0
    const fromPair = snapshotPricePair(recorded.from)
    const lowerPair = snapshotPricePair(recorded.lower)
    const antelopeXPair = snapshotPricePair(recorded.antelopeX)
    const lowerSale = lowerPair.list
    const antelopeXSale = antelopeXPair.list
    const lowerEffective = effectiveSalePrice(lowerSale, lowerPair.discounted)
    const antelopeXEffective = effectiveSalePrice(antelopeXSale, antelopeXPair.discounted)
    const competitorName = nameById.get(listing.competitor_id) || listing.listing_title || listing.id
    const otaLabel = labelOta(listing.ota_platform)
    const social = listingObservedMeta(snapshots, listing.id)
    return {
      columnId: listing.id,
      kind: 'competitor' as const,
      listing,
      otaPlatform: listing.ota_platform,
      competitorId: listing.competitor_id,
      competitorName,
      otaLabel,
      columnTitle: showOtaLabel ? `${competitorName} - ${otaLabel}` : competitorName,
      showOtaLabel,
      fromPrice: fromPair.list ?? recorded.from?.adult_total ?? null,
      fromDiscounted: fromPair.discounted,
      discountPercent: firstDiscountPercent(fromPair.percent, lowerPair.percent, antelopeXPair.percent),
      lowerSale,
      lowerDiscounted: lowerPair.discounted,
      antelopeXSale,
      antelopeXDiscounted: antelopeXPair.discounted,
      excludedById,
      lowerExcludedTotal,
      antelopeXExcludedTotal,
      lowerFinal: lowerEffective == null ? null : lowerEffective + lowerExcludedTotal,
      antelopeXFinal: antelopeXEffective == null ? null : antelopeXEffective + antelopeXExcludedTotal,
      rating: social.rating,
      reviewCount: social.reviewCount,
      badges: social.badges,
      observedOn: social.observedOn,
      inclusionItems: listing.inclusion_items,
      toneIndex: index % COLUMN_TONES.length,
    }
  })
}

export function platformsForOurColumns(
  productId: string,
  listings: MarketListing[],
  offers: MarketOurOffer[],
  otas?: readonly string[],
  fallbackOtas?: readonly string[]
): MarketOtaPlatform[] {
  if (productId === UNMAPPED_PRODUCT_ID) return []
  if (otas && otas.length > 0) return orderOtaKeys(otas) as MarketOtaPlatform[]
  const found = new Set<string>()
  for (const row of listingsForProduct(listings, productId)) found.add(row.ota_platform)
  for (const row of offers) {
    if (row.product_id === productId) found.add(row.ota_platform)
  }
  const ordered = orderOtaKeys([...found]).filter((platform) => platform !== 'other')
  if (ordered.length > 0) return ordered as MarketOtaPlatform[]
  const fallback = (fallbackOtas || []).filter((platform) => platform !== 'other')
  if (fallback.length > 0) return orderOtaKeys(fallback) as MarketOtaPlatform[]
  return ['getyourguide', 'viator']
}

function oursExcludedTotal(
  inclusion: MarketListing['inclusion_items'],
  amounts: MarketExcludedItem[],
  overlayNotIncluded: number | null | undefined,
  compareItems?: readonly MarketCompareItemDef[] | null
): number {
  if (!inclusionHasExcluded(inclusion)) return 0
  const items = excludedItemsFromInclusion(inclusion, amounts, true, compareItems).filter((row) => row.amount > 0)
  if (items.length > 0) return sumExcludedItems(items)
  return overlayNotIncluded ?? 0
}

export function buildOurPricingBoardColumns(input: {
  productId: string
  listings: MarketListing[]
  offers: MarketOurOffer[]
  overlays: Record<string, OurPriceOverlay>
  otas?: readonly MarketOtaPlatform[]
  fallbackOtas?: readonly string[]
  otaLabel?: (platform: MarketOtaPlatform) => string
  compareItems?: readonly MarketCompareItemDef[]
  oursLabel: string
}): PricingBoardColumn[] {
  const platforms = platformsForOurColumns(
    input.productId,
    input.listings,
    input.offers,
    input.otas,
    input.fallbackOtas
  )
  const labelOta = input.otaLabel || ((platform: MarketOtaPlatform) => platform)
  const showOtaLabel = input.otas ? input.otas.length !== 1 : platforms.length !== 1
  const compareItems = input.compareItems
  return platforms.map((platform) => {
    const offer = input.offers.find(
      (row) => row.product_id === input.productId && row.ota_platform === platform
    )
    const inclusionItems = parseInclusionMap(offer?.inclusion_items, true, compareItems)
    const settings = parseOurChannelSettings(offer?.channel_settings)
    const overlay = input.overlays[ourProductPlatformKey(input.productId, platform)]
    const saleOffer = inclusionHasExcluded(inclusionItems) ? 'sale_plus_excluded' : 'all_inclusive'
    const lower = applyOurChannelSettings(overlayAxisPoint(overlay, 'lower', saleOffer), settings, 'lower')
    const antelopeX = applyOurChannelSettings(
      overlayAxisPoint(overlay, 'antelope_x', saleOffer),
      settings,
      'antelope_x'
    )
    const lowerSale = lower?.sale ?? null
    const antelopeXSale = antelopeX?.sale ?? null
    const lowerDiscounted = lower?.discounted ?? null
    const antelopeXDiscounted = antelopeX?.discounted ?? null
    const amounts = offer?.excluded_items || []
    const excludedById = mergeExcluded(amounts, amounts, compareItems)
    const lowerExcludedTotal = oursExcludedTotal(inclusionItems, amounts, lower?.notIncluded, compareItems)
    const antelopeXExcludedTotal = oursExcludedTotal(
      inclusionItems,
      amounts,
      antelopeX?.notIncluded,
      compareItems
    )
    const lowerEffective = effectiveSalePrice(lowerSale, lowerDiscounted)
    const antelopeXEffective = effectiveSalePrice(antelopeXSale, antelopeXDiscounted)
    const fromCandidates = [lowerSale, antelopeXSale].filter((value): value is number => value != null)
    const fromDiscountedCandidates = [lowerDiscounted, antelopeXDiscounted].filter(
      (value): value is number => value != null
    )
    return {
      columnId: `ours:${input.productId}:${platform}`,
      kind: 'ours' as const,
      listing: null,
      otaPlatform: platform,
      competitorId: 'ours',
      competitorName: input.oursLabel,
      otaLabel: labelOta(platform),
      columnTitle: showOtaLabel ? `${input.oursLabel} - ${labelOta(platform)}` : input.oursLabel,
      showOtaLabel,
      fromPrice: fromCandidates.length ? Math.min(...fromCandidates) : null,
      fromDiscounted: fromDiscountedCandidates.length ? Math.min(...fromDiscountedCandidates) : null,
      discountPercent: firstDiscountPercent(lower?.discountPercent, antelopeX?.discountPercent),
      lowerSale,
      lowerDiscounted,
      antelopeXSale,
      antelopeXDiscounted,
      excludedById,
      lowerExcludedTotal,
      antelopeXExcludedTotal,
      lowerFinal: lowerEffective == null ? null : lowerEffective + lowerExcludedTotal,
      antelopeXFinal: antelopeXEffective == null ? null : antelopeXEffective + antelopeXExcludedTotal,
      rating: null,
      reviewCount: null,
      badges: [],
      observedOn: overlay?.date ?? null,
      inclusionItems,
      toneIndex: 0,
    }
  })
}

export function pricingBoardRows(
  columns: PricingBoardColumn[],
  isKo: boolean,
  compareItems?: readonly MarketCompareItemDef[] | null
): PricingBoardRow[] {
  const catalog = resolveCompareItems(compareItems)
  const extra = collectExcludedItemIds(
    columns.flatMap((col) => [
      {
        excluded_items: Object.entries(col.excludedById)
          .filter(([, amount]) => amount != null)
          .map(([id, amount]) => ({ id, label: id, amount: amount || 0 })),
        raw_extract: {},
      } as MarketSnapshot,
    ]),
    catalog
  ).filter((item) => !catalog.some((preset) => preset.id === item.id))

  const rows: PricingBoardRow[] = [
    { kind: 'sale', id: 'lower', label: 'Lower Antelope Canyon' },
    { kind: 'sale', id: 'antelope_x', label: 'Antelope X Canyon' },
    { kind: 'section', id: 'excluded', label: isKo ? '불포함 사항' : 'Not included' },
    ...catalog.map((preset) => ({
      kind: 'excluded' as const,
      id: preset.id,
      label: `– ${compareItemLabel(preset, isKo)}`,
    })),
    ...extra.map((item) => ({
      kind: 'excluded' as const,
      id: item.id,
      label: `– ${item.label}`,
    })),
    { kind: 'final', id: 'final', label: isKo ? '최종 고객 결제가' : 'Customer pays' },
  ]
  return rows
}

export type CompetitorPriceTone = 'higher' | 'lower'

/** Competitor above our price is higher (green). Below is lower (red). */
export function competitorPriceTone(
  theirs: number | null | undefined,
  ours: number | null | undefined
): CompetitorPriceTone | null {
  if (theirs == null || ours == null || !Number.isFinite(theirs) || !Number.isFinite(ours)) return null
  const delta = roundMoney(theirs) - roundMoney(ours)
  if (delta > 0) return 'higher'
  if (delta < 0) return 'lower'
  return null
}

export function shownSalePrice(
  list: number | null | undefined,
  discounted: number | null | undefined
): number | null {
  return effectiveSalePrice(list ?? null, discounted ?? null)
}

export function cellValue(column: PricingBoardColumn, row: PricingBoardRow): {
  primary: number | null
  secondary: number | null
  secondaryLabel: string | null
} {
  if (row.kind === 'sale') {
    return {
      primary: row.id === 'lower' ? column.lowerSale : column.antelopeXSale,
      secondary: row.id === 'lower' ? column.lowerDiscounted : column.antelopeXDiscounted,
      secondaryLabel:
        column.discountPercent != null && column.discountPercent > 0
          ? `-${column.discountPercent}%`
          : null,
    }
  }
  if (row.kind === 'excluded') {
    return { primary: column.excludedById[row.id] ?? null, secondary: null, secondaryLabel: null }
  }
  if (row.kind === 'final') {
    return {
      primary: column.lowerFinal,
      secondary: column.antelopeXFinal,
      secondaryLabel: 'X',
    }
  }
  return { primary: null, secondary: null, secondaryLabel: null }
}
