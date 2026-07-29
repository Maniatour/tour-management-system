import { getMultiDayTourDays } from '@/lib/scheduleVehicleOilMaintenance'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'

export type TourHotelReservationLite = {
  id: string
  tour_date: string
  product_id?: string | null
  status?: string | null
  pickup_hotel?: string | null
  total_people?: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

export type TourHotelBookingLite = {
  tour_id?: string | null
  status?: string | null
  hotel?: string | null
  rooms?: number | null
  deletion_requested_at?: string | null
}

export function isActiveTourHotelBookingStatus(status: string | null | undefined): boolean {
  if (!status) return true
  const s = status.toLowerCase().trim()
  if (s === 'cancelled' || s === 'canceled') return false
  return (
    s === 'confirmed' ||
    s === 'paid' ||
    s === 'pending' ||
    s === 'tentative' ||
    s === 'completed' ||
    s === ''
  )
}

export function isActiveReservationForTourHotel(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase().trim()
  return s === 'confirmed' || s === 'recruiting'
}

/** 투어에 배정된 활성 예약 수 = 고객 호텔(룸) 필요 수 */
export function countCustomerHotelRoomsForTour(
  tour: { tour_date?: string | null; product_id?: string | null; reservation_ids?: unknown },
  reservations: TourHotelReservationLite[]
): number {
  const tourDate = String(tour.tour_date || '').trim().slice(0, 10)
  const productId = tour.product_id
  if (!tourDate || productId == null || productId === '') return 0

  const assignedCanon = new Set<string>()
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
  }
  if (assignedCanon.size === 0) return 0

  let count = 0
  for (const reservation of reservations) {
    if (String(reservation.product_id) !== String(productId)) continue
    const rd = reservation.tour_date ? String(reservation.tour_date).trim().slice(0, 10) : ''
    if (rd !== tourDate) continue
    if (!isActiveReservationForTourHotel(reservation.status)) continue
    if (!assignedCanon.has(canonicalReservationIdKey(String(reservation.id)))) continue
    count += 1
  }
  return count
}

function reservationPeopleCount(reservation: TourHotelReservationLite): number {
  const total = Number(reservation.total_people)
  if (Number.isFinite(total) && total > 0) return total
  const adults = Number(reservation.adults) || 0
  const children = Number(reservation.child) || 0
  const infants = Number(reservation.infant) || 0
  return adults + children + infants
}

/** 투어에 배정된 활성 예약 인원 합계 */
export function sumCustomerHotelPeopleForTour(
  tour: { tour_date?: string | null; product_id?: string | null; reservation_ids?: unknown },
  reservations: TourHotelReservationLite[]
): number {
  const tourDate = String(tour.tour_date || '').trim().slice(0, 10)
  const productId = tour.product_id
  if (!tourDate || productId == null || productId === '') return 0

  const assignedCanon = new Set<string>()
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
  }
  if (assignedCanon.size === 0) return 0

  let total = 0
  for (const reservation of reservations) {
    if (String(reservation.product_id) !== String(productId)) continue
    const rd = reservation.tour_date ? String(reservation.tour_date).trim().slice(0, 10) : ''
    if (rd !== tourDate) continue
    if (!isActiveReservationForTourHotel(reservation.status)) continue
    if (!assignedCanon.has(canonicalReservationIdKey(String(reservation.id)))) continue
    total += reservationPeopleCount(reservation)
  }
  return total
}

export function countBookedTourHotelRooms(bookings: TourHotelBookingLite[]): number {
  let total = 0
  for (const booking of bookings) {
    if (booking.deletion_requested_at) continue
    if (!isActiveTourHotelBookingStatus(booking.status)) continue
    const hasHotelName = Boolean(String(booking.hotel ?? '').trim())
    const rooms = Number(booking.rooms) || 0
    if (!hasHotelName && rooms <= 0) continue
    total += Math.max(1, rooms)
  }
  return total
}

export function requiredTourHotelRoomCount(customerHotelRooms: number): number {
  if (customerHotelRooms <= 0) return 0
  return customerHotelRooms + 1
}

export function isMultiDayTourProduct(productId: string | null | undefined): boolean {
  return getMultiDayTourDays(String(productId || '').trim()) > 1
}

export function tourHotelBookingMismatch(
  customerHotelRooms: number,
  bookedHotelRooms: number
): boolean {
  const required = requiredTourHotelRoomCount(customerHotelRooms)
  if (required <= 0) return false
  return bookedHotelRooms !== required
}
