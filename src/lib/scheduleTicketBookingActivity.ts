export type ScheduleTicketBookingActivityRow = {
  status?: string | null
  booking_status?: string | null
}

const CANCELLED_BOOKING_AXIS = new Set([
  'cancelled',
  'canceled',
  'cancel_requested',
  'failed',
  'expired',
])

const ACTIVE_BOOKING_AXIS = new Set(['tentative', 'on_hold', 'requested', 'confirmed', 'no_show'])

const ACTIVE_LEGACY_STATUS = new Set([
  'confirmed',
  'paid',
  'pending',
  'tentative',
  'completed',
  'guest_change_requested',
  'time_change_requested',
  'payment_requested',
  'cancellation_requested',
  'credit',
])

/** 스케줄 그리드 부킹 행·합계·건강점검 — 취소 제외, 다축 가예약·홀드 포함 */
export function isTicketBookingActiveForScheduleGrid(
  row: ScheduleTicketBookingActivityRow,
): boolean {
  const bs = (row.booking_status ?? '').trim().toLowerCase()
  if (bs && CANCELLED_BOOKING_AXIS.has(bs)) return false
  if (bs && ACTIVE_BOOKING_AXIS.has(bs)) return true

  const s = (row.status ?? '').trim().toLowerCase()
  if (!s) return false
  if (s === 'cancelled' || s === 'canceled') return false
  return ACTIVE_LEGACY_STATUS.has(s)
}

/** 가예약·홀드 — 투어 미연결 상태에서도 스케줄 부킹 행에 표시 */
export function isSchedulePreConfirmTicketBooking(
  row: ScheduleTicketBookingActivityRow,
): boolean {
  const bs = (row.booking_status ?? '').trim().toLowerCase()
  if (bs === 'tentative' || bs === 'on_hold') return true
  return (row.status ?? '').trim().toLowerCase() === 'tentative'
}
