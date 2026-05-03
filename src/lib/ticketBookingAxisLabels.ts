/**
 * ticket_bookings 다축 상태값 표시 — `booking.calendar.ticketBookingAxis` 번역 사용.
 * DB CHECK 값과 동일한 소문자 키를 기준으로 합니다.
 */

export type TicketBookingAxisKind =
  | 'booking'
  | 'vendor'
  | 'change'
  | 'payment'
  | 'refund'
  | 'operation'

/** 번역 키가 정의된 값만 로케일 문자열로 바꿉니다. 그 외·알 수 없는 값은 원문 표시. */
const AXIS_VALUE_SETS: Record<TicketBookingAxisKind, ReadonlySet<string>> = {
  booking: new Set([
    'requested',
    'on_hold',
    'tentative',
    'confirmed',
    'cancel_requested',
    'cancelled',
    'no_show',
    'failed',
    'expired',
  ]),
  vendor: new Set(['pending', 'confirmed', 'rejected', 'changed', 'cancelled']),
  change: new Set(['none', 'requested', 'confirmed', 'rejected', 'cancelled']),
  payment: new Set(['not_due', 'requested', 'paid', 'partially_paid', 'failed', 'refunded']),
  refund: new Set([
    'none',
    'requested',
    'credit_received',
    'partially_refunded',
    'refunded',
    'rejected',
  ]),
  operation: new Set([
    'none',
    'reconfirm_needed',
    'reconfirmed',
    'issue_reported',
    'under_review',
    'resolved',
  ]),
}

/** UI `<select>` 옵션 순서 (값은 DB CHECK와 동일) */
export const TICKET_BOOKING_AXIS_SELECT_ORDER: Record<TicketBookingAxisKind, readonly string[]> = {
  booking: [
    'requested',
    'on_hold',
    'tentative',
    'confirmed',
    'cancel_requested',
    'cancelled',
    'no_show',
    'failed',
    'expired',
  ],
  vendor: ['pending', 'confirmed', 'rejected', 'changed', 'cancelled'],
  change: ['none', 'requested', 'confirmed', 'rejected', 'cancelled'],
  payment: ['not_due', 'requested', 'paid', 'partially_paid', 'failed', 'refunded'],
  refund: ['none', 'requested', 'credit_received', 'partially_refunded', 'refunded', 'rejected'],
  operation: ['none', 'reconfirm_needed', 'reconfirmed', 'issue_reported', 'under_review', 'resolved'],
}

/**
 * @param t — `useTranslations('booking.calendar.ticketBookingAxis')` 결과
 */
export function formatTicketBookingAxisLabel(
  t: (key: string) => string,
  axis: TicketBookingAxisKind,
  value: string | null | undefined
): string {
  const raw = (value ?? '').trim()
  if (!raw) return t('emptyMark')
  const keyLower = raw.toLowerCase()
  if (!AXIS_VALUE_SETS[axis].has(keyLower)) return raw
  return t(`${axis}.${keyLower}`)
}

/** 테이블·칩용 — 예약 축(`booking_status`) 뱃지 색 (레거시 `status` 뱃지와 중복 없이 단일 표시) */
export function getBookingAxisStatusBadgeClass(bookingStatus: string | null | undefined): string {
  const s = (bookingStatus ?? 'requested').trim().toLowerCase()
  switch (s) {
    case 'requested':
      return 'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200/80'
    case 'tentative':
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
    case 'on_hold':
      return 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80'
    case 'confirmed':
      return 'bg-green-100 text-green-800 ring-1 ring-green-200/80'
    case 'cancel_requested':
      return 'bg-orange-100 text-orange-900 ring-1 ring-orange-200/80'
    case 'cancelled':
      return 'bg-red-100 text-red-800 ring-1 ring-red-200/80'
    case 'failed':
      return 'bg-rose-100 text-rose-900 ring-1 ring-rose-200/80'
    case 'expired':
      return 'bg-gray-200 text-gray-800 ring-1 ring-gray-300/80'
    case 'no_show':
      return 'bg-slate-200 text-slate-800 ring-1 ring-slate-300/80'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/80'
  }
}

/** 테이블·칩용 — 벤더 축(`vendor_status`) 뱃지 색 */
export function getVendorAxisStatusBadgeClass(vendorStatus: string | null | undefined): string {
  const s = (vendorStatus ?? 'pending').trim().toLowerCase()
  switch (s) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200/80'
    case 'confirmed':
      return 'bg-green-100 text-green-800 ring-1 ring-green-200/80'
    case 'rejected':
      return 'bg-red-100 text-red-800 ring-1 ring-red-200/80'
    case 'changed':
      return 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/80'
    case 'cancelled':
      return 'bg-gray-200 text-gray-800 ring-1 ring-gray-300/80'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/80'
  }
}

/** 변경 축(`change_status`) 뱃지 색 */
export function getChangeAxisStatusBadgeClass(changeStatus: string | null | undefined): string {
  const s = (changeStatus ?? 'none').trim().toLowerCase()
  switch (s) {
    case 'requested':
      return 'bg-purple-100 text-purple-900 ring-1 ring-purple-200/80'
    case 'confirmed':
      return 'bg-green-100 text-green-800 ring-1 ring-green-200/80'
    case 'rejected':
      return 'bg-red-100 text-red-800 ring-1 ring-red-200/80'
    case 'cancelled':
      return 'bg-gray-200 text-gray-800 ring-1 ring-gray-300/80'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/80'
  }
}
