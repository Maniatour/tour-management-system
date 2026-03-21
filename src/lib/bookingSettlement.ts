/**
 * 투어 정산·리포트에서 부킹 금액을 합산할 때 사용하는 기준입니다.
 *
 * - `ticket_bookings`: **`expense`** 컬럼 합 (취소/크레딧 등 제외)
 * - `tour_hotel_bookings`: **`total_price`** 우선 합, 값이 없으면 `unit_price * rooms`
 *
 * 상태는 DB마다 다를 수 있어 **화이트리스트가 아니라 “취소만 제외”** 합니다.
 * `status`가 NULL·빈 문자열인 레거시 행은 포함합니다.
 */
export const BOOKING_SETTLEMENT_TICKET_STATUSES = [
  'tentative',
  'confirmed',
  'paid',
  'Confirmed',
  'Confirm',
  'completed',
] as const

export const BOOKING_SETTLEMENT_HOTEL_STATUSES = [
  'pending',
  'confirmed',
  'completed',
] as const

/** Supabase `.in('status', …)` 용 (레거시·다른 코드 경로 호환) */
export function ticketStatusesForSettlement(): string[] {
  return [...BOOKING_SETTLEMENT_TICKET_STATUSES]
}

export function hotelStatusesForSettlement(): string[] {
  return [...BOOKING_SETTLEMENT_HOTEL_STATUSES]
}

/** 정산에서 제외할 입장권 상태 (소문자 기준) */
const EXCLUDED_TICKET_STATUSES = new Set(['cancelled', 'credit'])

/** 정산에서 제외할 호텔 상태 */
const EXCLUDED_HOTEL_STATUSES = new Set(['cancelled', 'cancellation_requested'])

export function isTicketBookingIncludedInSettlement(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase().trim()
  if (!s) return true
  return !EXCLUDED_TICKET_STATUSES.has(s)
}

export function isHotelBookingIncludedInSettlement(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase().trim()
  if (!s) return true
  return !EXCLUDED_HOTEL_STATUSES.has(s)
}

export function ticketExpenseForSettlement(booking: { expense?: number | string | null }): number {
  const e = Number(booking.expense ?? 0)
  return Number.isFinite(e) ? e : 0
}

/**
 * 호텔 부킹 금액: DB의 `total_price` 합산이 목표.
 * `total_price`가 NULL/빈 값일 때만 레거시로 `unit_price * rooms` 보정.
 */
export function hotelAmountForSettlement(booking: {
  total_price?: number | string | null
  unit_price?: number | string | null
  rooms?: number | string | null
}): number {
  const raw = booking.total_price
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  const unit = Number(booking.unit_price ?? 0)
  const rooms = Number(booking.rooms ?? 0)
  const fb = unit * rooms
  return Number.isFinite(fb) ? fb : 0
}
