import {
  getScheduleColorRowKeyForProductId,
  getScheduleProductColorForProductId,
  type ScheduleProductRef,
} from '@/lib/scheduleAirportPickDropGroup'
import { canonicalReservationIdKey, normalizeReservationIds, normalizeTourDateKey } from '@/utils/tourUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any

export function computeTourAssignedPeopleForGuideCell(
  tour: Tour,
  reservations: Reservation[],
): number {
  const tourDate = normalizeTourDateKey(tour.tour_date)
  const productId = tour.product_id
  if (!tourDate || productId == null || productId === '') return 0

  const assignedCanon = new Set<string>()
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
  }
  if (assignedCanon.size === 0) return 0

  return reservations.reduce((sum, r) => {
    if (String(r.product_id) !== String(productId)) return sum
    if (normalizeTourDateKey(r.tour_date) !== tourDate) return sum
    const status = (r.status || '').toLowerCase().trim()
    if (status !== 'confirmed' && status !== 'recruiting') return sum
    if (!assignedCanon.has(canonicalReservationIdKey(String(r.id)))) return sum
    return sum + (r.total_people || 0)
  }, 0)
}

export function getGuideTourProductColorClass(
  tour: Tour,
  productColors: Record<string, string>,
  products: ScheduleProductRef[],
  defaultPresetIds: readonly string[],
  airportPickupMemberIdSet: Set<string>,
  airportSendingMemberIdSet: Set<string>,
): string {
  const colorRowKey = getScheduleColorRowKeyForProductId(
    tour.product_id,
    airportPickupMemberIdSet,
    airportSendingMemberIdSet,
  )
  if (!colorRowKey) return ''
  return getScheduleProductColorForProductId(
    tour.product_id,
    productColors,
    products,
    defaultPresetIds,
    airportPickupMemberIdSet,
    airportSendingMemberIdSet,
  )
}
