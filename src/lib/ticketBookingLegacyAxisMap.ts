/**
 * 레거시 UI/컬럼 `ticket_bookings.status` 값 ↔ 다축 상태.
 * `supabase/migrations/20260606120000_ticket_booking_action_status_engine.sql` 백필·파생 함수와 동일 규칙.
 */

export type TicketBookingAxisSnapshotRequired = {
  booking_status: string
  vendor_status: string
  change_status: string
  payment_status: string
  refund_status: string
  operation_status: string
}

/** 레거시 표시용 status 문자열 → 다축 초깃값 (INSERT·구형 행 보정용) */
export function axisSnapshotFromLegacyTicketBookingStatus(raw: string): TicketBookingAxisSnapshotRequired {
  const s = (raw ?? '').trim().toLowerCase()

  let booking_status: string
  switch (s) {
    case 'cancelled':
    case 'canceled':
      booking_status = 'cancelled'
      break
    case 'cancellation_requested':
      booking_status = 'cancel_requested'
      break
    case 'credit':
    case 'completed':
    case 'confirmed':
    case 'guest_change_requested':
    case 'time_change_requested':
    case 'payment_requested':
      booking_status = 'confirmed'
      break
    case 'tentative':
      booking_status = 'tentative'
      break
    case 'pending':
      booking_status = 'requested'
      break
    case 'paid':
      booking_status = 'confirmed'
      break
    default:
      booking_status = 'requested'
  }

  let vendor_status: string
  switch (s) {
    case 'cancelled':
    case 'canceled':
      vendor_status = 'cancelled'
      break
    case 'credit':
    case 'confirmed':
    case 'completed':
    case 'paid':
    case 'guest_change_requested':
    case 'time_change_requested':
    case 'payment_requested':
      vendor_status = 'confirmed'
      break
    case 'tentative':
      vendor_status = 'pending'
      break
    case 'pending':
      vendor_status = 'pending'
      break
    case 'cancellation_requested':
      vendor_status = 'pending'
      break
    default:
      vendor_status = 'pending'
  }

  let change_status: string
  switch (s) {
    case 'guest_change_requested':
    case 'time_change_requested':
      change_status = 'requested'
      break
    default:
      change_status = 'none'
  }

  let payment_status: string
  switch (s) {
    case 'paid':
      payment_status = 'paid'
      break
    case 'payment_requested':
      payment_status = 'requested'
      break
    case 'completed':
      payment_status = 'paid'
      break
    case 'credit':
      payment_status = 'paid'
      break
    default:
      payment_status = 'not_due'
  }

  let refund_status: string
  switch (s) {
    case 'credit':
      refund_status = 'credit_received'
      break
    default:
      refund_status = 'none'
  }

  return {
    booking_status,
    vendor_status,
    change_status,
    payment_status,
    refund_status,
    operation_status: 'none',
  }
}

/** 다축 → 레거시 `ticket_bookings.status` (DB `ticket_booking_derive_legacy_status` 와 동일) */
export function deriveLegacyTicketBookingStatusFromAxes(
  bs: string,
  _vs: string,
  cs: string,
  ps: string,
  rs: string,
  _os: string
): string {
  if (bs === 'cancelled') return 'cancelled'
  if (bs === 'cancel_requested') return 'cancellation_requested'
  if (bs === 'failed' || bs === 'expired') return 'cancelled'
  if (rs === 'credit_received' || rs === 'partially_refunded') return 'credit'
  if (rs === 'refunded') return 'cancelled'
  if (cs === 'requested' && bs === 'confirmed') return 'guest_change_requested'
  if (ps === 'requested' && bs === 'confirmed') return 'payment_requested'
  if (ps === 'failed' || ps === 'partially_paid') return 'pending'
  if (bs === 'confirmed' && ps === 'paid') return 'completed'
  if (bs === 'confirmed') return 'confirmed'
  if (bs === 'tentative') return 'tentative'
  if (bs === 'on_hold' || bs === 'requested') return 'pending'
  if (bs === 'no_show') return 'completed'
  return 'pending'
}
