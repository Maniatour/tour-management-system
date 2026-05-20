import { normalizeTicketBookingStatusFromDb } from '@/lib/ticketBookingStatus'
import { isTicketBookingPendingRequestState } from '@/lib/ticketBookingWorkflow'

/** 목록 필터: 예매·변경 요청 후 벤더 응답 대기 (레거시 status 와 별도) */
export const TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING = '__vendor_pending__' as const

export type TicketBookingStatusFilterKey =
  | typeof TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING
  | string

export type TicketBookingStatusFilterRow = {
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  status?: string | null
}

function normalizedLegacyStatus(booking: TicketBookingStatusFilterRow): string {
  return String(normalizeTicketBookingStatusFromDb(booking.status)).toLowerCase()
}

function legacyStatusMatchesFilterKey(bookingStatus: string, key: string): boolean {
  const k = key.toLowerCase()
  if (k === 'cancelled') {
    return bookingStatus === 'cancelled' || bookingStatus === 'canceled'
  }
  return bookingStatus === k
}

/** 선택이 없으면 전체 통과 */
export function ticketBookingMatchesStatusFilters(
  booking: TicketBookingStatusFilterRow,
  selected: ReadonlySet<string>
): boolean {
  if (selected.size === 0) return true

  if (
    selected.has(TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING) &&
    isTicketBookingPendingRequestState(booking)
  ) {
    return true
  }

  const legacy = normalizedLegacyStatus(booking)
  for (const key of selected) {
    if (key === TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING) continue
    if (legacyStatusMatchesFilterKey(legacy, key)) return true
  }
  return false
}
