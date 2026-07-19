import {
  contentFallbackOrder,
  isSiteLocale,
  normalizeSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'
import type { ChoiceContentI18n, ChoiceLocaleTextMap } from '@/lib/productChoiceLocales'

export type OptionTemplateI18nField =
  | 'name'
  | 'description'
  | 'group_name'
  | 'group_description'

export type OptionTemplateContentI18n = Partial<
  Record<OptionTemplateI18nField, ChoiceLocaleTextMap>
>

export type OptionTemplateI18nSource = {
  name?: string | null | undefined
  name_ko?: string | null | undefined
  name_en?: string | null | undefined
  description?: string | null | undefined
  description_ko?: string | null | undefined
  description_en?: string | null | undefined
  template_group?: string | null | undefined
  template_group_ko?: string | null | undefined
  template_group_description_ko?: string | null | undefined
  template_group_description_en?: string | null | undefined
  content_i18n?: OptionTemplateContentI18n | null | undefined
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMap(
  content: OptionTemplateContentI18n | null | undefined,
  field: OptionTemplateI18nField
): ChoiceLocaleTextMap {
  return { ...((content?.[field] || {}) as ChoiceLocaleTextMap) }
}

export function getOptionTemplateI18nMap(
  source: OptionTemplateI18nSource,
  field: OptionTemplateI18nField
): ChoiceLocaleTextMap {
  const fromJson = getMap(source.content_i18n, field)
  if (field === 'name') {
    const ko = fromJson.ko || trimOrEmpty(source.name_ko)
    const en = fromJson.en || trimOrEmpty(source.name_en) || trimOrEmpty(source.name)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else if (field === 'description') {
    const ko = fromJson.ko || trimOrEmpty(source.description_ko)
    const en =
      fromJson.en || trimOrEmpty(source.description_en) || trimOrEmpty(source.description)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else if (field === 'group_name') {
    const ko = fromJson.ko || trimOrEmpty(source.template_group_ko)
    const en = fromJson.en || trimOrEmpty(source.template_group)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  } else {
    const ko = fromJson.ko || trimOrEmpty(source.template_group_description_ko)
    const en = fromJson.en || trimOrEmpty(source.template_group_description_en)
    if (ko) fromJson.ko = ko
    if (en) fromJson.en = en
  }
  return fromJson
}

export function getOptionTemplateLocalizedText(
  source: OptionTemplateI18nSource,
  field: OptionTemplateI18nField,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : normalizeSiteLocale(locale)
  const map = getOptionTemplateI18nMap(source, field)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function setOptionTemplateI18nField(
  current: OptionTemplateContentI18n | null | undefined,
  field: OptionTemplateI18nField,
  locale: SiteLocale,
  value: string
): OptionTemplateContentI18n {
  const next: OptionTemplateContentI18n = { ...(current || {}) }
  const fieldMap: ChoiceLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

export function legacyOptionColumnsFromI18n(i18n: OptionTemplateContentI18n): {
  name: string
  name_ko: string | null
  name_en: string | null
  description: string | null
  description_ko: string | null
  description_en: string | null
} {
  const nameKo = i18n.name?.ko?.trim() || ''
  const nameEn = i18n.name?.en?.trim() || ''
  return {
    name: nameEn || nameKo || '',
    name_ko: nameKo || null,
    name_en: nameEn || null,
    description: i18n.description?.en?.trim() || null,
    description_ko: i18n.description?.ko?.trim() || null,
    description_en: i18n.description?.en?.trim() || null,
  }
}

export function legacyGroupColumnsFromI18n(
  i18n: OptionTemplateContentI18n,
  templateGroupKey: string
): {
  template_group: string
  template_group_ko: string | null
  template_group_description_ko: string | null
  template_group_description_en: string | null
} {
  const groupNameKo = i18n.group_name?.ko?.trim() || ''
  const groupNameEn = i18n.group_name?.en?.trim() || ''
  return {
    template_group: templateGroupKey.trim() || groupNameEn || groupNameKo || 'group',
    template_group_ko: groupNameKo || null,
    template_group_description_ko: i18n.group_description?.ko?.trim() || null,
    template_group_description_en: i18n.group_description?.en?.trim() || null,
  }
}

export function mergeOptionTemplateOptionI18n(
  source: OptionTemplateI18nSource,
  locale: SiteLocale,
  name: string,
  description: string
): {
  content_i18n: OptionTemplateContentI18n
} & ReturnType<typeof legacyOptionColumnsFromI18n> {
  let content_i18n: OptionTemplateContentI18n = {
    name: getOptionTemplateI18nMap(source, 'name'),
    description: getOptionTemplateI18nMap(source, 'description'),
    group_name: getOptionTemplateI18nMap(source, 'group_name'),
    group_description: getOptionTemplateI18nMap(source, 'group_description'),
  }
  content_i18n = setOptionTemplateI18nField(content_i18n, 'name', locale, name)
  content_i18n = setOptionTemplateI18nField(content_i18n, 'description', locale, description)
  return {
    content_i18n,
    ...legacyOptionColumnsFromI18n(content_i18n),
  }
}

export function mergeOptionTemplateGroupI18n(
  source: OptionTemplateI18nSource,
  locale: SiteLocale,
  groupName: string,
  groupDescription: string,
  templateGroupKey: string
): {
  content_i18n: OptionTemplateContentI18n
} & ReturnType<typeof legacyGroupColumnsFromI18n> {
  let content_i18n: OptionTemplateContentI18n = {
    name: getOptionTemplateI18nMap(source, 'name'),
    description: getOptionTemplateI18nMap(source, 'description'),
    group_name: getOptionTemplateI18nMap(source, 'group_name'),
    group_description: getOptionTemplateI18nMap(source, 'group_description'),
  }
  content_i18n = setOptionTemplateI18nField(content_i18n, 'group_name', locale, groupName)
  content_i18n = setOptionTemplateI18nField(
    content_i18n,
    'group_description',
    locale,
    groupDescription
  )
  return {
    content_i18n,
    ...legacyGroupColumnsFromI18n(content_i18n, templateGroupKey),
  }
}

/** Product choice option i18n — strip group_* fields from template content. */
export function choiceOptionI18nFromTemplate(
  source: OptionTemplateI18nSource
): ChoiceContentI18n {
  return {
    name: getOptionTemplateI18nMap(source, 'name'),
    description: getOptionTemplateI18nMap(source, 'description'),
  }
}

/** Product choice group i18n from first template row in a group. */
export function choiceGroupI18nFromTemplate(
  source: OptionTemplateI18nSource
): ChoiceContentI18n {
  return {
    name: getOptionTemplateI18nMap(source, 'group_name'),
    description: getOptionTemplateI18nMap(source, 'group_description'),
  }
}

export function applyGroupI18nToOptionContent(
  optionContent: OptionTemplateContentI18n | null | undefined,
  groupContent: OptionTemplateContentI18n
): OptionTemplateContentI18n {
  return {
    ...(optionContent || {}),
    group_name: { ...(groupContent.group_name || {}) },
    group_description: { ...(groupContent.group_description || {}) },
  }
}
