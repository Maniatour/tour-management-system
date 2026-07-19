import type { AdminEditLocale } from '@/lib/adminEditLocales'
import { ADMIN_EDIT_LOCALE_OPTIONS } from '@/lib/adminEditLocales'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'

/** 고객 사이트에 노출되는 핵심 상세 필드 */
export const LOCALE_READINESS_DETAIL_FIELDS = [
  'slogan1',
  'slogan2',
  'slogan3',
  'description',
  'included',
  'not_included',
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'notice_info',
  'cancellation_policy',
] as const

export type LocaleReadinessDetailField = (typeof LOCALE_READINESS_DETAIL_FIELDS)[number]

export type LocaleReadinessBasicField = 'customerName' | 'summary'

export type LocaleReadinessFieldKey =
  | LocaleReadinessBasicField
  | LocaleReadinessDetailField

export type LocaleReadinessFieldStatus = {
  key: LocaleReadinessFieldKey
  kind: 'basic' | 'detail'
  filled: boolean
  /** 고객 페이지에서 숨김(명시적 false) — 준비도 분모에서 제외 */
  hidden: boolean
}

export type LocaleReadinessScore = {
  locale: AdminEditLocale
  filled: number
  total: number
  percent: number
  fields: LocaleReadinessFieldStatus[]
  missingKeys: LocaleReadinessFieldKey[]
}

export type ProductLocaleReadiness = {
  productId: string
  productName: string
  status: string | null
  isPublished: boolean
  byLocale: Record<AdminEditLocale, LocaleReadinessScore>
  /** 언어별 % 평균 */
  overallPercent: number
}

export type ProductDetailsMultilingualRow = {
  product_id: string
  language_code: string
  channel_id: string | null
  slogan1?: string | null
  slogan2?: string | null
  slogan3?: string | null
  description?: string | null
  included?: string | null
  not_included?: string | null
  pickup_drop_info?: string | null
  luggage_info?: string | null
  tour_operation_info?: string | null
  preparation_info?: string | null
  small_group_info?: string | null
  notice_info?: string | null
  cancellation_policy?: string | null
  customer_page_visibility?: unknown
}

export type ProductLocaleReadinessSource = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
  summary_ko?: string | null
  summary_en?: string | null
  status?: string | null
  is_published?: boolean | null
}

export const LOCALE_READINESS_LOCALES: readonly AdminEditLocale[] =
  ADMIN_EDIT_LOCALE_OPTIONS.map((o) => o.locale)

export function isLocaleReadinessFilled(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

/** 홈페이지 채널 행 우선, 없으면 channel_id null(공통), 그다음 임의 행 */
export function pickBestDetailsRow(
  rows: ProductDetailsMultilingualRow[],
  languageCode: string,
  homepageChannelId?: string | null
): ProductDetailsMultilingualRow | null {
  const forLang = rows.filter(
    (r) => (r.language_code || 'ko').toLowerCase() === languageCode.toLowerCase()
  )
  if (forLang.length === 0) return null

  if (homepageChannelId) {
    const home = forLang.find((r) => r.channel_id === homepageChannelId)
    if (home) return home
  }

  const common = forLang.find((r) => r.channel_id == null || r.channel_id === '')
  if (common) return common

  return forLang[0] ?? null
}

function basicValue(
  product: ProductLocaleReadinessSource,
  locale: AdminEditLocale,
  field: LocaleReadinessBasicField
): unknown {
  if (field === 'customerName') {
    return locale === 'en' ? product.customer_name_en : product.customer_name_ko
  }
  return locale === 'en' ? product.summary_en : product.summary_ko
}

function displayProductName(product: ProductLocaleReadinessSource, uiLocale: string): string {
  if (uiLocale === 'en') {
    return (
      product.customer_name_en?.trim() ||
      product.name_en?.trim() ||
      product.customer_name_ko?.trim() ||
      product.name_ko?.trim() ||
      product.name?.trim() ||
      product.id
    )
  }
  return (
    product.customer_name_ko?.trim() ||
    product.name_ko?.trim() ||
    product.name?.trim() ||
    product.customer_name_en?.trim() ||
    product.id
  )
}

export function computeLocaleReadinessScore(
  product: ProductLocaleReadinessSource,
  locale: AdminEditLocale,
  detailsRow: ProductDetailsMultilingualRow | null
): LocaleReadinessScore {
  const fields: LocaleReadinessFieldStatus[] = []

  for (const key of ['customerName', 'summary'] as const) {
    fields.push({
      key,
      kind: 'basic',
      filled: isLocaleReadinessFilled(basicValue(product, locale, key)),
      hidden: false,
    })
  }

  const visibility = detailsRow?.customer_page_visibility
  for (const key of LOCALE_READINESS_DETAIL_FIELDS) {
    const hidden = !isProductDetailVisibleOnCustomerPage(visibility, key)
    const raw = detailsRow ? (detailsRow as Record<string, unknown>)[key] : null
    fields.push({
      key,
      kind: 'detail',
      filled: !hidden && isLocaleReadinessFilled(raw),
      hidden,
    })
  }

  const counted = fields.filter((f) => !f.hidden)
  const filled = counted.filter((f) => f.filled).length
  const total = counted.length
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100)

  return {
    locale,
    filled,
    total,
    percent,
    fields,
    missingKeys: counted.filter((f) => !f.filled).map((f) => f.key),
  }
}

export function computeProductLocaleReadiness(
  product: ProductLocaleReadinessSource,
  detailRows: ProductDetailsMultilingualRow[],
  options?: {
    homepageChannelId?: string | null
    uiLocale?: string
  }
): ProductLocaleReadiness {
  const byLocale = {} as Record<AdminEditLocale, LocaleReadinessScore>
  let percentSum = 0

  for (const locale of LOCALE_READINESS_LOCALES) {
    const row = pickBestDetailsRow(detailRows, locale, options?.homepageChannelId)
    const score = computeLocaleReadinessScore(product, locale, row)
    byLocale[locale] = score
    percentSum += score.percent
  }

  return {
    productId: product.id,
    productName: displayProductName(product, options?.uiLocale || 'ko'),
    status: product.status ?? null,
    isPublished: product.is_published !== false,
    byLocale,
    overallPercent: Math.round(percentSum / LOCALE_READINESS_LOCALES.length),
  }
}

export function computeProductsLocaleReadiness(
  products: ProductLocaleReadinessSource[],
  allDetailRows: ProductDetailsMultilingualRow[],
  options?: {
    homepageChannelId?: string | null
    uiLocale?: string
  }
): ProductLocaleReadiness[] {
  const byProduct = new Map<string, ProductDetailsMultilingualRow[]>()
  for (const row of allDetailRows) {
    const list = byProduct.get(row.product_id) || []
    list.push(row)
    byProduct.set(row.product_id, list)
  }

  return products.map((product) =>
    computeProductLocaleReadiness(product, byProduct.get(product.id) || [], options)
  )
}
