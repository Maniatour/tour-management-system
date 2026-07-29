import {
  aggregateTicketEaByCanyon,
  isTicketBookingEaCountingStatus,
  ticketBookingCanyonKeyFromBooking,
} from '@/lib/ticketBookingDateView'
import {
  getCancelDueDateForTicketBooking,
  localDateYmd,
  type SeasonDate,
} from '@/lib/ticketBookingCancelDue'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import type { TourChoiceCounts } from '@/lib/tourChoiceCounts'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import { ANTELOPE_CANCEL_DUE_CHECKIN_OFFSET_DAYS } from '@/lib/antelopeCanyonBookingTodo'

export type AntelopeCanyonTicketLite = {
  id: string
  tour_id: string | null
  check_in_date: string
  company: string
  category: string
  time: string
  ea: number
  rn_number: string | null
  status: string
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  pending_ea?: number | null
  pending_time?: string | null
  deletion_requested_at?: string | null
}

export type AntelopeCanyonTourLite = {
  id: string
  tour_date: string
  product_id?: string | null
  tour_status?: string | null
  reservation_ids?: unknown
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

export type ReservationLite = {
  id: string
  tour_date: string
  product_id?: string | null
  status?: string | null
  total_people?: number | null
}

export type AntelopeCanyonMismatchTourRow = {
  id: string
  tour_date: string
  product_name: string
  tour_people: number
  ticket_ea: number
  ticket_ea_current: number
  ticket_counts: TourChoiceCounts
  has_pending_change: boolean
  tickets: AntelopeCanyonTicketLite[]
}

export type AntelopeCanyonCancelDueTourRow = {
  id: string
  tour_id: string
  tour_date: string
  product_name: string
  check_in_date: string
  cancel_due_date: string
  tour_people: number
  ticket_ea: number
  ticket_ea_current: number
  cancel_from: number
  cancel_to: number
  has_pending_change: boolean
  tickets: AntelopeCanyonTicketLite[]
}

export function isAntelopeCanyonTicketBooking(booking: {
  company?: string | null
  category?: string | null
}): boolean {
  if (ticketBookingCanyonKeyFromBooking(booking)) return true
  const cat = (booking.category || '').trim().toLowerCase()
  if (!cat) {
    const co = (booking.company || '').trim().toLowerCase()
    return co.includes('antelope') || co.includes('see canyon') || co === 'mei tour'
  }
  if (cat === 'antelope_canyon' || cat === 'antelope' || cat === 's_antelope') return true
  if (cat.includes('antelope') || cat.includes('entrance')) return true
  const co = (booking.company || '').trim().toLowerCase()
  return co.includes('antelope') || co.includes('see canyon') || co === 'mei tour'
}

export function isTicketChangeRequested(booking: {
  change_status?: string | null
}): boolean {
  return String(booking.change_status ?? 'none').toLowerCase().trim() === 'requested'
}

/** 변경 요청 중이면 pending_ea, 아니면 현재 ea */
export function effectiveTicketEa(booking: AntelopeCanyonTicketLite): number {
  if (!isTicketBookingEaCountingStatus(booking.status)) return 0
  if (isTicketChangeRequested(booking) && booking.pending_ea != null) {
    return Number(booking.pending_ea) || 0
  }
  return Number(booking.ea) || 0
}

export function currentTicketEa(booking: AntelopeCanyonTicketLite): number {
  if (!isTicketBookingEaCountingStatus(booking.status)) return 0
  return Number(booking.ea) || 0
}

export function computeTourAssignedPeople(
  tour: AntelopeCanyonTourLite,
  reservations: ReservationLite[]
): number {
  const tourDate = String(tour.tour_date || '').trim().slice(0, 10)
  const productId = tour.product_id
  if (!tourDate || productId == null || productId === '') return 0

  const assignedCanon = new Set<string>()
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
  }
  if (assignedCanon.size === 0) return 0

  const st = (s: string | null | undefined) => (s || '').toLowerCase().trim()
  return reservations.reduce((sum, r) => {
    if (String(r.product_id) !== String(productId)) return sum
    const rd = r.tour_date ? String(r.tour_date).trim().slice(0, 10) : ''
    if (rd !== tourDate) return sum
    const ss = st(r.status)
    if (ss !== 'confirmed' && ss !== 'recruiting') return sum
    if (!assignedCanon.has(canonicalReservationIdKey(String(r.id)))) return sum
    return sum + (Number(r.total_people) || 0)
  }, 0)
}

function productDisplayName(tour: AntelopeCanyonTourLite): string {
  const p = tour.products
  return p?.name_ko?.trim() || p?.name?.trim() || p?.name_en?.trim() || tour.product_id || tour.id
}

function activeTickets(tickets: AntelopeCanyonTicketLite[]): AntelopeCanyonTicketLite[] {
  return filterTicketBookingsExcludedFromMainUi(tickets).filter((t) =>
    isTicketBookingEaCountingStatus(t.status)
  )
}

/** 투어에 연결된 모든 활성 티켓 (앤텔롭 초이스 유무·카테고리와 무관) */
function ticketsForTour(
  tourId: string,
  allTickets: AntelopeCanyonTicketLite[]
): AntelopeCanyonTicketLite[] {
  return activeTickets(allTickets).filter((t) => String(t.tour_id || '').trim() === tourId)
}

function sumEffectiveTicketEa(tickets: AntelopeCanyonTicketLite[]): number {
  return tickets.reduce((sum, t) => sum + effectiveTicketEa(t), 0)
}

function sumCurrentTicketEa(tickets: AntelopeCanyonTicketLite[]): number {
  return tickets.reduce((sum, t) => sum + currentTicketEa(t), 0)
}

function tourHasPendingTicketChange(tickets: AntelopeCanyonTicketLite[]): boolean {
  return tickets.some(isTicketChangeRequested)
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function buildAntelopeCanyonMismatchRows(input: {
  tours: AntelopeCanyonTourLite[]
  reservations: ReservationLite[]
  ticketBookings: AntelopeCanyonTicketLite[]
}): AntelopeCanyonMismatchTourRow[] {
  const { tours, reservations, ticketBookings } = input
  const rows: AntelopeCanyonMismatchTourRow[] = []

  for (const tour of tours) {
    if (isTourDeleted(tour.tour_status) || isTourCancelled(tour.tour_status)) continue

    const tourTickets = ticketsForTour(tour.id, ticketBookings)
    if (!tourTickets.length) continue

    const tourPeople = computeTourAssignedPeople(tour, reservations)
    const ticketEaEffective = sumEffectiveTicketEa(tourTickets)
    const ticketEaCurrent = sumCurrentTicketEa(tourTickets)
    const hasPendingChange = tourHasPendingTicketChange(tourTickets)
    const ticketCounts = aggregateTicketEaByCanyon(tourTickets)

    if (tourPeople <= 0 && ticketEaEffective <= 0 && !hasPendingChange) continue
    if (tourPeople === ticketEaEffective && !hasPendingChange) continue

    rows.push({
      id: tour.id,
      tour_date: tour.tour_date,
      product_name: productDisplayName(tour),
      tour_people: tourPeople,
      ticket_ea: ticketEaEffective,
      ticket_ea_current: ticketEaCurrent,
      ticket_counts: ticketCounts,
      has_pending_change: hasPendingChange,
      tickets: tourTickets,
    })
  }

  return rows.sort(
    (a, b) => a.tour_date.localeCompare(b.tour_date) || a.product_name.localeCompare(b.product_name)
  )
}

export function buildAntelopeCanyonCancelDueRows(input: {
  tours: AntelopeCanyonTourLite[]
  reservations: ReservationLite[]
  ticketBookings: AntelopeCanyonTicketLite[]
  supplierProductsByBookingId: Map<string, { season_dates: SeasonDate[] | null }>
  todayYmd?: string
}): AntelopeCanyonCancelDueTourRow[] {
  const today = input.todayYmd || localDateYmd()
  const d2CheckIn = addCalendarDaysYmd(today, ANTELOPE_CANCEL_DUE_CHECKIN_OFFSET_DAYS)

  const toursById = new Map<string, AntelopeCanyonTourLite>()
  for (const tour of input.tours) {
    if (!isTourDeleted(tour.tour_status) && !isTourCancelled(tour.tour_status)) {
      toursById.set(tour.id, tour)
    }
  }

  const grouped = new Map<string, AntelopeCanyonTicketLite[]>()

  for (const booking of activeTickets(input.ticketBookings)) {
    const checkIn = String(booking.check_in_date || '').slice(0, 10)
    if (!checkIn) continue

    const supplier = input.supplierProductsByBookingId.get(booking.id)
    const cancelDue = getCancelDueDateForTicketBooking(booking, supplier)
    const isDueToday = cancelDue === today
    const isD2CheckIn = checkIn === d2CheckIn
    if (!isDueToday && !isD2CheckIn) continue

    const tid = String(booking.tour_id || '').trim()
    if (!tid) continue
    const key = `${tid}::${checkIn}`
    const list = grouped.get(key) || []
    list.push(booking)
    grouped.set(key, list)
  }

  const rows: AntelopeCanyonCancelDueTourRow[] = []

  for (const [key, dueTickets] of grouped) {
    const [tourId, checkInDate] = key.split('::')
    const tour = toursById.get(tourId)
    if (!tour) continue

    const tourTickets = ticketsForTour(tourId, input.ticketBookings)
    const displayTickets = tourTickets.length > 0 ? tourTickets : dueTickets

    const tourPeople = computeTourAssignedPeople(tour, input.reservations)
    const ticketEaEffective = sumEffectiveTicketEa(displayTickets)
    const ticketEaCurrent = sumCurrentTicketEa(displayTickets)
    const hasPendingChange = tourHasPendingTicketChange(displayTickets)

    const needsCancel = ticketEaEffective > tourPeople
    if (!needsCancel && !hasPendingChange) continue

    const supplier = input.supplierProductsByBookingId.get(dueTickets[0]!.id)
    const cancelDueDate = getCancelDueDateForTicketBooking(dueTickets[0]!, supplier) || today

    rows.push({
      id: key,
      tour_id: tourId,
      tour_date: tour.tour_date,
      product_name: productDisplayName(tour),
      check_in_date: checkInDate,
      cancel_due_date: cancelDueDate,
      tour_people: tourPeople,
      ticket_ea: ticketEaEffective,
      ticket_ea_current: ticketEaCurrent,
      cancel_from: ticketEaEffective,
      cancel_to: tourPeople,
      has_pending_change: hasPendingChange,
      tickets: displayTickets,
    })
  }

  return rows.sort(
    (a, b) =>
      a.check_in_date.localeCompare(b.check_in_date) || a.product_name.localeCompare(b.product_name)
  )
}

export function formatAntelopeCanyonCountSummary(
  counts: TourChoiceCounts,
  isKo: boolean
): string {
  const parts: string[] = []
  if (counts.L) parts.push(`L ${counts.L}`)
  if (counts.X) parts.push(`X ${counts.X}`)
  if (counts.U) parts.push(`U ${counts.U}`)
  if (!parts.length) return isKo ? '—' : '—'
  return parts.join(' · ')
}

export function formatTicketEaWithPending(
  ticket: AntelopeCanyonTicketLite,
  isKo: boolean
): string {
  const cur = currentTicketEa(ticket)
  if (isTicketChangeRequested(ticket) && ticket.pending_ea != null && ticket.pending_ea !== cur) {
    return `${cur} → ${ticket.pending_ea}${isKo ? '장' : ''}`
  }
  return `${cur}${isKo ? '장' : ''}`
}
