/** 입장권 테이블 — 날짜별 투어·티켓 L/X 대조 */

import { formatTicketBookingTourHeadline } from '@/lib/ticket-booking-tour-display'
import {
  aggregateTourChoiceCounts,
  isCanyonTourChoiceKey,
  choiceLabelToTourCountKey,
  tourChoiceCountsDisplayKeys,
  type TourChoiceCounts,
  type TourChoiceCountKey,
} from '@/lib/tourChoiceCounts'

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

export function formatCanyonCountsInline(counts: TourChoiceCounts): string {
  const keys = tourChoiceCountsDisplayKeys(counts)
  if (keys.length === 0) return '—'
  return keys.map((k) => `${k}: ${counts[k]}`).join(' · ')
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
