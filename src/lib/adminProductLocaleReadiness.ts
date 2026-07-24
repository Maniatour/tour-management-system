import type { AdminEditLocale } from '@/lib/adminEditLocales'
import { ADMIN_EDIT_LOCALE_OPTIONS } from '@/lib/adminEditLocales'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import {
  buildProductTranslationMap,
  type ProductFieldTranslationRow,
  type ProductLegacyI18nSource,
} from '@/lib/productFieldTranslations'
import { getFaqI18nMap, type FaqContentI18n } from '@/lib/productFaqLocales'
import {
  getChoiceGroupI18nMap,
  getChoiceOptionI18nMap,
  type ChoiceContentI18n,
} from '@/lib/productChoiceLocales'
import {
  getScheduleI18nMap,
  type ScheduleContentI18n,
} from '@/lib/productScheduleLocales'
import {
  getTourCourseI18nMap,
  type TourCourseContentI18n,
} from '@/lib/productTourCourseLocales'
import { getSiteLocaleMeta, type SiteLocale } from '@/lib/siteLocales'

/** 고객 사이트에 노출되는 핵심 상세 필드 */
export const LOCALE_READINESS_DETAIL_FIELDS = [
  'slogan1',
  'slogan2',
  'slogan3',
  'slogan4',
  'slogan5',
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

export type LocaleReadinessRelatedField =
  | 'faq'
  | 'choices'
  | 'schedules'
  | 'tourCourses'

export type LocaleReadinessFieldKey =
  | LocaleReadinessBasicField
  | LocaleReadinessDetailField
  | LocaleReadinessRelatedField

export type LocaleReadinessFieldStatus = {
  key: LocaleReadinessFieldKey
  kind: 'basic' | 'detail' | 'related'
  filled: boolean
  /** 고객 페이지에서 숨김(명시적 false) 또는 해당 콘텐츠 없음 — 준비도 분모에서 제외 */
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
  slogan4?: string | null
  slogan5?: string | null
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

export type ProductLocaleReadinessSource = ProductLegacyI18nSource & {
  id: string
  status?: string | null
  is_published?: boolean | null
}

export type LocaleReadinessFaqRow = {
  product_id: string
  is_active?: boolean | null
  question?: string | null
  answer?: string | null
  question_en?: string | null
  answer_en?: string | null
  content_i18n?: FaqContentI18n | null
}

export type LocaleReadinessChoiceOptionRow = {
  option_name?: string | null
  option_name_ko?: string | null
  content_i18n?: ChoiceContentI18n | null
  is_active?: boolean | null
}

export type LocaleReadinessChoiceRow = {
  product_id: string
  choice_group_ko?: string | null
  choice_group_en?: string | null
  content_i18n?: ChoiceContentI18n | null
  options?: LocaleReadinessChoiceOptionRow[] | null
}

export type LocaleReadinessScheduleRow = {
  product_id: string
  show_to_customers?: boolean | null
  title_ko?: string | null
  title_en?: string | null
  content_i18n?: ScheduleContentI18n | null
}

export type LocaleReadinessTourCourseRow = {
  product_id: string
  customer_name_ko?: string | null | undefined
  customer_name_en?: string | null | undefined
  customer_description_ko?: string | null | undefined
  customer_description_en?: string | null | undefined
  content_i18n?: TourCourseContentI18n | null | undefined
}

/** Related multilingual content bundled per readiness load. */
export type LocaleReadinessRelatedBundle = {
  faqs: LocaleReadinessFaqRow[]
  choices: LocaleReadinessChoiceRow[]
  schedules: LocaleReadinessScheduleRow[]
  tourCourses: LocaleReadinessTourCourseRow[]
}

export const LOCALE_READINESS_LOCALES: readonly AdminEditLocale[] =
  ADMIN_EDIT_LOCALE_OPTIONS.map((o) => o.locale)

export function isLocaleReadinessFilled(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function hasExactLocaleText(
  map: Partial<Record<SiteLocale, string>> | undefined,
  locale: AdminEditLocale
): boolean {
  return Boolean(map?.[locale]?.trim())
}

function allItemsReady(count: number, readyCount: number): {
  hidden: boolean
  filled: boolean
} {
  if (count === 0) return { hidden: true, filled: false }
  return { hidden: false, filled: readyCount === count }
}

function scoreFaqRelated(
  rows: LocaleReadinessFaqRow[],
  locale: AdminEditLocale
): { hidden: boolean; filled: boolean } {
  const active = rows.filter((row) => row.is_active !== false)
  let ready = 0
  for (const row of active) {
    const q = hasExactLocaleText(getFaqI18nMap(row, 'question'), locale)
    const a = hasExactLocaleText(getFaqI18nMap(row, 'answer'), locale)
    if (q && a) ready += 1
  }
  return allItemsReady(active.length, ready)
}

function scoreChoicesRelated(
  rows: LocaleReadinessChoiceRow[],
  locale: AdminEditLocale
): { hidden: boolean; filled: boolean } {
  if (rows.length === 0) return { hidden: true, filled: false }
  let itemCount = 0
  let ready = 0
  for (const group of rows) {
    itemCount += 1
    if (hasExactLocaleText(getChoiceGroupI18nMap(group, 'name'), locale)) ready += 1
    for (const option of group.options || []) {
      if (option.is_active === false) continue
      itemCount += 1
      if (hasExactLocaleText(getChoiceOptionI18nMap(option, 'name'), locale)) ready += 1
    }
  }
  return allItemsReady(itemCount, ready)
}

function scoreSchedulesRelated(
  rows: LocaleReadinessScheduleRow[],
  locale: AdminEditLocale
): { hidden: boolean; filled: boolean } {
  const visible = rows.filter((row) => row.show_to_customers !== false)
  let ready = 0
  for (const row of visible) {
    if (hasExactLocaleText(getScheduleI18nMap(row, 'title'), locale)) ready += 1
  }
  return allItemsReady(visible.length, ready)
}

function scoreTourCoursesRelated(
  rows: LocaleReadinessTourCourseRow[],
  locale: AdminEditLocale
): { hidden: boolean; filled: boolean } {
  // Only courses that already have customer-facing name in some language.
  const withCustomerCopy = rows.filter((row) => {
    const nameMap = getTourCourseI18nMap(row, 'name')
    return Object.values(nameMap).some((value) => value?.trim())
  })
  let ready = 0
  for (const row of withCustomerCopy) {
    if (hasExactLocaleText(getTourCourseI18nMap(row, 'name'), locale)) ready += 1
  }
  return allItemsReady(withCustomerCopy.length, ready)
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
  field: LocaleReadinessBasicField,
  translationRows: ProductFieldTranslationRow[]
): unknown {
  const map = buildProductTranslationMap(product, translationRows)
  const key = field === 'customerName' ? 'customer_name' : 'summary'
  return map[key]?.[locale] ?? ''
}

function displayProductName(
  product: ProductLocaleReadinessSource,
  uiLocale: string,
  translationRows: ProductFieldTranslationRow[]
): string {
  const map = buildProductTranslationMap(product, translationRows)
  const order = [
    ...(isLocaleCode(uiLocale) ? [uiLocale as SiteLocale] : []),
    'ko',
    'en',
  ] as SiteLocale[]

  for (const code of order) {
    const customer = map.customer_name?.[code]?.trim()
    if (customer) return customer
    const name = map.name?.[code]?.trim()
    if (name) return name
  }

  return product.name?.trim() || product.id
}

function isLocaleCode(value: string): value is SiteLocale {
  return LOCALE_READINESS_LOCALES.includes(value as AdminEditLocale)
}

export function computeLocaleReadinessScore(
  product: ProductLocaleReadinessSource,
  locale: AdminEditLocale,
  detailsRow: ProductDetailsMultilingualRow | null,
  translationRows: ProductFieldTranslationRow[] = [],
  related?: LocaleReadinessRelatedBundle
): LocaleReadinessScore {
  const fields: LocaleReadinessFieldStatus[] = []

  for (const key of ['customerName', 'summary'] as const) {
    fields.push({
      key,
      kind: 'basic',
      filled: isLocaleReadinessFilled(basicValue(product, locale, key, translationRows)),
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

  if (related) {
    const faqScore = scoreFaqRelated(related.faqs, locale)
    fields.push({ key: 'faq', kind: 'related', ...faqScore })
    const choiceScore = scoreChoicesRelated(related.choices, locale)
    fields.push({ key: 'choices', kind: 'related', ...choiceScore })
    const scheduleScore = scoreSchedulesRelated(related.schedules, locale)
    fields.push({ key: 'schedules', kind: 'related', ...scheduleScore })
    const courseScore = scoreTourCoursesRelated(related.tourCourses, locale)
    fields.push({ key: 'tourCourses', kind: 'related', ...courseScore })
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

function emptyRelatedBundle(): LocaleReadinessRelatedBundle {
  return { faqs: [], choices: [], schedules: [], tourCourses: [] }
}

export function computeProductLocaleReadiness(
  product: ProductLocaleReadinessSource,
  detailRows: ProductDetailsMultilingualRow[],
  options?: {
    homepageChannelId?: string | null
    uiLocale?: string
    translationRows?: ProductFieldTranslationRow[]
    related?: LocaleReadinessRelatedBundle
  }
): ProductLocaleReadiness {
  const byLocale = {} as Record<AdminEditLocale, LocaleReadinessScore>
  let percentSum = 0
  const translationRows = options?.translationRows || []
  const related = options?.related || emptyRelatedBundle()

  for (const locale of LOCALE_READINESS_LOCALES) {
    const row = pickBestDetailsRow(detailRows, locale, options?.homepageChannelId)
    const score = computeLocaleReadinessScore(
      product,
      locale,
      row,
      translationRows,
      related
    )
    byLocale[locale] = score
    percentSum += score.percent
  }

  return {
    productId: product.id,
    productName: displayProductName(product, options?.uiLocale || 'ko', translationRows),
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
    translationRows?: ProductFieldTranslationRow[]
    relatedByProduct?: Map<string, LocaleReadinessRelatedBundle>
  }
): ProductLocaleReadiness[] {
  const byProduct = new Map<string, ProductDetailsMultilingualRow[]>()
  for (const row of allDetailRows) {
    const list = byProduct.get(row.product_id) || []
    list.push(row)
    byProduct.set(row.product_id, list)
  }

  const translationsByProduct = new Map<string, ProductFieldTranslationRow[]>()
  for (const row of options?.translationRows || []) {
    const list = translationsByProduct.get(row.product_id) || []
    list.push(row)
    translationsByProduct.set(row.product_id, list)
  }

  return products.map((product) =>
    computeProductLocaleReadiness(product, byProduct.get(product.id) || [], {
      homepageChannelId: options?.homepageChannelId ?? null,
      uiLocale: options?.uiLocale ?? 'ko',
      translationRows: translationsByProduct.get(product.id) || [],
      related: options?.relatedByProduct?.get(product.id) || emptyRelatedBundle(),
    })
  )
}

/** Build per-product related bundles from flat query results. */
export function buildRelatedBundlesByProduct(params: {
  faqs: LocaleReadinessFaqRow[]
  choices: LocaleReadinessChoiceRow[]
  schedules: LocaleReadinessScheduleRow[]
  tourCourses: LocaleReadinessTourCourseRow[]
}): Map<string, LocaleReadinessRelatedBundle> {
  const map = new Map<string, LocaleReadinessRelatedBundle>()

  const ensure = (productId: string) => {
    let bundle = map.get(productId)
    if (!bundle) {
      bundle = emptyRelatedBundle()
      map.set(productId, bundle)
    }
    return bundle
  }

  for (const row of params.faqs) {
    if (!row.product_id) continue
    ensure(row.product_id).faqs.push(row)
  }
  for (const row of params.choices) {
    if (!row.product_id) continue
    ensure(row.product_id).choices.push(row)
  }
  for (const row of params.schedules) {
    if (!row.product_id) continue
    ensure(row.product_id).schedules.push(row)
  }
  for (const row of params.tourCourses) {
    if (!row.product_id) continue
    ensure(row.product_id).tourCourses.push(row)
  }

  return map
}

export function localeReadinessLabel(code: AdminEditLocale): string {
  return getSiteLocaleMeta(code).nativeLabel
}

/** Average percent across products for one locale. */
export function averageLocalePercent(
  rows: ProductLocaleReadiness[],
  locale: AdminEditLocale
): number {
  if (rows.length === 0) return 0
  const sum = rows.reduce((acc, row) => acc + (row.byLocale[locale]?.percent ?? 0), 0)
  return Math.round(sum / rows.length)
}
