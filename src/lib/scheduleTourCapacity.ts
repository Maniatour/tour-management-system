import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export interface DayTourCapacityTotals {
  totalAssigned: number
  totalMax: number
  totalSpotsLeft: number
}

export interface PerTourCapacityRow {
  tourId: string
  assigned: number
  max: number
  spotsLeft: number
}

export interface ScheduleTourCapacityInput {
  id: string
  tour_date: string
  tour_status?: string | null
  max_participants?: number | null
  reservation_ids?: string[] | null
  product_id?: string | null
}

export interface ScheduleReservationCapacityInput {
  id: string
  tour_date: string
  product_id?: string | null
  total_people?: number | null
  status?: string | null
}

const DEFAULT_TOUR_MAX = 12

function isActiveReservationStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'confirmed' || s === 'recruiting'
}

/** 투어별 배정·정원·잔여 좌석 (ScheduleView 투어 용량 행과 동일) */
export function computePerTourCapacityRows(
  tours: ScheduleTourCapacityInput[],
  reservations: ScheduleReservationCapacityInput[],
  date: string,
  productId: string
): PerTourCapacityRow[] {
  const dateYmd = date.slice(0, 10)

  const dayTours = tours
    .filter((tour) => String(tour.tour_date).slice(0, 10) === dateYmd)
    .filter((tour) => !isTourCancelled(tour.tour_status))
    .filter((tour) => !productId || String(tour.product_id || '') === productId)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const dayReservations = reservations.filter(
    (reservation) =>
      String(reservation.tour_date).slice(0, 10) === dateYmd &&
      (!productId || String(reservation.product_id || '') === productId) &&
      isActiveReservationStatus(reservation.status)
  )

  return dayTours.map((tour) => {
    const assignedCanon = new Set<string>()
    for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
      if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
    }
    const assigned = dayReservations
      .filter((reservation) =>
        assignedCanon.has(canonicalReservationIdKey(String(reservation.id)))
      )
      .reduce((sum, reservation) => sum + (reservation.total_people || 0), 0)
    const max =
      typeof tour.max_participants === 'number' && Number.isFinite(tour.max_participants)
        ? tour.max_participants
        : DEFAULT_TOUR_MAX
    const spotsLeft = Math.max(0, max - assigned)
    return { tourId: String(tour.id), assigned, max, spotsLeft }
  })
}

/** 잔여 좌석이 가장 많은 투어 ID (동률이면 배정 인원 적은 쪽, 그다음 ID 순) */
export function pickTourWithMostSpotsLeft(rows: PerTourCapacityRow[]): string | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    if (b.spotsLeft !== a.spotsLeft) return b.spotsLeft - a.spotsLeft
    if (a.assigned !== b.assigned) return a.assigned - b.assigned
    return a.tourId.localeCompare(b.tourId)
  })
  return sorted[0]?.tourId ?? null
}

/** ScheduleView 상품 셀 툴팁 `총 N명 / M명` 과 동일한 집계 */
export function computeDayTourCapacityTotals(
  tours: ScheduleTourCapacityInput[],
  reservations: ScheduleReservationCapacityInput[],
  date: string,
  productId: string
): DayTourCapacityTotals | null {
  const dateYmd = date.slice(0, 10)

  const dayTours = tours
    .filter((tour) => String(tour.tour_date).slice(0, 10) === dateYmd)
    .filter((tour) => !isTourCancelled(tour.tour_status))
    .filter((tour) => !productId || String(tour.product_id || '') === productId)

  if (dayTours.length === 0) return null

  const dayReservations = reservations.filter(
    (reservation) =>
      String(reservation.tour_date).slice(0, 10) === dateYmd &&
      (!productId || String(reservation.product_id || '') === productId) &&
      isActiveReservationStatus(reservation.status)
  )

  let totalAssigned = 0
  let totalMax = 0

  for (const tour of dayTours) {
    const assignedCanon = new Set<string>()
    for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
      if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
    }
    const assigned = dayReservations
      .filter((reservation) =>
        assignedCanon.has(canonicalReservationIdKey(String(reservation.id)))
      )
      .reduce((sum, reservation) => sum + (reservation.total_people || 0), 0)
    const max =
      typeof tour.max_participants === 'number' && Number.isFinite(tour.max_participants)
        ? tour.max_participants
        : DEFAULT_TOUR_MAX

    totalAssigned += assigned
    totalMax += max
  }

  return {
    totalAssigned,
    totalMax,
    totalSpotsLeft: Math.max(0, totalMax - totalAssigned),
  }
}

export function buildCapacityTotalsByDate(
  tours: ScheduleTourCapacityInput[],
  reservations: ScheduleReservationCapacityInput[],
  productId: string,
  dates: string[]
): Record<string, DayTourCapacityTotals> {
  const result: Record<string, DayTourCapacityTotals> = {}
  for (const date of dates) {
    const totals = computeDayTourCapacityTotals(tours, reservations, date, productId)
    if (totals) result[date] = totals
  }
  return result
}
