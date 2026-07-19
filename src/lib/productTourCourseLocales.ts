import {
  contentFallbackOrder,
  isSiteLocale,
  normalizeSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

export type TourCourseI18nField = 'name' | 'description'

export type TourCourseLocaleTextMap = Partial<Record<SiteLocale, string>>

export type TourCourseContentI18n = Partial<Record<TourCourseI18nField, TourCourseLocaleTextMap>>

export type TourCourseI18nSource = {
  customer_name_ko?: string | null | undefined
  customer_name_en?: string | null | undefined
  customer_description_ko?: string | null | undefined
  customer_description_en?: string | null | undefined
  name_ko?: string | null | undefined
  name_en?: string | null | undefined
  name?: string | null | undefined
  content_i18n?: TourCourseContentI18n | null | undefined
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMap(
  content: TourCourseContentI18n | null | undefined,
  field: TourCourseI18nField
): TourCourseLocaleTextMap {
  return { ...((content?.[field] || {}) as TourCourseLocaleTextMap) }
}

export function getTourCourseI18nMap(
  source: TourCourseI18nSource,
  field: TourCourseI18nField
): TourCourseLocaleTextMap {
  const fromJson = getMap(source.content_i18n, field)
  if (field === 'name') {
    const ko =
      fromJson.ko ||
      trimOrEmpty(source.customer_name_ko) ||
      trimOrEmpty(source.name_ko) ||
      trimOrEmpty(source.name)
    const en =
      fromJson.en || trimOrEmpty(source.customer_name_en) || trimOrEmpty(source.name_en)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else {
    const ko = fromJson.ko || trimOrEmpty(source.customer_description_ko)
    const en = fromJson.en || trimOrEmpty(source.customer_description_en)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  }
  return fromJson
}

export function getTourCourseLocalizedText(
  source: TourCourseI18nSource,
  field: TourCourseI18nField,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : normalizeSiteLocale(locale)
  const map = getTourCourseI18nMap(source, field)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function setTourCourseI18nField(
  current: TourCourseContentI18n | null | undefined,
  field: TourCourseI18nField,
  locale: SiteLocale,
  value: string
): TourCourseContentI18n {
  const next: TourCourseContentI18n = { ...(current || {}) }
  const fieldMap: TourCourseLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

export function legacyTourCourseColumnsFromI18n(i18n: TourCourseContentI18n): {
  customer_name_ko: string | null
  customer_name_en: string | null
  customer_description_ko: string | null
  customer_description_en: string | null
} {
  return {
    customer_name_ko: i18n.name?.ko?.trim() || null,
    customer_name_en: i18n.name?.en?.trim() || null,
    customer_description_ko: i18n.description?.ko?.trim() || null,
    customer_description_en: i18n.description?.en?.trim() || null,
  }
}

export type MergedTourCourseI18n = {
  content_i18n: TourCourseContentI18n
} & ReturnType<typeof legacyTourCourseColumnsFromI18n>

export function mergeTourCourseI18n(
  source: TourCourseI18nSource,
  locale: SiteLocale,
  name: string,
  description: string
): MergedTourCourseI18n {
  let content_i18n: TourCourseContentI18n = {
    name: getTourCourseI18nMap(source, 'name'),
    description: getTourCourseI18nMap(source, 'description'),
  }
  content_i18n = setTourCourseI18nField(content_i18n, 'name', locale, name)
  content_i18n = setTourCourseI18nField(content_i18n, 'description', locale, description)
  return {
    content_i18n,
    ...legacyTourCourseColumnsFromI18n(content_i18n),
  }
}

export function resolveTourCourseLocale(localeOrIsEnglish: string | boolean): string {
  if (typeof localeOrIsEnglish === 'boolean') {
    return localeOrIsEnglish ? 'en' : 'ko'
  }
  return localeOrIsEnglish
}
