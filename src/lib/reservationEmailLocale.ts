/**
 * Reservation / pickup email language: Korean vs English body.
 * Empty customer.language is treated as Korean (legacy domestic default).
 */

export function customerLanguageIndicatesKorean(
  language: string | null | undefined
): boolean {
  const s = String(language ?? '').trim().toLowerCase()
  if (!s) return true
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
