import dayjs from 'dayjs'
import { reservationToScheduleBucket } from '@/lib/scheduleGuideLanguageMatch'
import type { ScheduleGuideScheduleRow, ScheduleMonthDayCell } from '@/lib/scheduleGuideGridTypes'
import {
  canonicalScheduleProductId,
  type ScheduleProductRef,
  expandScheduleRowProductIds,
  getScheduleAirportMemberIdSetForRowKey,
  getScheduleAirportPickupDisplayName,
  getScheduleAirportSendingDisplayName,
  getScheduleColorRowKeyForProductId,
  getScheduleProductColorForProductId,
  isScheduleAirportGroupedRowKey,
  isScheduleAirportPickupRowKey,
  isScheduleAirportSendingRowKey,
} from '@/lib/scheduleAirportPickDropGroup'
import {
  expandMiscTourStoredProductIds,
  getScheduleMiscTourDisplayName,
  isScheduleMiscTourRowKey,
} from '@/lib/scheduleMiscTourGroup'
import type { ScheduleProductGridDailyCell, ScheduleProductGridProductRow } from '@/lib/scheduleProductGridHelpers'
import type { ScheduleProductDayTotal } from '@/lib/scheduleProductGridHelpers'
import type { ScheduleGuideDayTotal } from '@/lib/scheduleGuideGridTypes'
import {
  addDaysToYmd,
  canonicalReservationIdKey,
  isReservationCancelledStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
import { dedupeAutoAssignReservations, type AutoAssignPreviewData } from '@/lib/schedule/autoAssignScheduleInput'

type TourLike = AutoAssignPreviewData['sourceTours'][number] & {
  tour_status?: string | null
  reservation_ids?: unknown
  max_participants?: number | null
}

type ReservationLike = AutoAssignPreviewData['sourceReservations'][number] & {
  product_id?: string | null
  tour_date?: string | null
  total_people?: number | null
}

type TeamLike = {
  email?: string | null
  nick_name?: string | null
  name_ko?: string | null
  position?: string | null
}

type ProductLike = {
  id?: string | null
  name?: string | null
  name_ko?: string | null
}

export type AutoAssignPreviewGridModel = {
  monthDays: ScheduleMonthDayCell[]
  monthDaysCore: ScheduleMonthDayCell[]
  monthDaysCoreDateStrings: string[]
  dayColumnWidthCalc: string
  dynamicMinTableWidthPx: number
  tours: TourLike[]
  reservations: ReservationLike[]
  guideScheduleData: Record<string, ScheduleGuideScheduleRow>
  productScheduleData: Record<string, ScheduleProductGridProductRow>
  productTotals: Record<string, ScheduleProductDayTotal>
  guideTotals: Record<string, ScheduleGuideDayTotal>
  selectedProducts: string[]
  selectedTeamMembers: string[]
  firstDay: dayjs.Dayjs
  lastDay: dayjs.Dayjs
}

function ymd(value: unknown): string {
  return String(value || '').slice(0, 10)
}

function weekday(date: string): string {
  const labels = ['일', '월', '화', '수', '목', '금', '토']
  const parsed = dayjs(date)
  return labels[parsed.isValid() ? parsed.day() : 0] || ''
}

export function overlayAutoAssignScheduleTours<T extends { id?: string | null; tour_date?: string | null }>(
  tours: T[],
  assignments: AutoAssignPreviewData['result']['assignmentsByTourId'],
  assignStart: string,
  assignEnd: string,
): T[] {
  return tours.map((tour) => {
    const id = String(tour.id || '')
    const date = ymd(tour.tour_date)
    const next = assignments[id]
    if (!next || !date || date < assignStart || date > assignEnd) return tour
    return {
      ...tour,
      tour_guide_id: next.tour_guide_id,
      assistant_id: next.assistant_id,
    }
  })
}

function productLabel(product: ProductLike | undefined, fallbackId: string): string {
  return String(product?.name_ko || product?.name || '').trim() || fallbackId
}

function emptyCell(): ScheduleProductGridDailyCell {
  return {
    totalPeople: 0,
    waitingPeople: 0,
    koPeople: 0,
    enPeople: 0,
    jaPeople: 0,
    koWaitingPeople: 0,
    enWaitingPeople: 0,
    jaWaitingPeople: 0,
    reservationGroupCount: 0,
    waitingReservationGroupCount: 0,
    privateTourPeople: 0,
    companionTourPeople: 0,
    guideLanguageMismatches: [],
    choiceCounts: {},
    tourCapacityBreakdown: null,
  }
}

export function buildAutoAssignPreviewGridModel(args: {
  preview: AutoAssignPreviewData
  teamMembers: TeamLike[]
  products: ProductLike[]
  selectedProducts: string[]
  miscTourProductIds: string[]
  productColors: Record<string, string>
  defaultPresetIds: string[]
  airportPickupMemberIdSet: Set<string>
  airportSendingMemberIdSet: Set<string>
  getMultiDayTourDays: (productId: string) => number
}): AutoAssignPreviewGridModel {
  const assignStart = args.preview.dates[0] || ''
  const assignEnd = args.preview.dates[args.preview.dates.length - 1] || assignStart
  const contextDates = args.preview.contextDates
  const displayDates = [...contextDates, ...args.preview.dates]
  const monthDays: ScheduleMonthDayCell[] = displayDates.map((dateString) => ({
    date: Number(dateString.slice(8, 10)) || 0,
    dateString,
    dayOfWeek: weekday(dateString),
    isEdgePadding: Boolean(assignStart) && dateString < assignStart,
  }))
  const monthDaysCore = monthDays.filter((day) => !day.isEdgePadding)
  const firstDate = displayDates[0] || assignStart
  const lastDate = displayDates[displayDates.length - 1] || assignEnd
  const lookback = firstDate ? addDaysToYmd(firstDate, -3) : firstDate
  const tours = overlayAutoAssignScheduleTours(
    args.preview.sourceTours,
    args.preview.result.assignmentsByTourId,
    assignStart,
    assignEnd,
  ).filter((tour) => {
    const date = ymd(tour.tour_date)
    return Boolean(date) && date >= lookback && date <= lastDate
  })
  const displayDateSet = new Set(displayDates)
  const sourceReservations = dedupeAutoAssignReservations(args.preview.sourceReservations)
  const reservationsById = new Map<string, ReservationLike>()
  for (const reservation of sourceReservations) {
    const key = canonicalReservationIdKey(String(reservation.id || ''))
    if (key) reservationsById.set(key, reservation as ReservationLike)
  }
  const guestCountByTourId = new Map<string, number>()
  for (const tour of args.preview.sourceTours) {
    const id = String(tour.id || '')
    if (!id) continue
    let people = 0
    for (const reservationId of normalizeReservationIds(tour.reservation_ids)) {
      const reservation = reservationsById.get(canonicalReservationIdKey(reservationId))
      if (!reservation || isReservationCancelledStatus(reservation.status)) continue
      people += Number(reservation.total_people) || 0
    }
    guestCountByTourId.set(id, people)
  }
  const reservations = sourceReservations.filter((reservation) =>
    displayDateSet.has(ymd((reservation as ReservationLike).tour_date)),
  )

  const customerLang = new Map<string, string | null>()
  for (const customer of args.preview.customers) {
    if (customer.id) customerLang.set(String(customer.id), customer.language ?? null)
  }
  const teamByEmail = new Map<string, TeamLike>()
  for (const member of args.teamMembers) {
    const email = String(member.email || '').trim()
    if (email) teamByEmail.set(email, member)
  }
  const products = args.products as ScheduleProductRef[]
  const productsById = new Map<string, ProductLike>()
  for (const product of args.products) {
    if (product.id) productsById.set(String(product.id), product)
  }

  const selectedTeamMembers = args.preview.guides.map((guide) => guide.email)
  const guideScheduleData: Record<string, ScheduleGuideScheduleRow> = {}
  const guideTotals: Record<string, ScheduleGuideDayTotal> = {}
  for (const date of displayDates) guideTotals[date] = { assignedPeople: 0 }

  for (const teamMemberId of selectedTeamMembers) {
    const member = teamByEmail.get(teamMemberId)
    const dailyData: ScheduleGuideScheduleRow['dailyData'] = {}
    let totalAssignedPeople = 0
    let totalTours = 0
    const memberTours = tours.filter((tour) => {
      const guideId = String(tour.tour_guide_id || '').trim()
      const assistantId = String(tour.assistant_id || '').trim()
      return guideId === teamMemberId || assistantId === teamMemberId
    })
    for (const day of monthDays) {
      const dayTours = memberTours.filter((tour) => ymd(tour.tour_date) === day.dateString)
      if (dayTours.length === 0) continue
      const isGuide = dayTours.some((tour) => String(tour.tour_guide_id || '').trim() === teamMemberId)
      const role = isGuide ? 'guide' : 'assistant'
      let guideInitials: string | null = null
      if (!isGuide) {
        const guideEmail = String(dayTours.find((tour) => String(tour.assistant_id || '').trim() === teamMemberId)?.tour_guide_id || '')
        const guide = teamByEmail.get(guideEmail)
        const guideName = guide?.nick_name || guide?.name_ko || ''
        if (guideName) guideInitials = guideName.split('').map((char) => char.charAt(0)).join('').slice(0, 2)
      }
      const multiDayTour = dayTours.find((tour) => args.getMultiDayTourDays(String(tour.product_id || '')) > 1)
      const span = multiDayTour ? args.getMultiDayTourDays(String(multiDayTour.product_id || '')) : 1
      const end = dayjs(day.dateString).add(Math.max(span, 1) - 1, 'day')
      const lastDay = dayjs(lastDate)
      const extendsToNextMonth = end.isAfter(lastDay, 'day')
      const visibleSpan = extendsToNextMonth ? Math.max(1, lastDay.diff(dayjs(day.dateString), 'day') + 1) : span
      const colorTour = multiDayTour || dayTours[0]
      const colorKey = getScheduleColorRowKeyForProductId(
        String(colorTour?.product_id || ''),
        args.airportPickupMemberIdSet,
        args.airportSendingMemberIdSet,
      )
      const assignedPeople = dayTours.reduce(
        (sum, tour) => sum + (guestCountByTourId.get(String(tour.id || '')) || 0),
        0,
      )
      dailyData[day.dateString] = {
        totalPeople: 0,
        assignedPeople,
        tours: dayTours.length,
        productColors: colorKey
          ? {
              [colorKey]: getScheduleProductColorForProductId(
                String(colorTour?.product_id || ''),
                args.productColors,
                products,
                args.defaultPresetIds,
                args.airportPickupMemberIdSet,
                args.airportSendingMemberIdSet,
              ),
            }
          : {},
        role,
        guideInitials,
        isMultiDay: Boolean(multiDayTour),
        multiDayDays: multiDayTour ? visibleSpan : 1,
        extendsToNextMonth,
      }
      if (!day.isEdgePadding) {
        totalTours += dayTours.length
        totalAssignedPeople += dayTours.length
      }
      guideTotals[day.dateString].assignedPeople += dayTours.length
    }
    guideScheduleData[teamMemberId] = {
      team_member_name: member?.nick_name || member?.name_ko || teamMemberId,
      position: member?.position || '',
      dailyData,
      totalPeople: 0,
      totalAssignedPeople,
      totalTours,
    }
  }

  const rowKeys = args.selectedProducts.length > 0 ? args.selectedProducts : []
  const productScheduleData: Record<string, ScheduleProductGridProductRow> = {}
  const productTotals: Record<string, ScheduleProductDayTotal> = {}
  for (const date of displayDates) productTotals[date] = { totalPeople: 0, waitingPeople: 0 }

  for (const rowKey of rowKeys) {
    const memberProductIds = isScheduleAirportGroupedRowKey(rowKey)
      ? [...getScheduleAirportMemberIdSetForRowKey(rowKey, products, args.airportPickupMemberIdSet, args.airportSendingMemberIdSet)]
      : isScheduleMiscTourRowKey(rowKey)
        ? expandMiscTourStoredProductIds(args.miscTourProductIds, products)
        : expandScheduleRowProductIds(rowKey, products)
    if (memberProductIds.length === 0) continue
    const memberIdSet = new Set(memberProductIds.map((id) => canonicalScheduleProductId(id)))
    const product = isScheduleAirportPickupRowKey(rowKey)
      ? { name: getScheduleAirportPickupDisplayName(products, rowKey) }
      : isScheduleAirportSendingRowKey(rowKey)
        ? { name: getScheduleAirportSendingDisplayName(products, rowKey) }
        : isScheduleMiscTourRowKey(rowKey)
          ? { name: getScheduleMiscTourDisplayName() }
          : productsById.get(rowKey)
    const dailyData: Record<string, ScheduleProductGridDailyCell> = {}
    let totalPeople = 0
    let totalTours = 0
    for (const day of monthDays) {
      const dayReservations = reservations.filter((reservation) => {
        const typed = reservation as ReservationLike
        return memberIdSet.has(canonicalScheduleProductId(typed.product_id)) && ymd(typed.tour_date) === day.dateString
      })
      const active = dayReservations.filter((reservation) => {
        const status = String(reservation.status || '').toLowerCase()
        return status === 'confirmed' || status === 'recruiting'
      })
      const waiting = dayReservations.filter((reservation) => String(reservation.status || '').toLowerCase() === 'pending')
      const peopleOf = (rows: ReservationLike[], bucket?: 'ko' | 'ja' | 'en') =>
        rows.reduce((sum, reservation) => {
          if (!bucket) return sum + (reservation.total_people || 0)
          const lang = reservationToScheduleBucket(
            reservation.tour_language,
            customerLang.get(String(reservation.customer_id || '')),
          )
          return sum + (lang === bucket ? reservation.total_people || 0 : 0)
        }, 0)
      const confirmed = peopleOf(active)
      const waitingPeople = peopleOf(waiting)
      const dayTourCount = tours.filter(
        (tour) => memberIdSet.has(canonicalScheduleProductId(String(tour.product_id || ''))) && ymd(tour.tour_date) === day.dateString,
      ).length
      if (confirmed === 0 && waitingPeople === 0 && dayTourCount === 0) continue
      const ko = peopleOf(active, 'ko')
      const ja = peopleOf(active, 'ja')
      const cell = emptyCell()
      cell.totalPeople = confirmed
      cell.waitingPeople = waitingPeople
      cell.companionTourPeople = confirmed
      cell.koPeople = ko
      cell.jaPeople = ja
      cell.enPeople = Math.max(confirmed - ko - ja, 0)
      cell.koWaitingPeople = peopleOf(waiting, 'ko')
      cell.jaWaitingPeople = peopleOf(waiting, 'ja')
      cell.enWaitingPeople = Math.max(waitingPeople - (cell.koWaitingPeople || 0) - (cell.jaWaitingPeople || 0), 0)
      cell.reservationGroupCount = active.length
      cell.waitingReservationGroupCount = waiting.length
      dailyData[day.dateString] = cell
      productTotals[day.dateString].totalPeople += confirmed
      productTotals[day.dateString].waitingPeople = (productTotals[day.dateString].waitingPeople || 0) + waitingPeople
      if (!day.isEdgePadding) {
        totalPeople += confirmed
        totalTours += dayTourCount
      }
    }
    productScheduleData[rowKey] = {
      product_name: productLabel(product, rowKey),
      dailyData,
      totalPeople,
      totalTours,
    }
  }

  const fixedSideColumnsPx = 176
  return {
    monthDays,
    monthDaysCore,
    monthDaysCoreDateStrings: monthDaysCore.map((day) => day.dateString),
    dayColumnWidthCalc: `calc((100% - ${fixedSideColumnsPx}px) / ${Math.max(monthDays.length, 1)})`,
    dynamicMinTableWidthPx: fixedSideColumnsPx,
    tours,
    reservations,
    guideScheduleData,
    productScheduleData,
    productTotals,
    guideTotals,
    selectedProducts: Object.keys(productScheduleData),
    selectedTeamMembers,
    firstDay: dayjs(firstDate || undefined),
    lastDay: dayjs(lastDate || undefined),
  }
}
