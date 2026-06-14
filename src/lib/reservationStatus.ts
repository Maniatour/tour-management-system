/** 예약 상태 코드 — DB `reservations.status` 와 동일 */
export type ReservationStatusCode =
  | 'inquiry'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export const RESERVATION_STATUS_FORM_OPTIONS: ReservationStatusCode[] = [
  'inquiry',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

export const RESERVATION_STATUS_I18N_OPTIONS = RESERVATION_STATUS_FORM_OPTIONS.map((value) => ({
  value,
  labelKey: `status.${value}` as const,
}))

export function isNoShowReservationStatus(status: string | null | undefined): boolean {
  return String(status ?? '').toLowerCase().trim() === 'no_show'
}

export function isCancelledReservationStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase().trim()
  return s === 'cancelled' || s === 'canceled'
}

/** 취소·노쇼: 불포함·잔액 0 — 취소 전용 정산 분기(`isCancelledReservationStatus`)와 구분 */
export function isNotIncludedExcludedReservationStatus(status: string | null | undefined): boolean {
  return isCancelledReservationStatus(status) || isNoShowReservationStatus(status)
}

export function isTerminalNegativeReservationStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase().trim()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted' || s === 'no_show'
}
