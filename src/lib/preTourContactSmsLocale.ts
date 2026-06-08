import { customerLanguageIndicatesKorean } from '@/lib/reservationEmailLocale'

export type PreTourContactSmsLocale = 'ko' | 'en' | 'ja'

export function customerLanguageIndicatesJapanese(
  language: string | null | undefined
): boolean {
  const s = String(language ?? '').trim().toLowerCase()
  if (!s) return false
  return (
    s === 'ja' ||
    s === 'jp' ||
    s === 'jpn' ||
    s === 'japanese' ||
    s === '日本語' ||
    s.startsWith('ja-')
  )
}

export function resolvePreTourContactSmsLocale(
  customerLanguage: string | null | undefined,
  localeOverride: string | null | undefined
): PreTourContactSmsLocale {
  if (localeOverride != null && String(localeOverride).trim() !== '') {
    const o = String(localeOverride).trim().toLowerCase()
    if (o === 'ja' || o === 'jp') return 'ja'
    if (o === 'ko') return 'ko'
    if (o === 'en') return 'en'
  }
  if (customerLanguageIndicatesJapanese(customerLanguage)) return 'ja'
  if (customerLanguageIndicatesKorean(customerLanguage)) return 'ko'
  return 'en'
}
