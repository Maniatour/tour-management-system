import { getProductSummaryByLocale, formatProductDepartureLine, resolveProductListingPrice } from '@/lib/productDetailDisplay'
import {
  getPreviewDepartureLine,
  getPreviewListingPrice,
  getPreviewProductDisplayName,
  getPreviewProductSummary,
} from '@/lib/customerPageDisplayFromBindings'
import type { HomePageSectionEntry } from '@/lib/customerPageHomeSectionCatalog'
import type { BasicFieldKey } from '@/lib/customerPageZoneEditMap'
import { dbColumnForBasicField, resolveLocaleBasicField } from '@/lib/customerPageFieldBindings'

type ProductRow = Record<string, unknown>

function readProductField(product: ProductRow, field: BasicFieldKey, locale: string): string | null {
  const localizedField = resolveLocaleBasicField(field, locale)
  const col = dbColumnForBasicField(localizedField)
  const raw = product[col]
  if (raw == null) return null
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (Array.isArray(raw)) return raw.join(', ')
  return null
}

function readProductNumber(product: ProductRow, field: BasicFieldKey): number | null {
  const col = dbColumnForBasicField(field)
  const raw = product[col]
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function getSectionProductName(
  section: HomePageSectionEntry,
  product: ProductRow,
  locale: string,
  bindingsActive: boolean
): string {
  const field = section.config.cardFieldBindings?.title
  if (field) {
    const direct = readProductField(product, field, locale)
    if (direct) return direct
  }
  if (bindingsActive) {
    const name = getPreviewProductDisplayName('listing-card-name', product, locale)
    if (name) return name
  }
  if (locale === 'en') {
    return (
      String(product.customer_name_en ?? product.name_en ?? '').trim() || 'Untitled Tour'
    )
  }
  return String(product.customer_name_ko ?? product.name ?? '').trim() || '이름 없는 투어'
}

export function getSectionProductDescription(
  section: HomePageSectionEntry,
  product: ProductRow,
  locale: string,
  bindingsActive: boolean
): string {
  const field = section.config.cardFieldBindings?.description
  if (field) {
    const direct = readProductField(product, field, locale)
    if (direct) return direct
  }
  if (bindingsActive) {
    const text = getPreviewProductSummary('listing-card-description', product, locale)
    if (text) return text
  }
  const summary = getProductSummaryByLocale(product as Parameters<typeof getProductSummaryByLocale>[0], locale)
  return summary || (locale === 'en' ? 'Detailed information is being prepared.' : '상세 정보가 준비 중입니다.')
}

export function getSectionProductDepartureLine(
  section: HomePageSectionEntry,
  product: ProductRow,
  locale: string,
  bindingsActive: boolean
): string | null {
  const field = section.config.cardFieldBindings?.location
  if (field) {
    const direct = readProductField(product, field, locale)
    if (direct) return direct
  }
  if (bindingsActive) {
    return getPreviewDepartureLine('listing-card-location', product, locale)
  }
  return formatProductDepartureLine(product as Parameters<typeof formatProductDepartureLine>[0], locale)
}

export function getSectionProductPrice(
  section: HomePageSectionEntry,
  product: ProductRow,
  bindingsActive: boolean
): number | null {
  const fallback = resolveProductListingPrice(product)
  const field = section.config.cardFieldBindings?.price
  if (field) {
    const direct = readProductNumber(product, field)
    if (direct != null && direct > 0) return direct
    if (fallback != null && fallback > 0) return fallback
    if (direct != null) return direct
  }
  if (bindingsActive) {
    return getPreviewListingPrice('listing-card-price', product, fallback)
  }
  return fallback
}
