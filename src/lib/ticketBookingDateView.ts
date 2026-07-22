/** 입장권 테이블 — 날짜별 투어·티켓 L/X 대조 */

import { formatTicketBookingTourHeadline } from '@/lib/ticket-booking-tour-display'
import {
  isCanyonTourChoiceKey,
  choiceLabelToTourCountKey,
  tourChoiceCountsDisplayKeys,
  aggregateTourChoiceCounts,
  type TourChoiceCounts,
  type TourChoiceCountKey,
  type ReservationChoiceRow,
} from '@/lib/tourChoiceCounts'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export type { TourChoiceCounts }

export function isTicketBookingEaCountingStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase()
  return s !== 'cancelled' && s !== 'canceled'
}

function isSeeCanyonSupplier(company: string | null | undefined): boolean {
  const k = (company || '').trim().toLowerCase().replace(/\s+/g, ' ')
  return k === 'see canyon' || k.includes('see canyon') || k.includes('dixie')
}

/** 티켓 부킹 company·category → X / L / U (캐년 입장권만) */
export function ticketBookingCanyonKeyFromBooking(booking: {
  company?: string | null
  category?: string | null
}): TourChoiceCountKey | null {
  const cat = (booking.category || '').trim()
  const co = (booking.company || '').trim()
  const combined = `${cat} ${co}`.trim()

  if (/antelope\s*x/i.test(cat) || /antelope\s*x/i.test(co) || /\bx\s*canyon/i.test(combined)) {
    return 'X'
  }
  if (isSeeCanyonSupplier(co) || /lower\s*antelope/i.test(combined) || /\blower\b/i.test(cat)) {
    return 'L'
  }

  for (const part of [cat, co, combined]) {
    if (!part) continue
    const key = choiceLabelToTourCountKey(null, part, null)
    if (isCanyonTourChoiceKey(key)) return key
  }
  return null
}

export function aggregateTicketEaByCanyon(
  bookings: Array<{
    ea?: number | null
    company?: string | null
    category?: string | null
    status?: string | null
  }>
): TourChoiceCounts {
  const counts: TourChoiceCounts = {}
  for (const b of bookings) {
    if (!isTicketBookingEaCountingStatus(b.status)) continue
    const key = ticketBookingCanyonKeyFromBooking(b)
    if (!key || !isCanyonTourChoiceKey(key)) continue
    counts[key] = (counts[key] || 0) + (Number(b.ea) || 0)
  }
  return counts
}

export function mergeTourChoiceCounts(...parts: TourChoiceCounts[]): TourChoiceCounts {
  const out: TourChoiceCounts = {}
  for (const c of parts) {
    for (const k of tourChoiceCountsDisplayKeys(c)) {
      out[k] = (out[k] || 0) + (c[k] || 0)
    }
  }
  return out
}

/** 투어 예약 초이스 합 vs 티켓 EA 합 — L·X만 비교 */
export function canyonLxCountsMismatch(
  tourCounts: TourChoiceCounts,
  ticketCounts: TourChoiceCounts
): boolean {
  return (tourCounts.X || 0) !== (ticketCounts.X || 0) || (tourCounts.L || 0) !== (ticketCounts.L || 0)
}

export type DayCanyonReconTotals = {
  reservation: TourChoiceCounts
  ticket: TourChoiceCounts
  /** 해당 캐년 유형의 입장권 부킹 행이 1건이라도 있으면 true (0장이어도) */
  ticketHasEntry: Partial<Record<'L' | 'X', boolean>>
}

function isActiveReservationStatusForCanyon(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'confirmed' || s === 'recruiting'
}

/** Price & Inventory · 스케줄 — 상품·일별 배정 예약 초이스 vs 입장권 EA */
export function buildDayCanyonReconByDate(input: {
  tours: Array<{
    id: string
    tour_date: string
    tour_status?: string | null
    reservation_ids?: string[] | null
    product_id?: string | null
  }>
  reservations: Array<{
    id: string
    tour_date: string
    product_id?: string | null
    total_people?: number | null
    status?: string | null
  }>
  choiceRowsByResId: Map<string, ReservationChoiceRow[]>
  ticketBookings: Array<{
    tour_id?: string | null
    ea?: number | null
    company?: string | null
    category?: string | null
    status?: string | null
  }>
  productId: string
  dates: string[]
}): Record<string, DayCanyonReconTotals> {
  const { tours, reservations, choiceRowsByResId, ticketBookings, productId, dates } = input
  const result: Record<string, DayCanyonReconTotals> = {}

  for (const date of dates) {
    const dateYmd = date.slice(0, 10)
    const dayTours = tours
      .filter((tour) => String(tour.tour_date).slice(0, 10) === dateYmd)
      .filter((tour) => !isTourCancelled(tour.tour_status))
      .filter((tour) => !productId || String(tour.product_id || '') === productId)

    if (dayTours.length === 0) continue

    const dayReservations = reservations.filter(
      (reservation) =>
        String(reservation.tour_date).slice(0, 10) === dateYmd &&
        (!productId || String(reservation.product_id || '') === productId) &&
        isActiveReservationStatusForCanyon(reservation.status)
    )

    const assignedCanon = new Set<string>()
    const tourIds = new Set<string>()
    for (const tour of dayTours) {
      tourIds.add(tour.id)
      for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
        if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
      }
    }

    const assignedResList = dayReservations
      .filter((reservation) => assignedCanon.has(canonicalReservationIdKey(String(reservation.id))))
      .map((reservation) => ({
        id: reservation.id,
        total_people: reservation.total_people ?? null,
      }))

    const reservation = aggregateTourChoiceCounts(assignedResList, choiceRowsByResId)

    const dayTickets = ticketBookings.filter(
      (booking) => booking.tour_id && tourIds.has(booking.tour_id)
    )
    const ticket = aggregateTicketEaByCanyon(dayTickets)
    const ticketHasEntry: Partial<Record<'L' | 'X', boolean>> = {}
    for (const booking of dayTickets) {
      if (!isTicketBookingEaCountingStatus(booking.status)) continue
      const key = ticketBookingCanyonKeyFromBooking(booking)
      if (key === 'L' || key === 'X') ticketHasEntry[key] = true
    }

    const hasDisplayable =
      (reservation.L || 0) > 0 ||
      (reservation.X || 0) > 0 ||
      (ticket.L || 0) > 0 ||
      (ticket.X || 0) > 0 ||
      ticketHasEntry.L ||
      ticketHasEntry.X

    if (hasDisplayable) {
      result[dateYmd] = { reservation, ticket, ticketHasEntry }
    }
  }

  return result
}

export function formatCanyonReconBadges(
  recon: DayCanyonReconTotals | undefined
): Array<{ key: 'L' | 'X'; text: string; mismatch: boolean }> {
  if (!recon) return []
  const keys: Array<'L' | 'X'> = ['L', 'X']
  return keys
    .filter(
      (key) =>
        (recon.reservation[key] || 0) > 0 ||
        (recon.ticket[key] || 0) > 0 ||
        recon.ticketHasEntry[key]
    )
    .map((key) => {
      const resCount = recon.reservation[key] || 0
      const ticketCount = recon.ticket[key] || 0
      const hasTicketEntry = Boolean(recon.ticketHasEntry[key])
      const ticketLabel = hasTicketEntry ? String(ticketCount) : '?'
      const mismatch = hasTicketEntry && resCount !== ticketCount
      return {
        key,
        text: `🏜️ ${key} ${resCount} / ${ticketLabel}`,
        mismatch,
      }
    })
}

export function formatCanyonCountsInline(counts: TourChoiceCounts): string {
  const keys = tourChoiceCountsDisplayKeys(counts)
  if (keys.length === 0) return '—'
  return keys.map((k) => `${k}: ${counts[k]}`).join(' · ')
}

/** 스케줄 디스플레이 달력 — 투어별 🏜️ X/L 예약·입장권 뱃지 (Price & Inventory 형식) */
export function buildTourCanyonDisplayBadges(
  choiceCounts: TourChoiceCounts,
  tourTicketBookings: Array<{
    ea?: number | null
    company?: string | null
    category?: string | null
    status?: string | null
  }>
): Array<{ key: 'X' | 'L' | 'U'; text: string; mismatch: boolean }> {
  const displayOrder: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
  const countingBookings = tourTicketBookings.filter((b) => isTicketBookingEaCountingStatus(b.status))
  const hasAnyTickets = countingBookings.length > 0
  const ticketCounts = aggregateTicketEaByCanyon(countingBookings)
  return displayOrder
    .filter((k) => (choiceCounts[k] || 0) > 0)
    .map((k) => {
      const resCount = choiceCounts[k] || 0
      const ticketCount = ticketCounts[k] || 0
      const ticketLabel = hasAnyTickets ? String(ticketCount) : '?'
      const mismatch = hasAnyTickets && resCount !== ticketCount
      return {
        key: k,
        text: `🏜️ ${k} ${resCount} / ${ticketLabel}`,
        mismatch,
      }
    })
}

/** 스케줄 디스플레이 투어 카드 — 예약 초이스 vs 해당 투어 입장권 EA (🏜️ X : 9 / 13) */
export function formatTourCanyonChoiceCardLine(
  choiceCounts: TourChoiceCounts,
  tourTicketBookings: Array<{
    ea?: number | null
    company?: string | null
    category?: string | null
    status?: string | null
  }>
): string | null {
  const displayOrder: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
  const countingBookings = tourTicketBookings.filter((b) => isTicketBookingEaCountingStatus(b.status))
  const hasAnyTickets = countingBookings.length > 0
  const ticketCounts = aggregateTicketEaByCanyon(countingBookings)
  const parts = displayOrder
    .filter((k) => (choiceCounts[k] || 0) > 0)
    .map((k) => {
      const resCount = choiceCounts[k] || 0
      const ticketCount = ticketCounts[k] || 0
      const suffix = hasAnyTickets ? ` / ${ticketCount}` : ''
      return `🏜️ ${k} : ${resCount}${suffix}`
    })
  return parts.length > 0 ? parts.join(' , ') : null
}

export type TicketDateViewTourRow = {
  tourId: string
  label: string
  choiceCounts: TourChoiceCounts
  totalPeople: number
}

export type TicketDateViewBookingRow = {
  id: string
  ea?: number | null
  company?: string | null
  category?: string | null
  status?: string | null
  tour_id?: string | null
  time?: string | null
  tours?: {
    choice_counts?: TourChoiceCounts
    tour_date?: string | null
    total_people?: number | null
    products?: { name?: string; name_en?: string; name_ko?: string } | null
  }
}

export type TicketDateViewGroup = {
  key: string
  label: string
  dateYmd: string
  rows: TicketDateViewBookingRow[]
  tours: TicketDateViewTourRow[]
  tourChoiceTotals: TourChoiceCounts
  ticketChoiceTotals: TourChoiceCounts
  hasMismatch: boolean
  unlinkedTicketCount: number
}

type TourEventLike = {
  id: string
  tour_date: string
  total_people?: number
  products?: { name?: string; name_en?: string; name_ko?: string }
}

export function buildTicketDateViewGroups(
  bookings: TicketDateViewBookingRow[],
  tourEvents: TourEventLike[],
  locale: string,
  tourFallback: string,
  opts: {
    bookingCheckInYmd: (b: TicketDateViewBookingRow) => string
    tourOverlapsDate: (tour: TourEventLike, dateYmd: string) => boolean
    getProductName: (products: TourEventLike['products']) => string
  }
): TicketDateViewGroup[] {
  const byDate = new Map<string, TicketDateViewBookingRow[]>()
  for (const b of bookings) {
    const d = opts.bookingCheckInYmd(b)
    if (!d) continue
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(b)
  }

  const choiceByTourId = new Map<string, TourChoiceCounts>()
  const tourHeadlineById = new Map<string, string>()
  for (const b of bookings) {
    const tid = b.tour_id?.trim()
    if (!tid || !b.tours) continue
    if (b.tours.choice_counts) choiceByTourId.set(tid, b.tours.choice_counts)
    const headline = formatTicketBookingTourHeadline(locale, b.tours, tourFallback, {
      appendPeople: true,
    })
    if (headline) tourHeadlineById.set(tid, headline)
  }

  const dates = [...byDate.keys()].sort()
  return dates.map((dateYmd) => {
    const rows = [...(byDate.get(dateYmd) || [])].sort((a, b) => {
      const ta = String(a.time || '')
      const tb = String(b.time || '')
      return ta.localeCompare(tb) || String(a.id).localeCompare(String(b.id))
    })

    const ticketChoiceTotals = aggregateTicketEaByCanyon(rows)
    const unlinkedTicketCount = rows.filter((b) => !b.tour_id?.trim()).length

    const tourMap = new Map<string, TicketDateViewTourRow>()
    for (const tr of tourEvents) {
      if (!opts.tourOverlapsDate(tr, dateYmd)) continue
      const tid = String(tr.id)
      const label =
        tourHeadlineById.get(tid) ||
        `${opts.getProductName(tr.products)} ${tr.total_people ?? 0}${locale.startsWith('ko') ? '명' : ''}`
      tourMap.set(tid, {
        tourId: tid,
        label,
        choiceCounts: choiceByTourId.get(tid) || {},
        totalPeople: Number(tr.total_people) || 0,
      })
    }
    for (const b of rows) {
      const tid = b.tour_id?.trim()
      if (!tid || tourMap.has(tid)) continue
      const label =
        tourHeadlineById.get(tid) ||
        formatTicketBookingTourHeadline(locale, b.tours, tourFallback, { appendPeople: true }) ||
        tid
      tourMap.set(tid, {
        tourId: tid,
        label,
        choiceCounts: b.tours?.choice_counts || {},
        totalPeople: Number(b.tours?.total_people) || 0,
      })
    }

    const tours = [...tourMap.values()].sort((a, b) => a.label.localeCompare(b.label, locale))
    const tourChoiceTotals = mergeTourChoiceCounts(...tours.map((t) => t.choiceCounts))
    const hasMismatch = canyonLxCountsMismatch(tourChoiceTotals, ticketChoiceTotals)

    return {
      key: dateYmd,
      label: dateYmd,
      dateYmd,
      rows,
      tours,
      tourChoiceTotals,
      ticketChoiceTotals,
      hasMismatch,
      unlinkedTicketCount,
    }
  })
}
