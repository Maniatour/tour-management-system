/** 예약별 투어 신청 언어 (고객 모국어 customers.language 와 별개). DB 값은 ko/en/ja. */

export const TOUR_LANGUAGE_CODES = ['ko', 'en', 'ja'] as const
export type TourLanguageCode = (typeof TOUR_LANGUAGE_CODES)[number]

/** 일본어 투어를 실제 상품으로 넣기 시작한 날짜 (이 날짜 이전 일본인 예약은 영어 투어로 본다). */
export const JAPANESE_TOUR_LANGUAGE_START_DATE = '2026-09-11'

export const TOUR_LANGUAGE_OPTIONS: Array<{
  value: TourLanguageCode
  labelKo: string
  labelEn: string
  countryCode: string
}> = [
  { value: 'ko', labelKo: '한국어', labelEn: 'Korean', countryCode: 'KR' },
  { value: 'en', labelKo: '영어', labelEn: 'English', countryCode: 'US' },
  { value: 'ja', labelKo: '일본어', labelEn: 'Japanese', countryCode: 'JP' },
]

export function isKoreanLanguage(value: string | null | undefined): boolean {
  const lang = String(value || '').toLowerCase().trim()
  if (!lang) return false
  return (
    lang === 'ko' ||
    lang === 'kr' ||
    lang === 'kor' ||
    lang === 'korean' ||
    lang === '한국어' ||
    lang === '한글' ||
    lang.startsWith('ko-') ||
    lang.startsWith('kr-') ||
    lang.includes('한국')
  )
}

export function isJapaneseLanguage(value: string | null | undefined): boolean {
  const lang = String(value || '').toLowerCase().trim()
  if (!lang) return false
  return (
    lang === 'ja' ||
    lang === 'jp' ||
    lang === 'jpn' ||
    lang === 'japanese' ||
    lang.startsWith('japanese ') ||
    lang.startsWith('japanese(') ||
    lang === '일본어' ||
    lang === '日本語' ||
    lang.startsWith('ja-') ||
    lang.startsWith('jp-') ||
    lang.includes('일본')
  )
}

export function canonicalizeTourLanguage(
  value: string | null | undefined
): TourLanguageCode | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (isKoreanLanguage(raw)) return 'ko'
  if (isJapaneseLanguage(raw)) return 'ja'
  const lang = raw.toLowerCase()
  if (
    lang === 'en' ||
    lang === 'eng' ||
    lang === 'english' ||
    lang === '영어' ||
    lang.startsWith('en-') ||
    lang === 'us' ||
    lang === 'usa'
  ) {
    return 'en'
  }
  return null
}

export function resolveStoredTourLanguage(
  value: string | null | undefined
): TourLanguageCode {
  return canonicalizeTourLanguage(value) ?? 'en'
}

/** 명시적 투어 언어가 없을 때: 한국인만 한국어, 그 외(일본인 포함)는 영어. */
export function inferLegacyTourLanguage(
  customerLanguage: string | null | undefined
): TourLanguageCode {
  return isKoreanLanguage(customerLanguage) ? 'ko' : 'en'
}

export function pickTourLanguageFromPreferredList(
  langs: string[] | null | undefined
): TourLanguageCode | null {
  if (!Array.isArray(langs) || langs.length === 0) return null
  const canonical = langs
    .map((item) => canonicalizeTourLanguage(item))
    .filter((item): item is TourLanguageCode => item != null)
  if (canonical.includes('ja')) return 'ja'
  if (canonical.includes('ko')) return 'ko'
  if (canonical.includes('en')) return 'en'
  return canonical[0] ?? null
}

export function resolveReservationTourLanguage(args: {
  explicitTourLanguage?: string | null | undefined
  preferredTourLanguages?: string[] | null | undefined
  customerLanguage?: string | null | undefined
}): TourLanguageCode {
  const explicit = canonicalizeTourLanguage(args.explicitTourLanguage)
  if (explicit) return explicit
  const fromPreferred = pickTourLanguageFromPreferredList(args.preferredTourLanguages)
  if (fromPreferred) return fromPreferred
  return inferLegacyTourLanguage(args.customerLanguage)
}

/** 예약 수정: 폼에 값이 있으면 그걸 쓰고, 없으면 기존 DB 값을 유지한다. 고객 모국어로 덮어쓰지 않는다. */
export function resolveTourLanguageForReservationWrite(args: {
  incomingTourLanguage?: string | null | undefined
  existingTourLanguage?: string | null | undefined
  preferredTourLanguages?: string[] | null | undefined
  customerLanguage?: string | null | undefined
}): TourLanguageCode {
  const incoming = canonicalizeTourLanguage(args.incomingTourLanguage)
  if (incoming) return incoming
  const existing = canonicalizeTourLanguage(args.existingTourLanguage)
  if (existing) return existing
  return resolveReservationTourLanguage({
    preferredTourLanguages: args.preferredTourLanguages,
    customerLanguage: args.customerLanguage,
  })
}

export function reservationOpsLanguageBucket(
  tourLanguage: string | null | undefined,
  customerLanguage: string | null | undefined
): TourLanguageCode {
  return canonicalizeTourLanguage(tourLanguage) ?? inferLegacyTourLanguage(customerLanguage)
}

export function formatTourLanguageAdminLabel(
  tourLanguage: string | null | undefined,
  customerLanguage: string | null | undefined,
  locale: string = 'ko'
): string {
  const tour = reservationOpsLanguageBucket(tourLanguage, customerLanguage)
  const isEn = locale === 'en' || locale.startsWith('en-')
  const base =
    tour === 'ko'
      ? isEn
        ? 'Korean'
        : '한국어'
      : tour === 'ja'
        ? isEn
          ? 'Japanese'
          : '일본어'
        : isEn
          ? 'English'
          : '영어'
  if (tour === 'en' && isJapaneseLanguage(customerLanguage)) {
    return isEn ? 'English (Japanese guest)' : '영어 (일본인)'
  }
  return base
}
