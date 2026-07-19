import { contentFallbackOrder, isSiteLocale, type SiteLocale } from '@/lib/siteLocales'

export type FaqI18nField = 'question' | 'answer'

export type FaqLocaleTextMap = Partial<Record<SiteLocale, string>>

export type FaqContentI18n = Partial<Record<FaqI18nField, FaqLocaleTextMap>>

export type FaqI18nSource = {
  question?: string | null
  answer?: string | null
  question_en?: string | null
  answer_en?: string | null
  content_i18n?: FaqContentI18n | null
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getFaqI18nMap(faq: FaqI18nSource, field: FaqI18nField): FaqLocaleTextMap {
  const raw = (faq.content_i18n || {}) as FaqContentI18n
  const fromJson = { ...((raw[field] || {}) as FaqLocaleTextMap) }

  if (field === 'question') {
    const ko = fromJson.ko || trimOrEmpty(faq.question)
    const en = fromJson.en || trimOrEmpty(faq.question_en)
    if (ko) fromJson.ko = ko
    else delete fromJson.ko
    if (en) fromJson.en = en
    else delete fromJson.en
  } else {
    const ko = fromJson.ko || trimOrEmpty(faq.answer)
    const en = fromJson.en || trimOrEmpty(faq.answer_en)
    if (ko) fromJson.ko = ko
    else delete fromJson.ko
    if (en) fromJson.en = en
    else delete fromJson.en
  }

  return fromJson
}

export function getFaqLocalizedText(
  faq: FaqI18nSource,
  field: FaqI18nField,
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const map = getFaqI18nMap(faq, field)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function setFaqI18nField(
  current: FaqContentI18n | null | undefined,
  field: FaqI18nField,
  locale: SiteLocale,
  value: string
): FaqContentI18n {
  const next: FaqContentI18n = { ...(current || {}) }
  const fieldMap: FaqLocaleTextMap = { ...(next[field] || {}) }
  const trimmed = value.trim()
  if (trimmed) fieldMap[locale] = trimmed
  else delete fieldMap[locale]
  next[field] = fieldMap
  return next
}

/** Dual-write ko/en columns from content_i18n. */
export function legacyFaqColumnsFromI18n(i18n: FaqContentI18n): {
  question: string
  answer: string
  question_en: string | null
  answer_en: string | null
} {
  const qKo = i18n.question?.ko?.trim() || ''
  const qEn = i18n.question?.en?.trim() || null
  const aKo = i18n.answer?.ko?.trim() || ''
  const aEn = i18n.answer?.en?.trim() || null
  return {
    question: qKo || qEn || '',
    answer: aKo || aEn || '',
    question_en: qEn,
    answer_en: aEn,
  }
}

export function mergeFaqI18n(
  faq: FaqI18nSource,
  locale: SiteLocale,
  question: string,
  answer: string
): {
  content_i18n: FaqContentI18n
  question: string
  answer: string
  question_en: string | null
  answer_en: string | null
} {
  let content_i18n: FaqContentI18n = {
    question: getFaqI18nMap(faq, 'question'),
    answer: getFaqI18nMap(faq, 'answer'),
  }
  content_i18n = setFaqI18nField(content_i18n, 'question', locale, question)
  content_i18n = setFaqI18nField(content_i18n, 'answer', locale, answer)

  return {
    content_i18n,
    ...legacyFaqColumnsFromI18n(content_i18n),
  }
}
