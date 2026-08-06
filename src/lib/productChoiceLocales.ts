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

/**
 * 관리자 입력 폼용: 폴백·trim 없이 해당 로케일 값만 반환.
 * (폴백/trim 사용 시 Enter·공백 입력이 즉시 되돌아가 수정이 안 되는 것처럼 보임)
 */
export function getChoiceGroupExactLocaleText(
  source: ChoiceGroupI18nSource,
  field: ChoiceI18nField,
  locale: SiteLocale
): string {
  return getChoiceGroupI18nMap(source, field)[locale] ?? ''
}

export function getChoiceOptionExactLocaleText(
  source: ChoiceOptionI18nSource,
  field: ChoiceI18nField,
  locale: SiteLocale
): string {
  return getChoiceOptionI18nMap(source, field)[locale] ?? ''
}

export function setChoiceI18nField(
  current: ChoiceContentI18n | null | undefined,
  field: ChoiceI18nField,
  locale: SiteLocale,
  value: string
): ChoiceContentI18n {
  const next: ChoiceContentI18n = { ...(current || {}) }
  const fieldMap: ChoiceLocaleTextMap = { ...(next[field] || {}) }
  // 편집 중 끝 공백/줄바꿈을 trim 하면 줄바꿈·스페이스 입력이 즉시 취소됨
  if (value.length > 0) fieldMap[locale] = value
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

/** DB 저장 직전: 로케일 문자열 trim 및 빈 값 제거 */
export function trimChoiceContentI18n(
  content: ChoiceContentI18n | null | undefined
): ChoiceContentI18n {
  const next: ChoiceContentI18n = {}
  for (const field of ['name', 'description'] as const) {
    const map = content?.[field]
    if (!map) continue
    const trimmed: ChoiceLocaleTextMap = {}
    for (const [locale, value] of Object.entries(map)) {
      if (typeof value !== 'string') continue
      const t = value.trim()
      if (t) trimmed[locale as SiteLocale] = t
    }
    if (Object.keys(trimmed).length > 0) next[field] = trimmed
  }
  return next
}

export function legacyChoiceGroupColumnsFromI18n(i18n: ChoiceContentI18n): {
  choice_group_ko: string
  choice_group_en: string | null
  description_ko: string | null
  description_en: string | null
  choice_group: string
} {
  const nameKo = i18n.name?.ko ?? ''
  const nameEn = i18n.name?.en ?? ''
  const descKo = i18n.description?.ko
  const descEn = i18n.description?.en
  return {
    choice_group_ko: nameKo || nameEn || '',
    choice_group_en: nameEn || null,
    description_ko: descKo != null && descKo.length > 0 ? descKo : null,
    description_en: descEn != null && descEn.length > 0 ? descEn : null,
    choice_group: nameKo || nameEn || 'choice',
  }
}

export function legacyChoiceOptionColumnsFromI18n(i18n: ChoiceContentI18n): {
  option_name_ko: string
  option_name: string
  description_ko: string | null
  description: string | null
} {
  const nameKo = i18n.name?.ko ?? ''
  const nameEn = i18n.name?.en ?? ''
  const descKo = i18n.description?.ko
  const descEn = i18n.description?.en
  return {
    option_name_ko: nameKo || nameEn || '',
    option_name: nameEn || nameKo || '',
    description_ko: descKo != null && descKo.length > 0 ? descKo : null,
    description: descEn != null && descEn.length > 0 ? descEn : null,
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
