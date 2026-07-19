import koMessages from '@/i18n/locales/ko.json'
import enMessages from '@/i18n/locales/en.json'
import type { AdminEditLocale } from '@/lib/adminEditLocales'
import { resolveFileMessageLocale } from '@/lib/siteLocales'

export type AdminProductCardPreviewLocale = AdminEditLocale

const MESSAGE_MAP = {
  ko: koMessages,
  en: enMessages,
} as const

function getCommonMessages(locale: AdminProductCardPreviewLocale) {
  const fileLocale = resolveFileMessageLocale(locale)
  return (MESSAGE_MAP[fileLocale].common as unknown) as Record<string, unknown>
}

function getCommonString(locale: AdminProductCardPreviewLocale, key: string, fallback: string) {
  const value = getCommonMessages(locale)[key]
  return typeof value === 'string' ? value : fallback
}

export function getProductCardPreviewLabels(locale: AdminProductCardPreviewLocale) {
  const fileLocale = resolveFileMessageLocale(locale)
  return {
    listingFromPrice: getCommonString(locale, 'listingFromPrice', ''),
    likelyToSellOut: getCommonString(
      locale,
      'likelyToSellOut',
      fileLocale === 'en' ? 'Likely to sell out' : '매진 임박'
    ),
    imagePreparing: getCommonString(
      locale,
      'imagePreparing',
      fileLocale === 'en' ? 'Image Preparing' : '이미지 준비 중'
    ),
  }
}

export function getProductCardPreviewCommonLabel(
  locale: AdminProductCardPreviewLocale,
  key: string
): string {
  return getCommonString(locale, key, key)
}
