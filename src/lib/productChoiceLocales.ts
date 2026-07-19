import {
  contentFallbackOrder,
  isSiteLocale,
  normalizeSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

export type ChoiceI18nField = 'name' | 'description'

export type ChoiceLocaleTextMap = Partial<Record<SiteLocale, string>>

export type ChoiceContentI18n = Partial<Record<ChoiceI18nField, ChoiceLocaleTextMap>>

export type ChoiceGroupI18nSource = {
  choice_group?: string | null | undefined
  choice_group_ko?: string | null | undefined
  choice_group_en?: string | null | undefined
  choice_name?: string | null | undefined
  choice_name_ko?: string | null | undefined
  choice_name_en?: string | null | undefined
  description_ko?: string | null | undefined
  description_en?: string | null | undefined
  choice_description?: string | null | undefined
  choice_description_ko?: string | null | undefined
  choice_description_en?: string | null | undefined
  content_i18n?: ChoiceContentI18n | null | undefined
}

export type ChoiceOptionI18nSource = {
  option_name?: string | null | undefined
  option_name_ko?: string | null | undefined
  description?: string | null | undefined
  description_ko?: string | null | undefined
  option_description?: string | null | undefined
  option_description_ko?: string | null | undefined
  content_i18n?: ChoiceContentI18n | null | undefined
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMap(
  content: ChoiceContentI18n | null | undefined,
  field: ChoiceI18nField
): ChoiceLocaleTextMap {
  return { ...((content?.[field] || {}) as ChoiceLocaleTextMap) }
}

export function getChoiceGroupI18nMap(
  source: ChoiceGroupI18nSource,
  field: ChoiceI18nField
): ChoiceLocaleTextMap {
  const fromJson = getMap(source.content_i18n, field)
  if (field === 'name') {
    const ko =
      fromJson.ko ||
      trimOrEmpty(source.choice_group_ko) ||
      trimOrEmpty(source.choice_name_ko) ||
      trimOrEmpty(source.choice_group) ||
      trimOrEmpty(source.choice_name)
    const en =
      fromJson.en ||
      trimOrEmpty(source.choice_group_en) ||
      trimOrEmpty(source.choice_name_en) ||
      trimOrEmpty(source.choice_name)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else {
    const ko =
      fromJson.ko ||
      trimOrEmpty(source.description_ko) ||
      trimOrEmpty(source.choice_description_ko) ||
      trimOrEmpty(source.choice_description)
    const en =
      fromJson.en ||
      trimOrEmpty(source.description_en) ||
      trimOrEmpty(source.choice_description_en)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  }
  return fromJson
}

export function getChoiceOptionI18nMap(
  source: ChoiceOptionI18nSource,
  field: ChoiceI18nField
): ChoiceLocaleTextMap {
  const fromJson = getMap(source.content_i18n, field)
  if (field === 'name') {
    const ko = fromJson.ko || trimOrEmpty(source.option_name_ko)
    const en = fromJson.en || trimOrEmpty(source.option_name)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else {
    const ko =
      fromJson.ko ||
      trimOrEmpty(source.description_ko) ||
      trimOrEmpty(source.option_description_ko)
    const en =
      fromJson.en || trimOrEmpty(source.description) || trimOrEmpty(source.option_description)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  }
  return fromJson
}

export function getChoiceLocalizedText(
  map: ChoiceLocaleTextMap,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : normalizeSiteLocale(locale)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function getChoiceGroupLocalizedText(
  source: ChoiceGroupI18nSource,
  field: ChoiceI18nField,
  locale: string
): string {
  return getChoiceLocalizedText(getChoiceGroupI18nMap(source, field), locale)
}

export function getChoiceOptionLocalizedText(
  source: ChoiceOptionI18nSource,
  field: ChoiceI18nField,
  locale: string
): string {
  return getChoiceLocalizedText(getChoiceOptionI18nMap(source, field), locale)
}

export function setChoiceI18nField(
  current: ChoiceContentI18n | null | undefined,
  field: ChoiceI18nField,
  locale: SiteLocale,
  value: string
): ChoiceContentI18n {
  const next: ChoiceContentI18n = { ...(current || {}) }
  const fieldMap: ChoiceLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

export function legacyChoiceGroupColumnsFromI18n(i18n: ChoiceContentI18n): {
  choice_group_ko: string
  choice_group_en: string | null
  description_ko: string | null
  description_en: string | null
  choice_group: string
} {
  const nameKo = i18n.name?.ko?.trim() || ''
  const nameEn = i18n.name?.en?.trim() || null
  return {
    choice_group_ko: nameKo || nameEn || '',
    choice_group_en: nameEn,
    description_ko: i18n.description?.ko?.trim() || null,
    description_en: i18n.description?.en?.trim() || null,
    choice_group: nameKo || nameEn || 'choice',
  }
}

export function legacyChoiceOptionColumnsFromI18n(i18n: ChoiceContentI18n): {
  option_name_ko: string
  option_name: string
  description_ko: string | null
  description: string | null
} {
  const nameKo = i18n.name?.ko?.trim() || ''
  const nameEn = i18n.name?.en?.trim() || ''
  return {
    option_name_ko: nameKo || nameEn || '',
    option_name: nameEn || nameKo || '',
    description_ko: i18n.description?.ko?.trim() || null,
    description: i18n.description?.en?.trim() || null,
  }
}

export type MergedChoiceGroupI18n = {
  content_i18n: ChoiceContentI18n
} & ReturnType<typeof legacyChoiceGroupColumnsFromI18n>

export type MergedChoiceOptionI18n = {
  content_i18n: ChoiceContentI18n
} & ReturnType<typeof legacyChoiceOptionColumnsFromI18n>

export function mergeChoiceGroupI18n(
  source: ChoiceGroupI18nSource,
  locale: SiteLocale,
  name: string,
  description: string
): MergedChoiceGroupI18n {
  let content_i18n: ChoiceContentI18n = {
    name: getChoiceGroupI18nMap(source, 'name'),
    description: getChoiceGroupI18nMap(source, 'description'),
  }
  content_i18n = setChoiceI18nField(content_i18n, 'name', locale, name)
  content_i18n = setChoiceI18nField(content_i18n, 'description', locale, description)
  return {
    content_i18n,
    ...legacyChoiceGroupColumnsFromI18n(content_i18n),
  }
}

export function mergeChoiceOptionI18n(
  source: ChoiceOptionI18nSource,
  locale: SiteLocale,
  name: string,
  description: string
): MergedChoiceOptionI18n {
  let content_i18n: ChoiceContentI18n = {
    name: getChoiceOptionI18nMap(source, 'name'),
    description: getChoiceOptionI18nMap(source, 'description'),
  }
  content_i18n = setChoiceI18nField(content_i18n, 'name', locale, name)
  content_i18n = setChoiceI18nField(content_i18n, 'description', locale, description)
  return {
    content_i18n,
    ...legacyChoiceOptionColumnsFromI18n(content_i18n),
  }
}
