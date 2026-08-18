/** 입장권 테이블 — 날짜별 투어·티켓 L/X 대조 */

import { formatTicketBookingTourHeadline } from '@/lib/ticket-booking-tour-display'
import { getTicketBookingEffectiveQty } from '@/lib/ticketBookingDisplay'
import { normalizeTicketBookingTourIds } from '@/lib/ticketBookingTourIds'
import {
  isCanyonTourChoiceKey,
  choiceLabelToTourCountKey,
  tourChoiceCountsDisplayKeys,
  tourChoiceCountsHasDisplayable,
  aggregateTourChoiceCounts,
  type TourChoiceCounts,
  type TourChoiceCountKey,
  type ReservationChoiceRow,
} from '@/lib/tourChoiceCounts'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  getMultiDayTourDays,
  resolveAntelopeCheckInDate,
} from '@/lib/scheduleVehicleOilMaintenance'

export type { TourChoiceCounts, ReservationChoiceRow }

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
  const compact = combined.toLowerCase().replace(/\s+/g, '')

  if (
    /antelope\s*x/i.test(cat) ||
    /antelope\s*x/i.test(co) ||
    /\bx\s*canyon/i.test(combined) ||
    compact.includes('antelopex') ||
    /^x$/i.test(cat)
  ) {
    return 'X'
  }
  if (
    isSeeCanyonSupplier(co) ||
    /lower\s*antelope/i.test(combined) ||
    /\blower\b/i.test(cat) ||
    /^l$/i.test(cat)
  ) {
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
    pending_ea?: number | null
    company?: string | null
    category?: string | null
    status?: string | null
    booking_status?: string | null
    change_status?: string | null
  }>
): TourChoiceCounts {
  const counts: TourChoiceCounts = {}
  for (const b of bookings) {
    const qty = getTicketBookingEffectiveQty(b)
    if (!(qty > 0)) continue
    const key = ticketBookingCanyonKeyFromBooking(b)
    if (!key || !isCanyonTourChoiceKey(key)) continue
    counts[key] = (counts[key] || 0) + qty
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

/** Need to Check 대조용 — L/X를 0이어도 항상 표시 */
export function formatCanyonLxPair(counts: TourChoiceCounts): string {
  return `L ${counts.L || 0} · X ${counts.X || 0}`
}

/**
 * 달력 일별 요약 — 투어 초이스 합 vs 입장권 EA 합
 * 예: [{ key:'X', text:'🏜️X 4/4', mismatch:false }, ...]
 */
export function formatDayTourTicketCanyonCompare(
  tourCounts: TourChoiceCounts,
  ticketCounts: TourChoiceCounts
): Array<{ key: 'X' | 'L' | 'U'; text: string; mismatch: boolean }> {
  const keys = Array.from(
    new Set([...tourChoiceCountsDisplayKeys(tourCounts), ...tourChoiceCountsDisplayKeys(ticketCounts)])
  ) as Array<'X' | 'L' | 'U'>
  const order: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
  return order
    .filter((k) => keys.includes(k))
    .map((k) => {
      const tourN = tourCounts[k] || 0
      const ticketN = ticketCounts[k] || 0
      return {
        key: k,
        text: `🏜️${k} ${tourN}/${ticketN}`,
        mismatch: tourN !== ticketN,
      }
    })
}

/** 투어 초이스 vs 입장권 EA — X/L별 실행 업무 (추가 부킹 / 취소) */
export type DayCanyonBookingActionTask = {
  key: 'X' | 'L' | 'U'
  diffEa: number
  kind: 'book_more' | 'cancel'
  text: string
}

export function buildDayCanyonBookingActionTasks(
  tourCounts: TourChoiceCounts,
  ticketCounts: TourChoiceCounts,
  locale = 'ko'
): DayCanyonBookingActionTask[] {
  const isEn = locale.startsWith('en')
  const keys = Array.from(
    new Set([...tourChoiceCountsDisplayKeys(tourCounts), ...tourChoiceCountsDisplayKeys(ticketCounts)])
  ) as Array<'X' | 'L' | 'U'>
  const order: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
  const out: DayCanyonBookingActionTask[] = []
  for (const k of order) {
    if (!keys.includes(k)) continue
    const tourN = tourCounts[k] || 0
    const ticketN = ticketCounts[k] || 0
    if (tourN === ticketN) continue
    if (tourN > ticketN) {
      const diffEa = tourN - ticketN
      out.push({
        key: k,
        diffEa,
        kind: 'book_more',
        text: isEn
          ? `${diffEa} EA more needed`
          : `${diffEa} EA 추가 필요`,
      })
    } else {
      const diffEa = ticketN - tourN
      out.push({
        key: k,
        diffEa,
        kind: 'cancel',
        text: isEn
          ? `${diffEa} EA cancellation needed`
          : `${diffEa} EA 취소 필요`,
      })
    }
  }
  return out
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

export type LinkedLxMismatchTourSnap = {
  tourId: string
  label: string
  choiceCounts: TourChoiceCounts
  totalPeople: number
}

export type LinkedLxMismatchBooking = {
  id: string
  tour_id?: string | null
  tour_ids?: string[] | null
  check_in_date?: string | null
  company?: string | null
  category?: string | null
  rn_number?: string | null
  status?: string | null
  time?: string | null
  ea?: number | null
  pending_ea?: number | null
  booking_status?: string | null
  change_status?: string | null
  vendor_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
  tours?: {
    choice_counts?: TourChoiceCounts
    tour_date?: string | null
    total_people?: number | null
    products?: { name?: string; name_en?: string; name_ko?: string } | null
  } | null
  linked_tours?: Array<{
    tour_id: string
    choice_counts?: TourChoiceCounts
    tour_date?: string | null
    total_people?: number | null
    products?: { name?: string; name_en?: string; name_ko?: string } | null
  }> | null
}

export type LinkedLxMismatchCluster = {
  key: string
  tourChoiceTotals: TourChoiceCounts
  ticketChoiceTotals: TourChoiceCounts
  tours: LinkedLxMismatchTourSnap[]
  bookings: LinkedLxMismatchBooking[]
}

export type LinkedLxMismatchDateGroup = {
  dateYmd: string
  tourChoiceTotals: TourChoiceCounts
  ticketChoiceTotals: TourChoiceCounts
  clusters: LinkedLxMismatchCluster[]
  bookings: LinkedLxMismatchBooking[]
}

function checkInYmdFromBooking(b: LinkedLxMismatchBooking): string {
  const s = String(b.check_in_date || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function isCancelledTicketBooking(b: LinkedLxMismatchBooking): boolean {
  return String(b.status || '').toLowerCase() === 'cancelled'
}

function ufFind(parent: Map<string, string>, x: string): string {
  if (!parent.has(x)) parent.set(x, x)
  const p = parent.get(x)!
  if (p !== x) {
    const r = ufFind(parent, p)
    parent.set(x, r)
    return r
  }
  return x
}

function ufUnion(parent: Map<string, string>, a: string, b: string) {
  const ra = ufFind(parent, a)
  const rb = ufFind(parent, b)
  if (ra !== rb) parent.set(ra, rb)
}

function mergeTourSnap(
  existing: LinkedLxMismatchTourSnap | undefined,
  next: LinkedLxMismatchTourSnap
): LinkedLxMismatchTourSnap {
  if (!existing) return next
  const existingHas = tourChoiceCountsHasDisplayable(existing.choiceCounts)
  const nextHas = tourChoiceCountsHasDisplayable(next.choiceCounts)
  if (!existingHas && nextHas) return next
  if (existing.label.length < next.label.length) {
    return { ...existing, label: next.label, totalPeople: next.totalPeople || existing.totalPeople }
  }
  return existing
}

function tourSnapsFromBooking(
  b: LinkedLxMismatchBooking,
  locale: string,
  tourFallback: string
): LinkedLxMismatchTourSnap[] {
  const ids = normalizeTicketBookingTourIds(b.tour_ids, b.tour_id)
  const byId = new Map<string, LinkedLxMismatchTourSnap>()

  const put = (
    tourId: string,
    tours:
      | {
          choice_counts?: TourChoiceCounts
          tour_date?: string | null
          total_people?: number | null
          products?: { name?: string; name_en?: string; name_ko?: string } | null
        }
      | null
      | undefined
  ) => {
    const headline = tours
      ? formatTicketBookingTourHeadline(locale, tours, tourFallback, { appendPeople: true })
      : null
    const snap: LinkedLxMismatchTourSnap = {
      tourId,
      label: headline || tourId,
      choiceCounts: tours?.choice_counts || {},
      totalPeople: Number(tours?.total_people) || 0,
    }
    byId.set(tourId, mergeTourSnap(byId.get(tourId), snap))
  }

  for (const lt of b.linked_tours || []) {
    if (!lt?.tour_id) continue
    put(lt.tour_id, lt)
  }
  if (ids[0] && b.tours) put(ids[0], b.tours)
  for (const id of ids) {
    if (!byId.has(id)) put(id, null)
  }
  return [...byId.values()]
}

/**
 * 투어가 연결된 입장권만 — 같은 날짜에서 투어↔티켓 연결 묶음(1:N, N:1)끼리
 * L/X 수량을 합산해 비교하고, 불일치 날짜만 반환.
 */
export function buildLinkedLxMismatchDateGroups(
  bookings: LinkedLxMismatchBooking[],
  locale: string,
  tourFallback: string
): LinkedLxMismatchDateGroup[] {
  const byDate = new Map<string, LinkedLxMismatchBooking[]>()
  for (const b of bookings) {
    if (isCancelledTicketBooking(b)) continue
    const ids = normalizeTicketBookingTourIds(b.tour_ids, b.tour_id)
    if (ids.length === 0) continue
    const dateYmd = checkInYmdFromBooking(b)
    if (!dateYmd) continue
    if (!byDate.has(dateYmd)) byDate.set(dateYmd, [])
    byDate.get(dateYmd)!.push(b)
  }

  const dates = [...byDate.keys()].sort()
  const out: LinkedLxMismatchDateGroup[] = []

  for (const dateYmd of dates) {
    const dayBookings = byDate.get(dateYmd) || []
    const parent = new Map<string, string>()
    const snapsByTourId = new Map<string, LinkedLxMismatchTourSnap>()
    const snapsByBookingId = new Map<string, LinkedLxMismatchTourSnap[]>()

    for (const b of dayBookings) {
      const snaps = tourSnapsFromBooking(b, locale, tourFallback)
      snapsByBookingId.set(b.id, snaps)
      const bKey = `b:${b.id}`
      ufFind(parent, bKey)
      for (const snap of snaps) {
        snapsByTourId.set(snap.tourId, mergeTourSnap(snapsByTourId.get(snap.tourId), snap))
        const tKey = `t:${snap.tourId}`
        ufUnion(parent, bKey, tKey)
      }
    }

    const clusterMap = new Map<
      string,
      { bookingIds: Set<string>; tourIds: Set<string> }
    >()
    for (const b of dayBookings) {
      const root = ufFind(parent, `b:${b.id}`)
      let cluster = clusterMap.get(root)
      if (!cluster) {
        cluster = { bookingIds: new Set(), tourIds: new Set() }
        clusterMap.set(root, cluster)
      }
      cluster.bookingIds.add(b.id)
      for (const snap of snapsByBookingId.get(b.id) || []) {
        cluster.tourIds.add(snap.tourId)
      }
    }

    const bookingById = new Map(dayBookings.map((b) => [b.id, b]))
    const mismatchClusters: LinkedLxMismatchCluster[] = []

    for (const [root, cluster] of clusterMap) {
      const clusterBookings = [...cluster.bookingIds]
        .map((id) => bookingById.get(id))
        .filter((b): b is LinkedLxMismatchBooking => Boolean(b))
        .sort((a, b) => {
          const ta = String(a.time || '')
          const tb = String(b.time || '')
          return ta.localeCompare(tb) || String(a.id).localeCompare(String(b.id))
        })
      const tours = [...cluster.tourIds]
        .map((id) => snapsByTourId.get(id))
        .filter((t): t is LinkedLxMismatchTourSnap => Boolean(t))
        .sort((a, b) => a.label.localeCompare(b.label, locale))
      const tourChoiceTotals = mergeTourChoiceCounts(...tours.map((t) => t.choiceCounts))
      const ticketChoiceTotals = aggregateTicketEaByCanyon(clusterBookings)
      if (!canyonLxCountsMismatch(tourChoiceTotals, ticketChoiceTotals)) continue
      mismatchClusters.push({
        key: `${dateYmd}:${root}`,
        tourChoiceTotals,
        ticketChoiceTotals,
        tours,
        bookings: clusterBookings,
      })
    }

    if (mismatchClusters.length === 0) continue

    const bookingsFlat = mismatchClusters.flatMap((c) => c.bookings)
    out.push({
      dateYmd,
      tourChoiceTotals: mergeTourChoiceCounts(...mismatchClusters.map((c) => c.tourChoiceTotals)),
      ticketChoiceTotals: mergeTourChoiceCounts(...mismatchClusters.map((c) => c.ticketChoiceTotals)),
      clusters: mismatchClusters,
      bookings: bookingsFlat,
    })
  }

  return out
}

export function collectLinkedLxMismatchBookingIds(
  groups: LinkedLxMismatchDateGroup[]
): string[] {
  const ids = new Set<string>()
  for (const g of groups) {
    for (const b of g.bookings) ids.add(b.id)
  }
  return [...ids]
}

/** Need to Check L/X — 연결 투어와 같은 날 관련 투어 후보 */
export type NeedCheckTourCatalogRow = {
  id: string
  tour_date: string
  product_id?: string | null
  antelope_check_in_date?: string | null
  tour_status?: string | null
  total_people?: number | null
  choice_counts?: TourChoiceCounts
  products?: { name?: string; name_en?: string; name_ko?: string } | null
}

export type NeedCheckRelatedTourKind = 'linked' | 'same_product' | 'overnight_checkin'

export type NeedCheckRelatedTourRow = LinkedLxMismatchTourSnap & {
  kinds: NeedCheckRelatedTourKind[]
  tourDate?: string | undefined
  antelopeCheckInYmd?: string | undefined
}

function catalogTourYmd(raw: string | null | undefined): string {
  const m = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

function needCheckRelatedTourLabel(
  tour: NeedCheckTourCatalogRow,
  locale: string,
  tourFallback: string
): string {
  return (
    formatTicketBookingTourHeadline(
      locale,
      {
        tour_date: tour.tour_date,
        total_people: tour.total_people,
        products: tour.products,
        choice_counts: tour.choice_counts,
      },
      tourFallback,
      { appendPeople: true }
    ) || tour.id
  )
}

/**
 * L/X 불일치 날짜에 보여줄 투어:
 * 연결됨 + 같은 상품(해당일 출발) + 숙박투어 앤텔롭 체크인일이 같은 투어.
 */
export function collectNeedCheckRelatedTours(opts: {
  dateYmd: string
  linkedTours: LinkedLxMismatchTourSnap[]
  catalog: NeedCheckTourCatalogRow[]
  locale: string
  tourFallback: string
}): NeedCheckRelatedTourRow[] {
  const dateYmd = catalogTourYmd(opts.dateYmd)
  const catalogById = new Map<string, NeedCheckTourCatalogRow>()
  for (const tour of opts.catalog) {
    if (!tour?.id || isTourCancelled(tour.tour_status)) continue
    catalogById.set(tour.id, tour)
  }

  const rows = new Map<string, NeedCheckRelatedTourRow>()

  const upsert = (
    tourId: string,
    kind: NeedCheckRelatedTourKind,
    snap: Omit<NeedCheckRelatedTourRow, 'kinds'>
  ) => {
    const existing = rows.get(tourId)
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind)
      if (!existing.label && snap.label) existing.label = snap.label
      if (
        !tourChoiceCountsHasDisplayable(existing.choiceCounts) &&
        tourChoiceCountsHasDisplayable(snap.choiceCounts)
      ) {
        existing.choiceCounts = snap.choiceCounts
      }
      if (!existing.totalPeople && snap.totalPeople) existing.totalPeople = snap.totalPeople
      if (!existing.tourDate && snap.tourDate) existing.tourDate = snap.tourDate
      if (!existing.antelopeCheckInYmd && snap.antelopeCheckInYmd) {
        existing.antelopeCheckInYmd = snap.antelopeCheckInYmd
      }
      return
    }
    rows.set(tourId, { ...snap, tourId, kinds: [kind] })
  }

  const snapFromCatalog = (tour: NeedCheckTourCatalogRow): Omit<NeedCheckRelatedTourRow, 'kinds'> => ({
    tourId: tour.id,
    label: needCheckRelatedTourLabel(tour, opts.locale, opts.tourFallback),
    choiceCounts: tour.choice_counts || {},
    totalPeople: Number(tour.total_people) || 0,
    tourDate: catalogTourYmd(tour.tour_date),
    antelopeCheckInYmd: resolveAntelopeCheckInDate(tour) || undefined,
  })

  for (const linked of opts.linkedTours) {
    const cat = catalogById.get(linked.tourId)
    upsert(linked.tourId, 'linked', {
      tourId: linked.tourId,
      label: linked.label || (cat ? needCheckRelatedTourLabel(cat, opts.locale, opts.tourFallback) : linked.tourId),
      choiceCounts:
        tourChoiceCountsHasDisplayable(linked.choiceCounts) && linked.choiceCounts
          ? linked.choiceCounts
          : cat?.choice_counts || {},
      totalPeople: linked.totalPeople || Number(cat?.total_people) || 0,
      tourDate: cat ? catalogTourYmd(cat.tour_date) : undefined,
      antelopeCheckInYmd: cat ? resolveAntelopeCheckInDate(cat) || undefined : undefined,
    })
  }

  const productIds = new Set<string>()
  for (const linked of opts.linkedTours) {
    const pid = catalogById.get(linked.tourId)?.product_id?.trim()
    if (pid) productIds.add(pid)
  }

  for (const tour of catalogById.values()) {
    const pid = (tour.product_id || '').trim()
    const tourDate = catalogTourYmd(tour.tour_date)
    const acYmd = resolveAntelopeCheckInDate(tour)
    const overnight = getMultiDayTourDays(pid) > 1
    if (productIds.has(pid) && tourDate === dateYmd) {
      upsert(tour.id, 'same_product', snapFromCatalog(tour))
    }
    if (overnight && acYmd === dateYmd) {
      upsert(tour.id, 'overnight_checkin', snapFromCatalog(tour))
    }
  }

  const kindRank = (kinds: NeedCheckRelatedTourKind[]) => {
    if (kinds.includes('linked')) return 0
    if (kinds.includes('overnight_checkin')) return 1
    return 2
  }

  return [...rows.values()].sort(
    (a, b) => kindRank(a.kinds) - kindRank(b.kinds) || a.label.localeCompare(b.label, opts.locale)
  )
}
