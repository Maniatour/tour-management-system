import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { BasicFieldKey, DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'
import {
  loadZoneDetailFieldBindings,
  loadZoneFieldBindings,
  readBasicFieldValue,
  readDetailBoundValue,
  resolveEditSlotsForBasicFields,
  resolveEditSlotsForDetailFields,
  type DetailBindingKey,
} from '@/lib/customerPageFieldBindings'
import {
  formatProductDepartureLine,
  getProductCustomerDisplayName,
  getProductOverviewDescription,
  getProductSummaryByLocale,
} from '@/lib/productDetailDisplay'

function readBoundBasic(
  zone: CustomerPageZone,
  slotId: string,
  product: Record<string, unknown>
): string {
  const config = getZoneEditConfig(zone)
  if (!config?.basicFields?.length) return ''
  const slots = resolveEditSlotsForBasicFields(config.basicFields)
  const slot = slots.find((s) => s.slotId === slotId)
  if (!slot) return ''
  const bindings = loadZoneFieldBindings(zone, slots)
  const bound = bindings[slotId] ?? slot.defaultOption
  const raw = readBasicFieldValue(product, bound)
  return Array.isArray(raw) ? raw.join(', ') : String(raw ?? '').trim()
}

/** 미리보기 편집 — zone 바인딩에 따른 상품명 (없으면 null → 기본 로직 사용) */
export function resolveBoundProductDisplayName(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string | null {
  const config = getZoneEditConfig(zone)
  if (!config?.basicFields?.length) return null

  const slots = resolveEditSlotsForBasicFields(config.basicFields)
  const slotId = locale === 'en' ? 'productNameEn' : 'productNameKo'
  if (!slots.some((s) => s.slotId === slotId)) return null

  const text = readBoundBasic(zone, slotId, product)
  return text || null
}

export function resolveBoundProductSummary(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string | null {
  const config = getZoneEditConfig(zone)
  if (!config?.basicFields?.length) return null

  const slots = resolveEditSlotsForBasicFields(config.basicFields)
  const slotId = locale === 'en' ? 'summaryEn' : 'summaryKo'
  if (!slots.some((s) => s.slotId === slotId)) return null

  const text = readBoundBasic(zone, slotId, product)
  return text || null
}

export function resolveBoundDepartureLine(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string | null {
  const config = getZoneEditConfig(zone)
  if (!config?.basicFields?.length) return null

  const slots = resolveEditSlotsForBasicFields(config.basicFields)
  const citySlotId = locale === 'en' ? 'departureCityEn' : 'departureCityKo'
  const countrySlotId = locale === 'en' ? 'departureCountryEn' : 'departureCountryKo'

  if (!slots.some((s) => s.slotId === citySlotId)) return null

  const city = readBoundBasic(zone, citySlotId, product)
  if (!city) return null

  const country = slots.some((s) => s.slotId === countrySlotId)
    ? readBoundBasic(zone, countrySlotId, product)
    : ''

  return country ? `${city}, ${country}` : city
}

export function resolveBoundListingPrice(
  zone: CustomerPageZone,
  product: Record<string, unknown>
): number | null {
  const config = getZoneEditConfig(zone)
  if (!config?.basicFields?.length) return null

  const slots = resolveEditSlotsForBasicFields(config.basicFields)
  if (!slots.some((s) => s.slotId === 'adultBasePrice')) return null

  const bindings = loadZoneFieldBindings(zone, slots)
  const bound = bindings.adultBasePrice ?? 'adultBasePrice'
  const raw = readBasicFieldValue(product, bound as BasicFieldKey)
  if (raw === '' || raw == null) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

export function resolveBoundDetailText(
  zone: CustomerPageZone,
  field: DetailFieldKey,
  product: Record<string, unknown>,
  productDetails: Record<string, unknown> | null | undefined
): string {
  const config = getZoneEditConfig(zone)
  const detailFields = config?.detailFields ?? [field]
  if (!detailFields.includes(field) && config?.editType !== 'detail-fields') {
    return productDetails?.[field] != null ? String(productDetails[field]).trim() : ''
  }

  const slots = resolveEditSlotsForDetailFields([field])
  const bindings = loadZoneDetailFieldBindings(zone, slots)
  const bound: DetailBindingKey = bindings[field] ?? field
  const detailRow = productDetails ?? {}
  return readDetailBoundValue(bound, detailRow, product).trim()
}

/** 바인딩 미적용 시와 동일한 fallback 포함 */
export function getPreviewProductDisplayName(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string {
  const config = getZoneEditConfig(zone)
  const slots = config?.basicFields ? resolveEditSlotsForBasicFields(config.basicFields) : []
  const slotId = locale === 'en' ? 'productNameEn' : 'productNameKo'
  if (slots.some((s) => s.slotId === slotId)) {
    return readBoundBasic(zone, slotId, product)
  }
  return getProductCustomerDisplayName(product as Parameters<typeof getProductCustomerDisplayName>[0], locale)
}

export function getPreviewProductSummary(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string {
  const config = getZoneEditConfig(zone)
  const slots = config?.basicFields ? resolveEditSlotsForBasicFields(config.basicFields) : []
  const slotId = locale === 'en' ? 'summaryEn' : 'summaryKo'
  if (slots.some((s) => s.slotId === slotId)) {
    return readBoundBasic(zone, slotId, product)
  }
  return getProductSummaryByLocale(product as Parameters<typeof getProductSummaryByLocale>[0], locale)
}

export function getPreviewDepartureLine(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  locale: string
): string {
  const config = getZoneEditConfig(zone)
  const slots = config?.basicFields ? resolveEditSlotsForBasicFields(config.basicFields) : []
  const citySlotId = locale === 'en' ? 'departureCityEn' : 'departureCityKo'
  if (slots.some((s) => s.slotId === citySlotId)) {
    return resolveBoundDepartureLine(zone, product, locale) ?? ''
  }
  return formatProductDepartureLine(product as Parameters<typeof formatProductDepartureLine>[0], locale)
}

export function getPreviewListingPrice(
  zone: CustomerPageZone,
  product: Record<string, unknown>,
  fallback: number | null
): number | null {
  const config = getZoneEditConfig(zone)
  const slots = config?.basicFields ? resolveEditSlotsForBasicFields(config.basicFields) : []
  if (slots.some((s) => s.slotId === 'adultBasePrice')) {
    const bound = resolveBoundListingPrice(zone, product)
    if (bound != null) return bound
  }
  return fallback
}

export function getPreviewOverviewDescription(
  zone: CustomerPageZone,
  product: Parameters<typeof getProductOverviewDescription>[0],
  productDetailsDescription: string | null | undefined,
  productDetails: Record<string, unknown> | null | undefined,
  locale: string,
  fallback: string
): string {
  const config = getZoneEditConfig(zone)
  if (config?.detailFields?.includes('description') || zone === 'detail-overview-description') {
    return resolveBoundDetailText(
      zone,
      'description',
      product as Record<string, unknown>,
      productDetails
    )
  }
  return getProductOverviewDescription(product, productDetailsDescription, locale, fallback)
}

export function getPreviewDetailFieldHtml(
  zone: CustomerPageZone,
  field: DetailFieldKey,
  product: Record<string, unknown>,
  productDetails: Record<string, unknown> | null | undefined,
  fallback: string | null | undefined
): string {
  const config = getZoneEditConfig(zone)
  const inZone = config?.detailFields?.includes(field)
  if (inZone || config?.editType === 'detail-fields') {
    return resolveBoundDetailText(zone, field, product, productDetails)
  }
  return fallback?.trim() ?? ''
}
