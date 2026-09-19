import type { MarketCanyonVariant, MarketOfferType, MarketSnapshot } from './types'
import { marketPriceAxisKey } from './types'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
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

export function listingAxes(listing: {
  has_lower: boolean
  has_antelope_x: boolean
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
}): Array<{ canyon: MarketCanyonVariant; offer: MarketOfferType }> {
  const canyons: MarketCanyonVariant[] = []
  if (listing.has_lower) canyons.push('lower')
  if (listing.has_antelope_x) canyons.push('antelope_x')
  if (canyons.length === 0) canyons.push('unspecified')

  const offers: MarketOfferType[] = []
  if (listing.has_all_inclusive) offers.push('all_inclusive')
  if (listing.has_sale_plus_excluded) offers.push('sale_plus_excluded')
  if (offers.length === 0) offers.push('all_inclusive')

  const axes: Array<{ canyon: MarketCanyonVariant; offer: MarketOfferType }> = []
  for (const canyon of canyons) {
    for (const offer of offers) axes.push({ canyon, offer })
  }
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

export function inferAutoSnapshotAxis(listing: {
  has_lower: boolean
  has_antelope_x: boolean
  has_all_inclusive: boolean
  has_sale_plus_excluded: boolean
}): { canyon: MarketCanyonVariant; offer: MarketOfferType; needsManualSplit: boolean } {
  const canyon: MarketCanyonVariant =
    listing.has_lower && !listing.has_antelope_x
      ? 'lower'
      : listing.has_antelope_x && !listing.has_lower
        ? 'antelope_x'
        : 'unspecified'
  const offer: MarketOfferType =
    listing.has_sale_plus_excluded && !listing.has_all_inclusive
      ? 'sale_plus_excluded'
      : 'all_inclusive'
  return {
    canyon,
    offer,
    needsManualSplit: expectedAxisCount(listing) > 1,
  }
}
