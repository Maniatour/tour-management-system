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
import { isTicketBookingPendingRequestState } from '@/lib/ticketBookingWorkflow'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import type { TourChoiceCounts } from '@/lib/tourChoiceCounts'
import { tourProductRequiresTicketBookingCount } from '@/lib/ticketBookingCountTourProducts'
import {
  canonicalReservationIdKey,
  isReservationCancelledStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
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
  /** 일별 합계 행에서 투어 상세 링크용 */
  primary_tour_id?: string | null
  /** 당일 합산 시 같은 날 투어 개수 (2 이상일 때 뱃지 표시) */
  day_tour_count?: number
  tour_people: number
  ticket_ea: number
  ticket_ea_current: number
  ticket_counts: TourChoiceCounts
  has_pending_change: boolean
  has_vendor_pending: boolean
  tickets: AntelopeCanyonTicketLite[]
}

export type AntelopeCanyonCancelDueTourRow = {
  id: string
  tour_id: string
  tour_date: string
  product_name: string
  /** 당일 합산 시 같은 날 투어 개수 */
  day_tour_count?: number
  check_in_date: string
  cancel_due_date: string
  tour_people: number
  ticket_ea: number
  ticket_ea_current: number
  cancel_from: number
  cancel_to: number
  has_pending_change: boolean
  has_vendor_pending: boolean
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

  return reservations.reduce((sum, r) => {
    if (String(r.product_id) !== String(productId)) return sum
    const rd = r.tour_date ? String(r.tour_date).trim().slice(0, 10) : ''
    if (rd !== tourDate) return sum
    if (isReservationCancelledStatus(r.status)) return sum
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

function tourHasVendorPendingTickets(tickets: AntelopeCanyonTicketLite[]): boolean {
  return tickets.some(isTicketBookingPendingRequestState)
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function tourYmd(tour: AntelopeCanyonTourLite): string {
  return String(tour.tour_date || '').trim().slice(0, 10)
}

function ticketCheckInYmd(ticket: AntelopeCanyonTicketLite): string {
  return String(ticket.check_in_date || '').trim().slice(0, 10)
}

function isActiveTicketBookingTour(tour: AntelopeCanyonTourLite): boolean {
  return !isTourDeleted(tour.tour_status) && !isTourCancelled(tour.tour_status)
}

/** 입장권 달력(투어 N명 / 예약 M개)과 동일: 현재 ea·변경·대기 포함 */
function hasTicketHeadcountMismatchSignals(
  tourPeople: number,
  ticketEaCurrent: number,
  ticketEaEffective: number,
  hasPendingChange: boolean,
  hasVendorPending: boolean
): boolean {
  if (hasPendingChange || hasVendorPending) return true
  if (tourPeople !== ticketEaCurrent) return true
  if (tourPeople !== ticketEaEffective) return true
  return false
}

function ticketCountsForMismatchDay(
  ticket: AntelopeCanyonTicketLite,
  toursById: Map<string, AntelopeCanyonTourLite>
): boolean {
  if (isAntelopeCanyonTicketBooking(ticket)) return true
  const tourId = String(ticket.tour_id || '').trim()
  if (!tourId) return false
  const tour = toursById.get(tourId)
  return tour != null && tourProductRequiresTicketBookingCount(tour)
}

/**
 * 일별 합계(day::YYYY-MM-DD)에 넣을 티켓.
 * check_in 날짜만 맞추면 1박2일 등 다른 출발일 투어 티켓이 당일 밤도깨비에 섞이므로,
 * tour_id가 있으면 연결된 투어의 tour_date가 그날인 경우만 포함한다.
 * 미연결 티켓은 check_in 날짜 기준으로 계속 포함한다.
 */
function ticketBelongsToDayMismatchAggregation(
  ticket: AntelopeCanyonTicketLite,
  date: string,
  toursById: Map<string, AntelopeCanyonTourLite>
): boolean {
  if (ticketCheckInYmd(ticket) !== date) return false
  if (!ticketCountsForMismatchDay(ticket, toursById)) return false
  const tourId = String(ticket.tour_id || '').trim()
  if (!tourId) return true
  const linkedTour = toursById.get(tourId)
  if (!linkedTour) return false
  return tourYmd(linkedTour) === date
}

function dayMismatchProductLabel(toursOnDay: AntelopeCanyonTourLite[]): string {
  if (toursOnDay.length === 1) return productDisplayName(toursOnDay[0]!)
  const names = [...new Set(toursOnDay.map((t) => productDisplayName(t)))]
  if (names.length <= 2) return names.join(' · ')
  return `${names[0]} · +${names.length - 1}`
}

function collectYmdRange(start: string, end: string): string[] {
  const out: string[] = []
  let cursor = start
  while (cursor <= end) {
    out.push(cursor)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return out
}

function perTourRowsAlreadyExplainDayMismatch(
  date: string,
  tourPeople: number,
  ticketEaCurrent: number,
  existingRows: AntelopeCanyonMismatchTourRow[]
): boolean {
  const onDate = existingRows.filter(
    (row) => String(row.tour_date || '').trim().slice(0, 10) === date
  )
  if (!onDate.length) return false
  const accountedPeople = onDate.reduce((sum, row) => sum + row.tour_people, 0)
  const accountedEa = onDate.reduce((sum, row) => sum + row.ticket_ea_current, 0)
  return accountedPeople === tourPeople && accountedEa === ticketEaCurrent
}

export function buildAntelopeCanyonMismatchRows(input: {
  tours: AntelopeCanyonTourLite[]
  reservations: ReservationLite[]
  ticketBookings: AntelopeCanyonTicketLite[]
  dateStart?: string
  dateEnd?: string
}): AntelopeCanyonMismatchTourRow[] {
  const { tours, reservations, ticketBookings } = input
  const rows: AntelopeCanyonMismatchTourRow[] = []
  const toursById = new Map<string, AntelopeCanyonTourLite>()
  for (const tour of tours) {
    if (!tour?.id) continue
    toursById.set(tour.id, tour)
  }

  const eligibleTours = tours.filter(
    (tour) => isActiveTicketBookingTour(tour) && tourProductRequiresTicketBookingCount(tour)
  )

  /** 같은 날 투어 2개+ → 일별 합산 비교 (공유 RN 일괄 구매 대응) */
  const eligibleByDate = new Map<string, AntelopeCanyonTourLite[]>()
  for (const tour of eligibleTours) {
    const d = tourYmd(tour)
    if (!d) continue
    const list = eligibleByDate.get(d) || []
    list.push(tour)
    eligibleByDate.set(d, list)
  }

  for (const tour of eligibleTours) {
    const date = tourYmd(tour)
    // 같은 날 투어가 여러 개면 투어별 행을 만들지 않고 아래에서 합산
    if ((eligibleByDate.get(date)?.length ?? 0) >= 2) continue

    const tourTickets = ticketsForTour(tour.id, ticketBookings)
    if (!tourTickets.length) continue

    const tourPeople = computeTourAssignedPeople(tour, reservations)
    const ticketEaEffective = sumEffectiveTicketEa(tourTickets)
    const ticketEaCurrent = sumCurrentTicketEa(tourTickets)
    const hasPendingChange = tourHasPendingTicketChange(tourTickets)
    const hasVendorPending = tourHasVendorPendingTickets(tourTickets)
    const ticketCounts = aggregateTicketEaByCanyon(tourTickets)

    if (
      tourPeople <= 0 &&
      ticketEaCurrent <= 0 &&
      ticketEaEffective <= 0 &&
      !hasPendingChange &&
      !hasVendorPending
    ) {
      continue
    }
    if (
      !hasTicketHeadcountMismatchSignals(
        tourPeople,
        ticketEaCurrent,
        ticketEaEffective,
        hasPendingChange,
        hasVendorPending
      )
    ) {
      continue
    }

    rows.push({
      id: tour.id,
      tour_date: tour.tour_date,
      product_name: productDisplayName(tour),
      tour_people: tourPeople,
      ticket_ea: ticketEaEffective,
      ticket_ea_current: ticketEaCurrent,
      ticket_counts: ticketCounts,
      has_pending_change: hasPendingChange,
      has_vendor_pending: hasVendorPending,
      tickets: tourTickets,
    })
  }

  const dateStart = input.dateStart || ''
  const dateEnd = input.dateEnd || ''
  if (dateStart && dateEnd && dateStart <= dateEnd) {
    for (const date of collectYmdRange(dateStart, dateEnd)) {
      const toursStarting = eligibleByDate.get(date) || []
      const multiTourDay = toursStarting.length >= 2
      const tourPeople = toursStarting.reduce(
        (sum, tour) => sum + computeTourAssignedPeople(tour, reservations),
        0
      )

      const dayTickets = activeTickets(ticketBookings).filter((ticket) =>
        ticketBelongsToDayMismatchAggregation(ticket, date, toursById)
      )

      const ticketEaEffective = sumEffectiveTicketEa(dayTickets)
      const ticketEaCurrent = sumCurrentTicketEa(dayTickets)
      const hasPendingChange = tourHasPendingTicketChange(dayTickets)
      const hasVendorPending = tourHasVendorPendingTickets(dayTickets)

      if (
        !hasTicketHeadcountMismatchSignals(
          tourPeople,
          ticketEaCurrent,
          ticketEaEffective,
          hasPendingChange,
          hasVendorPending
        )
      ) {
        continue
      }

      // 단일 투어 날: 이미 투어별 행이 있고 미연결 티켓이 없으면 일별 행 생략
      if (!multiTourDay) {
        if (
          rows.some(
            (row) =>
              !row.id.startsWith('day::') &&
              String(row.tour_date || '').trim().slice(0, 10) === date
          ) &&
          !dayTickets.some((ticket) => !String(ticket.tour_id || '').trim())
        ) {
          continue
        }

        if (perTourRowsAlreadyExplainDayMismatch(date, tourPeople, ticketEaCurrent, rows)) {
          continue
        }
      }

      rows.push({
        id: `day::${date}`,
        tour_date: date,
        product_name: toursStarting.length
          ? dayMismatchProductLabel(toursStarting)
          : date,
        primary_tour_id: toursStarting[0]?.id ?? dayTickets.find((t) => t.tour_id)?.tour_id ?? null,
        ...(multiTourDay ? { day_tour_count: toursStarting.length } : {}),
        tour_people: tourPeople,
        ticket_ea: ticketEaEffective,
        ticket_ea_current: ticketEaCurrent,
        ticket_counts: aggregateTicketEaByCanyon(dayTickets),
        has_pending_change: hasPendingChange,
        has_vendor_pending: hasVendorPending,
        tickets: dayTickets,
      })
    }
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

  const eligibleTours = [...toursById.values()].filter((tour) =>
    tourProductRequiresTicketBookingCount(tour)
  )
  const eligibleByDate = new Map<string, AntelopeCanyonTourLite[]>()
  for (const tour of eligibleTours) {
    const d = tourYmd(tour)
    if (!d) continue
    const list = eligibleByDate.get(d) || []
    list.push(tour)
    eligibleByDate.set(d, list)
  }

  const dueTicketsByCheckIn = new Map<string, AntelopeCanyonTicketLite[]>()

  for (const booking of activeTickets(input.ticketBookings)) {
    const checkIn = String(booking.check_in_date || '').slice(0, 10)
    if (!checkIn) continue

    const supplier = input.supplierProductsByBookingId.get(booking.id)
    const cancelDue = getCancelDueDateForTicketBooking(booking, supplier)
    const isDueToday = cancelDue === today
    const isD2CheckIn = checkIn === d2CheckIn
    if (!isDueToday && !isD2CheckIn) continue

    const list = dueTicketsByCheckIn.get(checkIn) || []
    list.push(booking)
    dueTicketsByCheckIn.set(checkIn, list)
  }

  const rows: AntelopeCanyonCancelDueTourRow[] = []
  const emittedMultiDay = new Set<string>()

  for (const [checkInDate, dueTickets] of dueTicketsByCheckIn) {
    const toursOnDay = eligibleByDate.get(checkInDate) || []
    const multiTourDay = toursOnDay.length >= 2

    if (multiTourDay) {
      if (emittedMultiDay.has(checkInDate)) continue
      emittedMultiDay.add(checkInDate)

      const dayTickets = activeTickets(input.ticketBookings).filter((ticket) =>
        ticketBelongsToDayMismatchAggregation(ticket, checkInDate, toursById)
      )
      const displayTickets = dayTickets.length > 0 ? dayTickets : dueTickets
      const tourPeople = toursOnDay.reduce(
        (sum, tour) => sum + computeTourAssignedPeople(tour, input.reservations),
        0
      )
      const ticketEaEffective = sumEffectiveTicketEa(displayTickets)
      const ticketEaCurrent = sumCurrentTicketEa(displayTickets)
      const hasPendingChange = tourHasPendingTicketChange(displayTickets)
      const hasVendorPending = tourHasVendorPendingTickets(displayTickets)

      const needsCancel = ticketEaEffective > tourPeople
      if (!needsCancel && !hasPendingChange && !hasVendorPending) continue

      const supplier = input.supplierProductsByBookingId.get(dueTickets[0]!.id)
      const cancelDueDate = getCancelDueDateForTicketBooking(dueTickets[0]!, supplier) || today
      const primaryTour = toursOnDay[0]!

      rows.push({
        id: `day::${checkInDate}`,
        tour_id: primaryTour.id,
        tour_date: primaryTour.tour_date,
        product_name: dayMismatchProductLabel(toursOnDay),
        day_tour_count: toursOnDay.length,
        check_in_date: checkInDate,
        cancel_due_date: cancelDueDate,
        tour_people: tourPeople,
        ticket_ea: ticketEaEffective,
        ticket_ea_current: ticketEaCurrent,
        cancel_from: ticketEaEffective,
        cancel_to: tourPeople,
        has_pending_change: hasPendingChange,
        has_vendor_pending: hasVendorPending,
        tickets: displayTickets,
      })
      continue
    }

    // 단일 투어 날: 기존처럼 tour_id별 행
    const grouped = new Map<string, AntelopeCanyonTicketLite[]>()
    for (const booking of dueTickets) {
      const tid = String(booking.tour_id || '').trim()
      if (!tid) continue
      const key = `${tid}::${checkInDate}`
      const list = grouped.get(key) || []
      list.push(booking)
      grouped.set(key, list)
    }

    for (const [key, tourDueTickets] of grouped) {
      const [tourId] = key.split('::')
      const tour = toursById.get(tourId)
      if (!tour) continue

      const tourTickets = ticketsForTour(tourId, input.ticketBookings)
      const displayTickets = tourTickets.length > 0 ? tourTickets : tourDueTickets

      const tourPeople = computeTourAssignedPeople(tour, input.reservations)
      const ticketEaEffective = sumEffectiveTicketEa(displayTickets)
      const ticketEaCurrent = sumCurrentTicketEa(displayTickets)
      const hasPendingChange = tourHasPendingTicketChange(displayTickets)
      const hasVendorPending = tourHasVendorPendingTickets(displayTickets)

      const needsCancel = ticketEaEffective > tourPeople
      if (!needsCancel && !hasPendingChange && !hasVendorPending) continue

      const supplier = input.supplierProductsByBookingId.get(tourDueTickets[0]!.id)
      const cancelDueDate = getCancelDueDateForTicketBooking(tourDueTickets[0]!, supplier) || today

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
        has_vendor_pending: hasVendorPending,
        tickets: displayTickets,
      })
    }
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

export function formatAntelopeCanyonTicketTime(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5)
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
