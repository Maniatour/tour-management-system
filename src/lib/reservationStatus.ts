/** 예약 상태 코드 — DB `reservations.status` 와 동일 */
export type ReservationStatusCode =
  | 'inquiry'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'date_changed'

export const DATE_CHANGED_RESERVATION_STATUS = 'date_changed' as const

export const RESERVATION_STATUS_FORM_OPTIONS: ReservationStatusCode[] = [
  'inquiry',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

export function isDateChangedReservationStatus(status: string | null | undefined): boolean {
  return String(status ?? '').toLowerCase().trim() === DATE_CHANGED_RESERVATION_STATUS
}

/** 투어 자동 배정·미배정 큐·진행인원에서 제외 (티켓 L/X만 별도 합산) */
export function reservationExcludedFromTourAssignment(status: string | null | undefined): boolean {
  return isDateChangedReservationStatus(status)
}

/** 상태 셀렉트: 자리표시 예약일 때만 날짜변경 옵션을 보여 줌 */
export function reservationStatusSelectOptions(
  currentStatus: string | null | undefined
): Array<{ value: ReservationStatusCode; labelKey: `status.${ReservationStatusCode}` }> {
  const current = String(currentStatus ?? '').toLowerCase().trim()
  const options = [...RESERVATION_STATUS_I18N_OPTIONS]
  if (current === DATE_CHANGED_RESERVATION_STATUS) {
    options.push({
      value: DATE_CHANGED_RESERVATION_STATUS,
      labelKey: 'status.date_changed',
    })
  }
  return options
}

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
