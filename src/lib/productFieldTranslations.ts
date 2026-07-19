import { supabase } from '@/lib/supabase'
import {
  contentFallbackOrder,
  isLegacyColumnLocale,
  isSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

/** Scalar product fields stored in product_field_translations. */
export const PRODUCT_TRANSLATION_FIELDS = [
  'name',
  'customer_name',
  'summary',
  'departure_city',
  'arrival_city',
  'departure_country',
  'arrival_country',
] as const

export type ProductTranslationField = (typeof PRODUCT_TRANSLATION_FIELDS)[number]

export type ProductFieldTranslationRow = {
  product_id: string
  field_key: string
  locale: string
  value: string | null
}

export type ProductTranslationMap = Partial<
  Record<ProductTranslationField, Partial<Record<SiteLocale, string>>>
>

/** Legacy products row shape used for ko/en merge. */
export type ProductLegacyI18nSource = {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
  summary_ko?: string | null
  summary_en?: string | null
  departure_city?: string | null
  departure_city_ko?: string | null
  departure_city_en?: string | null
  arrival_city?: string | null
  arrival_city_ko?: string | null
  arrival_city_en?: string | null
  departure_country?: string | null
  departure_country_ko?: string | null
  departure_country_en?: string | null
  arrival_country?: string | null
  arrival_country_ko?: string | null
  arrival_country_en?: string | null
}

const LEGACY_COLUMN: Record<
  ProductTranslationField,
  { ko: keyof ProductLegacyI18nSource; en: keyof ProductLegacyI18nSource; fallbackKo?: keyof ProductLegacyI18nSource }
> = {
  name: { ko: 'name_ko', en: 'name_en', fallbackKo: 'name' },
  customer_name: { ko: 'customer_name_ko', en: 'customer_name_en' },
  summary: { ko: 'summary_ko', en: 'summary_en' },
  departure_city: { ko: 'departure_city_ko', en: 'departure_city_en', fallbackKo: 'departure_city' },
  arrival_city: { ko: 'arrival_city_ko', en: 'arrival_city_en', fallbackKo: 'arrival_city' },
  departure_country: {
    ko: 'departure_country_ko',
    en: 'departure_country_en',
    fallbackKo: 'departure_country',
  },
  arrival_country: {
    ko: 'arrival_country_ko',
    en: 'arrival_country_en',
    fallbackKo: 'arrival_country',
  },
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isProductTranslationField(value: string): value is ProductTranslationField {
  return (PRODUCT_TRANSLATION_FIELDS as readonly string[]).includes(value)
}

export function legacyProductFieldValue(
  product: ProductLegacyI18nSource,
  field: ProductTranslationField,
  locale: 'ko' | 'en'
): string {
  const cols = LEGACY_COLUMN[field]
  const primary = trimOrEmpty(product[locale === 'ko' ? cols.ko : cols.en])
  if (primary) return primary
  if (locale === 'ko' && cols.fallbackKo) return trimOrEmpty(product[cols.fallbackKo])
  return ''
}

/** Merge translation rows + legacy columns into a nested map. */
export function buildProductTranslationMap(
  product: ProductLegacyI18nSource,
  rows: ProductFieldTranslationRow[]
): ProductTranslationMap {
  const map: ProductTranslationMap = {}

  for (const field of PRODUCT_TRANSLATION_FIELDS) {
    const fieldMap: Partial<Record<SiteLocale, string>> = {}
    const ko = legacyProductFieldValue(product, field, 'ko')
    const en = legacyProductFieldValue(product, field, 'en')
    if (ko) fieldMap.ko = ko
    if (en) fieldMap.en = en
    map[field] = fieldMap
  }

  for (const row of rows) {
    if (!isProductTranslationField(row.field_key)) continue
    if (!isSiteLocale(row.locale)) continue
    const value = trimOrEmpty(row.value)
    if (!value) continue
    if (!map[row.field_key]) map[row.field_key] = {}
    map[row.field_key]![row.locale] = value
  }

  return map
}

export function getTranslatedProductField(
  map: ProductTranslationMap,
  field: ProductTranslationField,
  locale: SiteLocale
): string {
  const fieldMap = map[field] || {}
  for (const code of contentFallbackOrder(locale)) {
    const value = fieldMap[code]?.trim()
    if (value) return value
  }
  return ''
}

export function getProductLocalizedField(
  product: ProductLegacyI18nSource,
  field: ProductTranslationField,
  locale: SiteLocale,
  rows: ProductFieldTranslationRow[] = []
): string {
  return getTranslatedProductField(buildProductTranslationMap(product, rows), field, locale)
}

/** Legacy column patch for ko/en dual-write. */
export function legacyColumnsFromFieldValue(
  field: ProductTranslationField,
  locale: SiteLocale,
  value: string
): Partial<ProductLegacyI18nSource> {
  if (!isLegacyColumnLocale(locale)) return {}
  const trimmed = value.trim()
  const cols = LEGACY_COLUMN[field]
  const patch: Partial<ProductLegacyI18nSource> = {
    [locale === 'ko' ? cols.ko : cols.en]: trimmed || null,
  }
  if (locale === 'ko' && cols.fallbackKo) {
    patch[cols.fallbackKo] = trimmed || null
  }
  return patch
}

export async function fetchProductFieldTranslations(
  productIds: string | string[]
): Promise<ProductFieldTranslationRow[]> {
  const ids = Array.isArray(productIds) ? productIds : [productIds]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('product_field_translations')
    .select('product_id, field_key, locale, value')
    .in('product_id', ids)

  if (error) {
    // Table may not exist yet before migration — fail soft for admin UX.
    console.warn('fetchProductFieldTranslations:', error.message)
    return []
  }

  return (data || []) as ProductFieldTranslationRow[]
}

export async function upsertProductFieldTranslation(params: {
  productId: string
  fieldKey: ProductTranslationField
  locale: SiteLocale
  value: string
}): Promise<void> {
  const trimmed = params.value.trim()

  if (!trimmed) {
    const { error } = await supabase
      .from('product_field_translations')
      .delete()
      .eq('product_id', params.productId)
      .eq('field_key', params.fieldKey)
      .eq('locale', params.locale)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('product_field_translations').upsert(
    {
      product_id: params.productId,
      field_key: params.fieldKey,
      locale: params.locale,
      value: trimmed,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'product_id,field_key,locale' }
  )
  if (error) throw error
}

export async function upsertProductFieldTranslations(params: {
  productId: string
  locale: SiteLocale
  values: Partial<Record<ProductTranslationField, string>>
}): Promise<Partial<ProductLegacyI18nSource>> {
  const legacyPatch: Partial<ProductLegacyI18nSource> = {}

  for (const [fieldKey, raw] of Object.entries(params.values) as [
    ProductTranslationField,
    string | undefined,
  ][]) {
    if (raw === undefined) continue
    await upsertProductFieldTranslation({
      productId: params.productId,
      fieldKey,
      locale: params.locale,
      value: raw,
    })
    Object.assign(legacyPatch, legacyColumnsFromFieldValue(fieldKey, params.locale, raw))
  }

  return legacyPatch
}
