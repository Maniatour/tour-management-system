import type { Product } from '@/components/product/productDetailTypes'
import {
  getProductLocalizedField,
  type ProductFieldTranslationRow,
  type ProductLegacyI18nSource,
} from '@/lib/productFieldTranslations'
import { normalizeSiteLocale, resolveFileMessageLocale } from '@/lib/siteLocales'

const CATEGORY_LABELS_EN: Record<string, string> = {
  city: 'City',
  nature: 'Nature',
  culture: 'Culture',
  adventure: 'Adventure',
  food: 'Food',
  tour: 'Tour',
  sightseeing: 'Sightseeing',
  outdoor: 'Outdoor',
}

const CATEGORY_LABELS_KO: Record<string, string> = {
  city: '도시',
  nature: '자연',
  culture: '문화',
  adventure: '모험',
  food: '음식',
  tour: '투어',
  sightseeing: '관광',
  outdoor: '야외활동',
}

export function getProductCategoryLabel(category: string, isEnglish: boolean): string {
  const labels = isEnglish ? CATEGORY_LABELS_EN : CATEGORY_LABELS_KO
  return labels[category] || category
}

/** Prefer UI chrome language for category labels (ko vs en file messages). */
export function getProductCategoryLabelForLocale(category: string, locale: string): string {
  return getProductCategoryLabel(category, resolveFileMessageLocale(locale) === 'en')
}

export function getProductCustomerDisplayName(
  product: Product | ProductLegacyI18nSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  const siteLocale = normalizeSiteLocale(locale)
  return (
    getProductLocalizedField(product, 'customer_name', siteLocale, translationRows) ||
    getProductLocalizedField(product, 'name', siteLocale, translationRows) ||
    product.name?.trim() ||
    ''
  )
}

export function parseProductPriceValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** 기본 가격이 없거나 0인지 (빈 문자열·null·undefined·0) */
export function isEmptyProductBasePrice(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string' && !value.trim()) return true
  const parsed = parseProductPriceValue(value)
  return parsed == null || parsed <= 0
}

/**
 * 목록·홈 카드 가격 — adult_base_price 우선, 없으면 base_price.
 * 둘 다 0/없으면 lowest_choice_price(초이스 최저가)로 폴백.
 */
export function resolveProductListingPrice(product: Record<string, unknown>): number | null {
  const adult = parseProductPriceValue(product.adult_base_price)
  const base = parseProductPriceValue(product.base_price)
  const lowestChoice = parseProductPriceValue(product.lowest_choice_price)

  if (adult != null && adult > 0) return adult
  if (base != null && base > 0) return base
  if (lowestChoice != null && lowestChoice > 0) return lowestChoice
  return adult ?? base ?? lowestChoice
}

/**
 * 상세 예약 패널 등 — 기본가가 0/빈칸이면 초이스 최저가를 표시용으로 사용.
 * 예약 합계 계산용 basePrice는 바꾸지 말 것.
 */
export function resolveDisplayBasePrice(
  basePrice: number | null | undefined,
  lowestChoicePrice: number | null | undefined
): number {
  if (!isEmptyProductBasePrice(basePrice)) {
    return parseProductPriceValue(basePrice) ?? 0
  }
  if (lowestChoicePrice != null && Number.isFinite(lowestChoicePrice) && lowestChoicePrice > 0) {
    return lowestChoicePrice
  }
  return parseProductPriceValue(basePrice) ?? 0
}

export type ProductSummarySource = ProductLegacyI18nSource & {
  description?: string | null
}

/** 목록·홈 카드 등 짧은 설명 — locale별 요약 우선, 없으면 products.description */
export function getProductSummaryByLocale(
  product: ProductSummarySource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  const summary = getProductLocalizedField(
    product,
    'summary',
    normalizeSiteLocale(locale),
    translationRows
  )
  if (summary) return summary
  return product.description?.trim() ?? ''
}

/** 상품 상세 개요 탭 — 상세정보 description 우선, 없으면 요약·내부 설명 */
export function getProductOverviewDescription(
  product: ProductSummarySource,
  productDetailsDescription: string | null | undefined,
  locale: string,
  fallback = '',
  translationRows: ProductFieldTranslationRow[] = []
): string {
  const details = productDetailsDescription?.trim()
  if (details) return details
  const summary = getProductSummaryByLocale(product, locale, translationRows)
  if (summary) return summary
  return fallback
}

export function formatProductDuration(duration: string | null, isEnglish: boolean): string {
  if (!duration) return isEnglish ? 'Not specified' : '미정'

  const timeMatch = duration.match(/^(\d+):(\d+):(\d+)$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const seconds = parseInt(timeMatch[3], 10)
    const totalHours = hours + minutes / 60 + seconds / 3600
    const days = Math.ceil(totalHours / 24)

    if (days === 1) {
      if (hours === 0 && minutes > 0) {
        return isEnglish ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes}분`
      }
      if (hours > 0 && minutes === 0) {
        return isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
      }
      if (hours > 0 && minutes > 0) {
        const hourLabel = isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
        const minuteLabel = isEnglish
          ? `${minutes} minute${minutes === 1 ? '' : 's'}`
          : `${minutes}분`
        return `${hourLabel} ${minuteLabel}`
      }
      const formattedHours = Math.round(totalHours * 10) / 10
      return isEnglish ? `${formattedHours} hours` : `${formattedHours}시간`
    }

    if (days === 2) return isEnglish ? '1 night 2 days' : '1박 2일'
    if (days === 3) return isEnglish ? '2 nights 3 days' : '2박 3일'
    if (days === 4) return isEnglish ? '3 nights 4 days' : '3박 4일'
    if (days === 5) return isEnglish ? '4 nights 5 days' : '4박 5일'
    if (days === 6) return isEnglish ? '5 nights 6 days' : '5박 6일'
    if (days === 7) return isEnglish ? '6 nights 7 days' : '6박 7일'

    const nights = days - 1
    return isEnglish
      ? `${nights} night${nights === 1 ? '' : 's'} ${days} day${days === 1 ? '' : 's'}`
      : `${nights}박 ${days}일`
  }

  return duration
}

/**
 * 홈·목록 카드용 짧은 소요시간 — "18:00:00"→"18hr", "48"→"2D1N", "1.5"→"1.5hr"
 * (숫자 문자열은 시간 단위로 해석, 24시간 이상은 박/일 표기)
 */
export function formatProductDurationShort(
  duration: string | null | undefined,
  isEnglish: boolean
): string | null {
  if (!duration) return null
  const trimmed = duration.trim()
  if (!trimmed) return null

  let totalHours: number | null = null

  const timeMatch = trimmed.match(/^(\d+):(\d+)(?::(\d+))?$/)
  if (timeMatch) {
    totalHours =
      parseInt(timeMatch[1]!, 10) +
      parseInt(timeMatch[2]!, 10) / 60 +
      (timeMatch[3] ? parseInt(timeMatch[3], 10) / 3600 : 0)
  } else if (/^\d+(\.\d+)?$/.test(trimmed)) {
    totalHours = parseFloat(trimmed)
  }

  if (totalHours == null || Number.isNaN(totalHours) || totalHours <= 0) {
    return trimmed
  }

  if (totalHours >= 24) {
    const days = Math.ceil(totalHours / 24)
    const nights = days - 1
    return isEnglish ? `${days}D${nights}N` : `${nights}박 ${days}일`
  }

  const rounded = Math.round(totalHours * 10) / 10
  return isEnglish ? `${rounded}hr` : `${rounded}시간`
}

export type ProductLocationSource = ProductLegacyI18nSource

export function getProductDepartureCity(
  product: ProductLocationSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  return getProductLocalizedField(
    product,
    'departure_city',
    normalizeSiteLocale(locale),
    translationRows
  )
}

export function getProductArrivalCity(
  product: ProductLocationSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  return getProductLocalizedField(
    product,
    'arrival_city',
    normalizeSiteLocale(locale),
    translationRows
  )
}

export function getProductDepartureCountry(
  product: ProductLocationSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  return getProductLocalizedField(
    product,
    'departure_country',
    normalizeSiteLocale(locale),
    translationRows
  )
}

export function getProductArrivalCountry(
  product: ProductLocationSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  return getProductLocalizedField(
    product,
    'arrival_country',
    normalizeSiteLocale(locale),
    translationRows
  )
}

/** 목록 카드 등 — 출발지 한 줄 표기 */
export function formatProductDepartureLine(
  product: ProductLocationSource,
  locale: string,
  translationRows: ProductFieldTranslationRow[] = []
): string {
  const city = getProductDepartureCity(product, locale, translationRows)
  const country = getProductDepartureCountry(product, locale, translationRows)
  if (!city) return ''
  return country ? `${city}, ${country}` : city
}
