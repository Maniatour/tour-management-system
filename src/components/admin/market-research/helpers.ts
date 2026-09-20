import type {
  MarketBadgeCatalogItem,
  MarketCatalogChannel,
  MarketCatalogProduct,
  MarketCompareItemCatalog,
  MarketCompetitor,
  MarketListing,
  MarketPriceAlert,
  MarketSnapshot,
  MarketFocusProduct,
  MarketOurOffer,
  OurPriceOverlay,
} from '@/lib/market-research/types'

export type MarketResearchBundle = {
  today: string
  competitors: MarketCompetitor[]
  listings: MarketListing[]
  snapshots: MarketSnapshot[]
  alerts: MarketPriceAlert[]
  products: MarketCatalogProduct[]
  channels: MarketCatalogChannel[]
  focusProducts: MarketFocusProduct[]
  badges: MarketBadgeCatalogItem[]
  compareItems: MarketCompareItemCatalog[]
  ourOffers: MarketOurOffer[]
  ourPrices: Record<string, OurPriceOverlay>
  ourPlatformPrices: Record<string, OurPriceOverlay>
}

export function productLabel(product: MarketCatalogProduct | undefined, isKo: boolean): string {
  if (!product) return ''
  if (isKo) return product.name_ko || product.name || product.id
  return product.name_en || product.name || product.id
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—'
  const hasCents = Math.round(value * 100) % 100 !== 0
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}
