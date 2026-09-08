import { isCancellationRequestEmailSubject } from '@/lib/emailReservationParser'
import { ZELLE_PAYMENT_PLATFORM_KEY } from '@/lib/zellePaymentEmail'
import { WELLS_FARGO_ATM_PLATFORM_KEY } from '@/lib/wellsFargoAtmReceipt'

const KNOWN_BOOKING_PLATFORMS = new Set([
  'klook',
  'kkday',
  'viator',
  'getyourguide',
  'tripadvisor',
  'booking',
  'expedia',
  'airbnb',
  'maniatour',
  'tidesquare',
  'myrealtrip',
  'tripcom',
  'zoomzoom',
  'nol',
])

export type ReservationImportNotifyRow = {
  id: string
  subject: string | null
  platform_key: string | null
  received_at: string | null
  created_at: string | null
  extracted_data?: { is_booking_confirmed?: boolean } | null
}

export function isReservationRelatedImportNotifyRow(row: ReservationImportNotifyRow): boolean {
  const platform = (row.platform_key || '').toLowerCase()
  if (platform === ZELLE_PAYMENT_PLATFORM_KEY || platform === WELLS_FARGO_ATM_PLATFORM_KEY) return false
  if (isCancellationRequestEmailSubject(row.subject)) return true
  if (row.extracted_data?.is_booking_confirmed === true) return true
  if (platform && KNOWN_BOOKING_PLATFORMS.has(platform)) return true
  return false
}
