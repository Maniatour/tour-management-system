import {
  languageFromPhoneCountry,
  normalizeLanguageToCode,
} from '@/lib/emailReservationParser'
import type { ExtractedReservationData } from '@/types/reservationImport'

const KOREAN_OTA_PLATFORMS = new Set(['myrealtrip', 'nol', 'zoomzoom'])

function looksLikeUnsetCustomerLanguage(value: string | null | undefined): boolean {
  const raw = String(value || '').trim()
  return raw === '' || raw === 'ko'
}

/**
 * 예약 가져오기 자동 추가 시 고객 언어.
 * extracted_data.language → 전화번호 국가 → 한국 OTA는 KR, 그 외 EN.
 * customers.language DB 기본값(ko)에 맡기지 않는다.
 */
export function resolveImportCustomerLanguage(
  extracted: Pick<ExtractedReservationData, 'language' | 'customer_phone' | 'platform_key'> | null | undefined,
  platformKey?: string | null
): string {
  const raw = String(extracted?.language || '').trim()
  if (raw) return normalizeLanguageToCode(raw)

  const phone = String(extracted?.customer_phone || '').trim()
  if (phone) {
    const fromPhone = languageFromPhoneCountry(phone)
    if (fromPhone) return fromPhone
  }

  const platform = String(platformKey || extracted?.platform_key || '').toLowerCase()
  if (KOREAN_OTA_PLATFORMS.has(platform)) return 'KR'
  return 'EN'
}

/**
 * 예약 가져오기 투어 신청 언어.
 * extracted.tour_language가 있으면 그대로, 한국 고객/한국 OTA는 ko, 그 외는 en.
 * 고객 언어가 일본어여도 투어 언어는 자동으로 ja로 두지 않는다.
 */
export function resolveImportTourLanguage(
  extracted:
    | Pick<
        ExtractedReservationData,
        'tour_language' | 'language' | 'customer_phone' | 'platform_key'
      >
    | null
    | undefined,
  platformKey?: string | null
): 'ko' | 'en' | 'ja' {
  const explicit = String(extracted?.tour_language || '').trim()
  if (explicit) {
    const code = normalizeLanguageToCode(explicit)
    if (/^(ja|jp)/i.test(code)) return 'ja'
    if (/^(kr|ko)/i.test(code)) return 'ko'
    return 'en'
  }

  const customerLanguage = resolveImportCustomerLanguage(extracted, platformKey)
  if (/^(kr|ko)/i.test(customerLanguage)) return 'ko'
  return 'en'
}

export function shouldReplaceDefaultImportCustomerLanguage(
  existingLanguage: string | null | undefined
): boolean {
  return looksLikeUnsetCustomerLanguage(existingLanguage)
}
