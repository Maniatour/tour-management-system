import {
  looksLikePeopleFeeChoiceGroup,
  looksLikeRoomChoiceGroup,
  looksLikeVehicleChoiceGroup,
} from '@/lib/choiceOptionCapacity'
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
  choices?: unknown
}

export type TourHotelChoiceLite = {
  reservation_id?: string | null
  quantity?: number | null
  choice_group?: string | null
  choice_group_ko?: string | null
  choice_group_en?: string | null
  option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
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

function assignedCanonKeys(tour: { reservation_ids?: unknown }): Set<string> {
  const assignedCanon = new Set<string>()
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
  }
  return assignedCanon
}

export function assignedReservationsForTour(
  tour: { tour_date?: string | null; product_id?: string | null; reservation_ids?: unknown },
  reservations: TourHotelReservationLite[]
): TourHotelReservationLite[] {
  const tourDate = String(tour.tour_date || '').trim().slice(0, 10)
  const productId = tour.product_id
  if (!tourDate || productId == null || productId === '') return []

  const assignedCanon = assignedCanonKeys(tour)
  if (assignedCanon.size === 0) return []

  return reservations.filter((reservation) => {
    if (String(reservation.product_id) !== String(productId)) return false
    const rd = reservation.tour_date ? String(reservation.tour_date).trim().slice(0, 10) : ''
    if (rd !== tourDate) return false
    if (!isActiveReservationForTourHotel(reservation.status)) return false
    return assignedCanon.has(canonicalReservationIdKey(String(reservation.id)))
  })
}

function parseChoicesJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

export function hotelChoicesFromReservationJson(raw: unknown): TourHotelChoiceLite[] {
  const obj = parseChoicesJson(raw)
  if (!obj || !Array.isArray(obj.required)) return []

  const rows: TourHotelChoiceLite[] = []
  for (const item of obj.required as Array<Record<string, unknown>>) {
    const groupName =
      (item.choice_group_ko as string | null) ||
      (item.choice_group as string | null) ||
      (item.choice_group_en as string | null) ||
      null
    const qty = Number(item.quantity)
    const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1

    if (
      item.option_id ||
      item.option_key ||
      item.option_name_ko ||
      item.option_name ||
      item.option_name_en
    ) {
      rows.push({
        quantity,
        choice_group: groupName,
        choice_group_ko: (item.choice_group_ko as string | null) ?? null,
        choice_group_en: (item.choice_group_en as string | null) ?? null,
        option_key: (item.option_key as string | null) ?? null,
        option_name: (item.option_name as string | null) ?? null,
        option_name_ko: (item.option_name_ko as string | null) ?? null,
        option_name_en: (item.option_name_en as string | null) ?? null,
      })
      continue
    }

    if (!Array.isArray(item.options)) continue
    for (const opt of item.options as Array<Record<string, unknown>>) {
      if (!(opt.selected || opt.is_default)) continue
      rows.push({
        quantity,
        choice_group: groupName,
        choice_group_ko: (item.choice_group_ko as string | null) ?? null,
        choice_group_en: (item.choice_group_en as string | null) ?? null,
        option_key: (opt.option_key as string | null) ?? null,
        option_name: ((opt.option_name as string | null) || (opt.name as string | null)) ?? null,
        option_name_ko:
          ((opt.option_name_ko as string | null) || (opt.name_ko as string | null)) ?? null,
        option_name_en:
          ((opt.option_name_en as string | null) || (opt.name_en as string | null)) ?? null,
      })
    }
  }
  return rows
}

export function isCustomerHotelRoomChoice(choice: TourHotelChoiceLite): boolean {
  const groupName = [choice.choice_group_ko, choice.choice_group_en, choice.choice_group]
    .filter(Boolean)
    .join(' ')
  const optionLabel = [choice.option_name_ko, choice.option_name, choice.option_name_en, choice.option_key]
    .filter(Boolean)
    .join(' ')
  const option = { option_name: optionLabel, option_name_ko: choice.option_name_ko ?? null }
  if (looksLikePeopleFeeChoiceGroup(groupName, [option])) return false
  if (looksLikeVehicleChoiceGroup(groupName, [option])) return false
  return looksLikeRoomChoiceGroup(groupName, [option])
}

export function countHotelRoomsFromChoices(choices: TourHotelChoiceLite[]): number {
  let total = 0
  for (const choice of choices) {
    if (!isCustomerHotelRoomChoice(choice)) continue
    const qty = Number(choice.quantity)
    if (choice.quantity == null || Number.isNaN(qty)) {
      total += 1
      continue
    }
    if (qty <= 0) continue
    total += Math.floor(qty)
  }
  return total
}

export function indexHotelChoicesByReservationId(
  rows: TourHotelChoiceLite[]
): Map<string, TourHotelChoiceLite[]> {
  const map = new Map<string, TourHotelChoiceLite[]>()
  for (const row of rows) {
    const rid = String(row.reservation_id || '').trim()
    if (!rid) continue
    const keys = new Set([rid, canonicalReservationIdKey(rid)])
    for (const key of keys) {
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
  }
  return map
}

function choicesForReservation(
  reservation: TourHotelReservationLite,
  choicesByReservationId?: Map<string, TourHotelChoiceLite[]>
): TourHotelChoiceLite[] {
  const rid = String(reservation.id || '').trim()
  const canon = canonicalReservationIdKey(rid)
  const fromTable = choicesByReservationId?.get(rid) || choicesByReservationId?.get(canon) || []
  if (fromTable.length > 0) return fromTable
  return hotelChoicesFromReservationJson(reservation.choices)
}

/** 투어에 배정된 활성 예약의 고객 호텔 객실 수. 초이스(2인1실+3인1실 등) 수량 합산, 없으면 예약 1건=1실 */
export function countCustomerHotelRoomsForTour(
  tour: { tour_date?: string | null; product_id?: string | null; reservation_ids?: unknown },
  reservations: TourHotelReservationLite[],
  choicesByReservationId?: Map<string, TourHotelChoiceLite[]>
): number {
  const assigned = assignedReservationsForTour(tour, reservations)
  let count = 0
  for (const reservation of assigned) {
    const fromChoices = countHotelRoomsFromChoices(
      choicesForReservation(reservation, choicesByReservationId)
    )
    count += fromChoices > 0 ? fromChoices : 1
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
  return assignedReservationsForTour(tour, reservations).reduce(
    (total, reservation) => total + reservationPeopleCount(reservation),
    0
  )
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
