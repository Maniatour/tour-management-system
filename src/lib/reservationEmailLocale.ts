/**
 * Reservation / pickup email language: Korean vs English body.
 * Unset customer.language → English (same as receipt display).
 * Only explicit Korean codes → Korean email.
 */

export function customerLanguageIndicatesKorean(
  language: string | null | undefined
): boolean {
  const s = String(language ?? '').trim().toLowerCase()
  if (!s) return false
  return (
    s === 'ko' ||
    s === 'kr' ||
    s === 'kor' ||
    s === 'korean' ||
    s === '한국어' ||
    s === '한글' ||
    s.startsWith('ko-')
  )
}

/**
 * @param localeOverride Request body `locale` 'ko' | 'en' when set; otherwise infer from customer.
 */
export function resolveReservationEmailIsEnglish(
  customerLanguage: string | null | undefined,
  localeOverride: string | null | undefined
): boolean {
  if (localeOverride != null && String(localeOverride).trim() !== '') {
    const o = String(localeOverride).trim().toLowerCase()
    if (o === 'en') return true
    if (o === 'ko') return false
  }
  return !customerLanguageIndicatesKorean(customerLanguage)
}

/** Email API / preview request body `locale` */
export function resolveReservationEmailLocale(
  customerLanguage: string | null | undefined,
  localeOverride: string | null | undefined
): 'ko' | 'en' {
  return resolveReservationEmailIsEnglish(customerLanguage, localeOverride) ? 'en' : 'ko'
}

export type CustomerSmsLocale = 'ko' | 'en'

/** 예약 카드 SMS: 한국 고객 → 한국어, 그 외 → 영어 */
export function resolveCustomerSmsLocale(
  customerLanguage: string | null | undefined,
  localeOverride?: string | null | undefined
): CustomerSmsLocale {
  if (localeOverride != null && String(localeOverride).trim() !== '') {
    const o = String(localeOverride).trim().toLowerCase()
    if (o === 'ko') return 'ko'
    if (o === 'en') return 'en'
  }
  return customerLanguageIndicatesKorean(customerLanguage) ? 'ko' : 'en'
}

export function customerSmsLocaleLabel(
  locale: CustomerSmsLocale,
  uiLocale: 'ko' | 'en' = 'ko'
): string {
  if (locale === 'ko') return uiLocale === 'en' ? 'Korean' : '한국어'
  return uiLocale === 'en' ? 'English' : '영어'
}
