import {
  aggregateTourChoiceCounts,
  tourChoiceCountsHasDisplayable,
  type ReservationChoiceRow,
  type TourChoiceCounts,
} from '@/lib/tourChoiceCounts'
import { isDateChangedReservationStatus } from '@/lib/reservationStatus'
import { isTicketBookingEaCountingStatus, mergeTourChoiceCounts } from '@/lib/ticketBookingDateView'
import { normalizeTicketBookingTourIds } from '@/lib/ticketBookingTourIds'

type PlaceholderSnap = {
  id: string
  total_people?: number | null
  status?: string | null
}

type TicketSnap = {
  reservation_id?: string | null
  tour_id?: string | null
  tour_ids?: unknown
  status?: string | null
}

/**
 * 투어 미배정 date_changed 자리표시 초이스를,
 * 그 예약이 연결된 티켓의 투어 L/X에만 더한다. 진행인원(total_people)은 건드리지 않는다.
 */
export function applyDateChangedPlaceholderChoicesToTourCounts(input: {
  tourChoiceCountsByTourId: Map<string, TourChoiceCounts>
  bookings: TicketSnap[]
  placeholders: PlaceholderSnap[]
  choiceRowsByResId: Map<string, ReservationChoiceRow[]>
}): void {
  const placeholderById = new Map<string, PlaceholderSnap>()
  for (const p of input.placeholders) {
    const id = String(p.id || '').trim()
    if (!id || !isDateChangedReservationStatus(p.status)) continue
    placeholderById.set(id, p)
  }
  if (placeholderById.size === 0) return

  const added = new Set<string>()
  for (const booking of input.bookings) {
    if (!isTicketBookingEaCountingStatus(booking.status)) continue
    const rid = String(booking.reservation_id || '').trim()
    if (!rid) continue
    const placeholder = placeholderById.get(rid)
    if (!placeholder) continue
    const extra = aggregateTourChoiceCounts(
      [{ id: placeholder.id, total_people: placeholder.total_people ?? null }],
      input.choiceRowsByResId
    )
    if (!tourChoiceCountsHasDisplayable(extra)) continue
    for (const tourId of normalizeTicketBookingTourIds(booking.tour_ids, booking.tour_id)) {
      const key = `${tourId}:${rid}`
      if (added.has(key)) continue
      added.add(key)
      const current = input.tourChoiceCountsByTourId.get(tourId) || {}
      input.tourChoiceCountsByTourId.set(tourId, mergeTourChoiceCounts(current, extra))
    }
  }
}
