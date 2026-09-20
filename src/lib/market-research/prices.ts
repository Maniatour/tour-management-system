import type { MarketCanyonVariant, MarketOfferType, MarketSnapshot } from './types'
import { marketPriceAxisKey } from './types'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeDiscountPercent(value: unknown): number {
  const n = toMoney(value)
  if (n == null || n <= 0) return 0
  return Math.min(100, n)
}

export function discountedPrice(
  list: number | null | undefined,
  percent: number | null | undefined
): number | null {
  if (list == null) return null
  const pct = normalizeDiscountPercent(percent)
  if (pct <= 0) return null
  return roundMoney(list * (1 - pct / 100))
}

export function effectiveSalePrice(
  list: number | null | undefined,
  discounted: number | null | undefined
): number | null {
  return discounted ?? list ?? null
}

export function parseSnapshotDiscount(
  row: Record<string, unknown>,
  raw: Record<string, unknown> = {}
): { enabled: boolean; percent: number; discounted: number | null } {
  const nested =
    raw.discount && typeof raw.discount === 'object' && !Array.isArray(raw.discount)
      ? (raw.discount as Record<string, unknown>)
      : {}
  const percent = normalizeDiscountPercent(row.discount_percent ?? nested.percent)
  const enabled =
    row.discount_enabled === true ||
    nested.enabled === true ||
    percent > 0
  const list = toMoney(row.adult_sale_price)
  const stored = toMoney(row.adult_discounted_price ?? nested.price)
  const discounted = enabled ? stored ?? discountedPrice(list, percent) : null
  return {
    enabled: Boolean(enabled && percent > 0 && discounted != null),
    percent: enabled ? percent : 0,
    discounted: enabled ? discounted : null,
  }
}

export function serializeSnapshotDiscount(input: {
  enabled: boolean
  percent: number
  list: number | null | undefined
}): { enabled: boolean; percent: number; discounted: number | null; raw: Record<string, unknown> } {
  const percent = input.enabled ? normalizeDiscountPercent(input.percent) : 0
  const discounted = percent > 0 ? discountedPrice(input.list, percent) : null
  const enabled = percent > 0 && discounted != null
  return {
    enabled,
    percent: enabled ? percent : 0,
    discounted,
    raw: enabled ? { enabled: true, percent, price: discounted } : {},
  }
}

export function toMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return roundMoney(value)
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(n)) return roundMoney(n)
  }
  return null
}

export function adultTotal(sale: number | null | undefined, notIncluded: number | null | undefined): number | null {
  if (sale == null && notIncluded == null) return null
  return roundMoney((sale ?? 0) + (notIncluded ?? 0))
}

export function pricesChanged(
  prev: { sale: number; notIncluded: number } | null | undefined,
  next: { sale: number; notIncluded: number }
): boolean {
  if (!prev) return false
  return roundMoney(prev.sale) !== roundMoney(next.sale) || roundMoney(prev.notIncluded) !== roundMoney(next.notIncluded)
}

export function priceDelta(
  ours: number | null | undefined,
  theirs: number | null | undefined
): { amount: number | null; percent: number | null } {
  if (ours == null || theirs == null) return { amount: null, percent: null }
  const amount = roundMoney(theirs - ours)
  const percent = ours === 0 ? null : roundMoney((amount / ours) * 100)
  return { amount, percent }
}

export function isListingStale(
  lastSuccessAt: string | null | undefined,
  now: Date = new Date(),
  days = 2
): boolean {
  if (!lastSuccessAt) return true
  const ts = Date.parse(lastSuccessAt)
  if (Number.isNaN(ts)) return true
  return now.getTime() - ts > days * 24 * 60 * 60 * 1000
}

export function snapshotKey(
  listingId: string,
  canyon: MarketCanyonVariant,
  offer: MarketOfferType,
  observedOn?: string
): string {
  const axis = marketPriceAxisKey(canyon, offer)
  return observedOn ? `${listingId}:${observedOn}:${axis}` : `${listingId}:${axis}`
}

export function latestSnapshotsByAxis(snapshots: MarketSnapshot[]): Map<string, MarketSnapshot> {
  const latest = new Map<string, MarketSnapshot>()
  for (const row of snapshots) {
    const key = snapshotKey(row.listing_id, row.canyon_variant, row.offer_type)
    const prev = latest.get(key)
    if (!prev || row.observed_on > prev.observed_on || (row.observed_on === prev.observed_on && row.created_at > prev.created_at)) {
      latest.set(key, row)
    }
  }
  return latest
}

export function listingOptionOffer(listing: {
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
}): Extract<MarketOfferType, 'all_inclusive' | 'sale_plus_excluded'> {
  return listing.has_sale_plus_excluded && !listing.has_all_inclusive
    ? 'sale_plus_excluded'
    : 'all_inclusive'
}

export function listingAxes(listing: {
  has_lower: boolean
  has_antelope_x: boolean
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
}): Array<{ canyon: MarketCanyonVariant; offer: MarketOfferType }> {
  const axes: Array<{ canyon: MarketCanyonVariant; offer: MarketOfferType }> = [
    { canyon: 'unspecified', offer: 'listing_from' },
  ]
  const offer = listingOptionOffer(listing)
  if (listing.has_lower) axes.push({ canyon: 'lower', offer })
  if (listing.has_antelope_x) axes.push({ canyon: 'antelope_x', offer })
  return axes
}

export function expectedAxisCount(listing: {
  has_lower: boolean
  has_antelope_x: boolean
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
}): number {
  return listingAxes(listing).length
}

export function inferAutoSnapshotAxis(): {
  canyon: MarketCanyonVariant
  offer: MarketOfferType
  needsManualSplit: boolean
} {
  return { canyon: 'unspecified', offer: 'listing_from', needsManualSplit: false }
}

export function listingRecordedPrices(
  snapshots: MarketSnapshot[],
  listingId: string
): {
  from: MarketSnapshot | null
  lower: MarketSnapshot | null
  antelopeX: MarketSnapshot | null
} {
  const latest = latestSnapshotsByAxis(snapshots)
  const optionSnap = (canyon: MarketCanyonVariant) =>
    latest.get(snapshotKey(listingId, canyon, 'sale_plus_excluded')) ??
    latest.get(snapshotKey(listingId, canyon, 'all_inclusive')) ??
    null
  return {
    from:
      latest.get(snapshotKey(listingId, 'unspecified', 'listing_from')) ??
      latest.get(snapshotKey(listingId, 'unspecified', 'all_inclusive')) ??
      null,
    lower: optionSnap('lower'),
    antelopeX: optionSnap('antelope_x'),
  }
}

export function latestFromSnapshot(
  snapshots: MarketSnapshot[],
  listingId: string
): MarketSnapshot | null {
  return listingRecordedPrices(snapshots, listingId).from
}

export function listingObservedMeta(
  snapshots: MarketSnapshot[],
  listingId: string
): {
  rating: number | null
  reviewCount: number | null
  badges: MarketSnapshot['badges']
  observedOn: string | null
} {
  const recorded = listingRecordedPrices(snapshots, listingId)
  const snaps = [recorded.from, recorded.lower, recorded.antelopeX].filter(
    (row): row is MarketSnapshot => row != null
  )
  const first = <T>(pick: (row: MarketSnapshot) => T | null | undefined): T | null => {
    for (const row of snaps) {
      const value = pick(row)
      if (value == null) continue
      if (Array.isArray(value) && value.length === 0) continue
      return value
    }
    return null
  }
  return {
    rating: first((row) => row.rating),
    reviewCount: first((row) => row.review_count),
    badges: first((row) => (row.badges.length ? row.badges : null)) ?? [],
    observedOn: snaps[0]?.observed_on ?? null,
  }
}
