/** 동행 모집 → 출발 확정 전환 기준 인원 (고객 예약 캘린더와 동일) */
export const TOUR_DEPARTURE_MIN_PARTICIPANTS = 4

export type DepartureBatchModalReason = 'threshold_crossed' | 'pending_on_confirmed_day'

/** 해당일 인원 집계·예약 상태 자동 판정에 포함할 예약 상태 */
export function reservationCountsTowardDepartureThreshold(
  status: string | null | undefined
): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return false
  if (s.includes('cancel')) return false
  if (s === 'inquiry') return false
  if (s === 'no_show' || s === 'noshow') return false
  if (s === 'date_changed') return false
  return true
}

/** 예약 가져오기 확정 시 자동 부여할 예약 상태 */
export function computeImportReservationStatus(
  existingTotalPeople: number,
  newReservationPeople: number
): 'pending' | 'confirmed' {
  const total = existingTotalPeople + newReservationPeople
  return total >= TOUR_DEPARTURE_MIN_PARTICIPANTS ? 'confirmed' : 'pending'
}

export function didCrossDepartureThreshold(before: number, after: number): boolean {
  return (
    before < TOUR_DEPARTURE_MIN_PARTICIPANTS && after >= TOUR_DEPARTURE_MIN_PARTICIPANTS
  )
}

/** 출발 확정(4인+) 이후 일괄 출발 안내 모달 표시 여부 */
export function shouldShowDepartureEmailBatchModal(input: {
  totalPeopleAfter: number
  crossedThreshold: boolean
  pendingReservationCount: number
}): boolean {
  if (input.totalPeopleAfter < TOUR_DEPARTURE_MIN_PARTICIPANTS) return false
  return input.crossedThreshold || input.pendingReservationCount > 0
}

export function sumReservationPeople(
  rows: Array<{ total_people?: number | null; status?: string | null }>
): number {
  return rows
    .filter((row) => reservationCountsTowardDepartureThreshold(row.status))
    .reduce((sum, row) => sum + (row.total_people || 0), 0)
}
