import {
  contentFallbackOrder,
  isSiteLocale,
  normalizeSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

export type ScheduleI18nField = 'title' | 'description' | 'location'

export type ScheduleLocaleTextMap = Partial<Record<SiteLocale, string>>

export type ScheduleContentI18n = Partial<Record<ScheduleI18nField, ScheduleLocaleTextMap>>

export type ScheduleI18nSource = {
  title_ko?: string | null
  title_en?: string | null
  description_ko?: string | null
  description_en?: string | null
  location_ko?: string | null
  location_en?: string | null
  content_i18n?: ScheduleContentI18n | null
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMap(
  content: ScheduleContentI18n | null | undefined,
  field: ScheduleI18nField
): ScheduleLocaleTextMap {
  return { ...((content?.[field] || {}) as ScheduleLocaleTextMap) }
}

export function getScheduleI18nMap(
  source: ScheduleI18nSource,
  field: ScheduleI18nField
): ScheduleLocaleTextMap {
  const fromJson = getMap(source.content_i18n, field)
  const koKey = `${field}_ko` as keyof ScheduleI18nSource
  const enKey = `${field}_en` as keyof ScheduleI18nSource
  const ko = fromJson.ko || trimOrEmpty(source[koKey])
  const en = fromJson.en || trimOrEmpty(source[enKey])
  if (ko) fromJson.ko = ko
  if (en) fromJson.en = en
  return fromJson
}

export function getScheduleLocalizedText(
  source: ScheduleI18nSource,
  field: ScheduleI18nField,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : normalizeSiteLocale(locale)
  const map = getScheduleI18nMap(source, field)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

/** Admin editors: only the selected locale (no customer-page fallback). */
export function getScheduleExactText(
  source: ScheduleI18nSource,
  field: ScheduleI18nField,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : normalizeSiteLocale(locale)
  return getScheduleI18nMap(source, field)[preferred]?.trim() || ''
}

export function setScheduleI18nField(
  current: ScheduleContentI18n | null | undefined,
  field: ScheduleI18nField,
  locale: SiteLocale,
  value: string
): ScheduleContentI18n {
  const next: ScheduleContentI18n = { ...(current || {}) }
  const fieldMap: ScheduleLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

export function legacyScheduleColumnsFromI18n(i18n: ScheduleContentI18n): {
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
} {
  return {
    title_ko: i18n.title?.ko?.trim() || null,
    title_en: i18n.title?.en?.trim() || null,
    description_ko: i18n.description?.ko?.trim() || null,
    description_en: i18n.description?.en?.trim() || null,
    location_ko: i18n.location?.ko?.trim() || null,
    location_en: i18n.location?.en?.trim() || null,
  }
}

export type MergedScheduleI18n = {
  content_i18n: ScheduleContentI18n
} & ReturnType<typeof legacyScheduleColumnsFromI18n>

export function mergeScheduleI18n(
  source: ScheduleI18nSource,
  locale: SiteLocale,
  title: string,
  description: string,
  location: string
): MergedScheduleI18n {
  let content_i18n: ScheduleContentI18n = {
    title: getScheduleI18nMap(source, 'title'),
    description: getScheduleI18nMap(source, 'description'),
    location: getScheduleI18nMap(source, 'location'),
  }
  content_i18n = setScheduleI18nField(content_i18n, 'title', locale, title)
  content_i18n = setScheduleI18nField(content_i18n, 'description', locale, description)
  content_i18n = setScheduleI18nField(content_i18n, 'location', locale, location)
  return {
    content_i18n,
    ...legacyScheduleColumnsFromI18n(content_i18n),
  }
}
