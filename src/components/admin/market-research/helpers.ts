import type {
  MarketCatalogChannel,
  MarketCatalogProduct,
  MarketCompetitor,
  MarketListing,
  MarketPriceAlert,
  MarketSnapshot,
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
  ourPrices: Record<string, OurPriceOverlay>
}

export function productLabel(product: MarketCatalogProduct | undefined, isKo: boolean): string {
  if (!product) return ''
  if (isKo) return product.name_ko || product.name || product.id
  return product.name_en || product.name || product.id
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
