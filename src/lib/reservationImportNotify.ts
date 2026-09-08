import {
  isCancellationRequestEmailSubject,
  isKlookOrderEmailSubjectForReservation,
  isManiatourHomepageBookingEmail,
  isMyrealtripNewBookingEmailSubject,
  isNolTripleNewBookingEmailSubject,
  isTidesquareNewBookingEmailSubject,
  isTripComNewOrderEmailSubject,
  isViatorBookingRequestEmailSubject,
  isZoomZoomTourNewBookingEmailSubject,
} from '@/lib/emailReservationParser'
import { ZELLE_PAYMENT_PLATFORM_KEY } from '@/lib/zellePaymentEmail'
import { WELLS_FARGO_ATM_PLATFORM_KEY } from '@/lib/wellsFargoAtmReceipt'

export type ReservationImportNotifyRow = {
  id: string
  subject: string | null
  platform_key: string | null
  source_email?: string | null
  received_at: string | null
  created_at: string | null
  extracted_data?: { is_booking_confirmed?: boolean } | null
}

function isKKdayBookingSubject(subject: string | null | undefined): boolean {
  return /^\[KKday\]\s*예약번호\s*[：:].*주문이\s*접수되었습니다/i.test((subject ?? '').trim())
}

/** GetYourGuide 예약 접수 제목: "Booking - …" 또는 "Urgent : New Booking received - …" */
function isGyGReservationSubject(subject: string | null | undefined): boolean {
  const t = (subject ?? '').trimStart()
  const lower = t.toLowerCase()
  if (lower.startsWith('booking -')) return true
  return /^urgent\s*:\s*new\s*booking\s*received\s*-\s*[a-z0-9]+\s*-\s*[a-z0-9]+/i.test(t)
}

/**
 * 예약 가져오기 목록의 「예약 접수」·「취소」탭에 해당하는 메일만 모달 안내.
 * 플랫폼 관련 메일(리마인드·픽업·정산 등)은 알리지 않습니다.
 */
export function isReservationRelatedImportNotifyRow(row: ReservationImportNotifyRow): boolean {
  const platform = (row.platform_key || '').toLowerCase()
  if (platform === ZELLE_PAYMENT_PLATFORM_KEY || platform === WELLS_FARGO_ATM_PLATFORM_KEY) return false
  if (isCancellationRequestEmailSubject(row.subject)) return true
  if (row.extracted_data?.is_booking_confirmed === true) return true
  if (isKlookOrderEmailSubjectForReservation(row.subject)) return true
  if (isKKdayBookingSubject(row.subject)) return true
  if (platform === 'viator' && isViatorBookingRequestEmailSubject(row.subject)) return true
  if (isTidesquareNewBookingEmailSubject(row.subject)) return true
  if (isMyrealtripNewBookingEmailSubject(row.subject)) return true
  if (isManiatourHomepageBookingEmail(row.source_email, row.subject)) return true
  if ((row.source_email || '').toLowerCase().includes('getyourguide') && isGyGReservationSubject(row.subject)) {
    return true
  }
  if (isTripComNewOrderEmailSubject(row.subject)) return true
  if (isZoomZoomTourNewBookingEmailSubject(row.subject)) return true
  if (isNolTripleNewBookingEmailSubject(row.subject)) return true
  return false
}
