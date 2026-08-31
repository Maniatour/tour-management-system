import { isSiteLocale, type SiteLocale } from '@/lib/siteLocales'
import { WAIVER_LOCALES, type WaiverLocale } from '@/lib/waiver/types'

export const WAIVER_LOCALE_LABELS: Record<WaiverLocale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

export function isWaiverLocale(value: string | null | undefined): value is WaiverLocale {
  return !!value && (WAIVER_LOCALES as readonly string[]).includes(value)
}

export function siteLocaleToWaiverLocale(locale: string | null | undefined): WaiverLocale {
  if (isWaiverLocale(locale)) return locale
  if (locale === 'zh-CN' || locale === 'zh-TW') return 'zh'
  if (isSiteLocale(locale)) {
    const mapped = locale.split('-')[0]
    if (isWaiverLocale(mapped)) return mapped
  }
  return 'en'
}

export function waiverLocaleToSiteLocale(locale: WaiverLocale): SiteLocale {
  if (locale === 'zh') return 'zh-CN'
  return locale
}

export function normalizeWaiverLocale(
  value: string | null | undefined,
  fallback: WaiverLocale = 'en'
): WaiverLocale {
  if (isWaiverLocale(value)) return value
  return siteLocaleToWaiverLocale(value) || fallback
}
