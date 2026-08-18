'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  antelopeCanyonBookingCancelDueCheckInYmd,
  antelopeCanyonBookingMismatchDateRange,
} from '@/lib/antelopeCanyonBookingTodo'
import {
  buildAntelopeCanyonCancelDueRows,
  buildAntelopeCanyonMismatchRows,
  enrichAntelopeCanyonToursForTourBadge,
  type AntelopeCanyonCancelDueTourRow,
  type AntelopeCanyonMismatchTourRow,
  type AntelopeCanyonTicketLite,
  type AntelopeCanyonTourLite,
  type ReservationLite,
} from '@/lib/antelopeCanyonBookingQueue'
import type { SeasonDate } from '@/lib/ticketBookingCancelDue'
import { loadCalendarChoiceRows } from '@/lib/fetchCanyonChoiceRows'
import { applyDateChangedPlaceholderChoicesToTourCounts } from '@/lib/dateChangedPlaceholderLx'
import { tourChoiceCountsHasDisplayable, type ReservationChoiceRow } from '@/lib/tourChoiceCounts'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'

const TICKET_SELECT =
  'id, tour_id, reservation_id, check_in_date, company, category, time, ea, rn_number, status, booking_status, vendor_status, change_status, pending_ea, pending_time, deletion_requested_at, expense, paid_amount, credit_amount'

const TOUR_SELECT =
  'id, tour_date, product_id, tour_status, reservation_ids, antelope_check_in_date, products(name, name_ko, name_en)'

async function fetchSupplierProductsByBookingIds(
  bookingIds: string[]
): Promise<Map<string, { season_dates: SeasonDate[] | null }>> {
  const out = new Map<string, { season_dates: SeasonDate[] | null }>()
  if (!bookingIds.length) return out

  const BATCH_SIZE = 120
  for (let i = 0; i < bookingIds.length; i += BATCH_SIZE) {
    const batch = bookingIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('supplier_ticket_purchases')
      .select(
        `
        booking_id,
        supplier_products (
          season_dates
        )
      `
      )
      .in('booking_id', batch)
    if (error) {
      console.warn('useAntelopeCanyonBookingQueue supplier_ticket_purchases', error)
      continue
    }
    for (const row of data || []) {
      const bookingId = String((row as { booking_id?: string }).booking_id || '')
      const seasonDates = (
        row as { supplier_products?: { season_dates?: SeasonDate[] | null } | null }
      ).supplier_products?.season_dates
      if (bookingId) out.set(bookingId, { season_dates: seasonDates ?? null })
    }
  }

  return out
}

async function fetchToursByIds(tourIds: string[]): Promise<AntelopeCanyonTourLite[]> {
  const unique = [...new Set(tourIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (!unique.length) return []

  const out: AntelopeCanyonTourLite[] = []
  const BATCH_SIZE = 100
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase.from('tours').select(TOUR_SELECT).in('id', batch)
    if (error) throw error
    out.push(...((data || []) as AntelopeCanyonTourLite[]))
  }
  return out
}

async function fetchChoiceRowsByReservationIds(
  reservationIds: string[],
  reservations: Array<{ id: string; canyon_choice?: string | null; choices?: unknown }>
): Promise<Map<string, ReservationChoiceRow[]>> {
  const unique = [...new Set(reservationIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (!unique.length) return new Map()

  const byId = new Map(reservations.map((r) => [String(r.id).trim(), r]))
  const forLoad = unique.map((id) => {
    const row = byId.get(id)
    return {
      id,
      canyon_choice: row?.canyon_choice ?? null,
      choices: row?.choices,
    }
  })
  const choiceRowsByResId = await loadCalendarChoiceRows(supabase, forLoad)
  for (const id of unique) {
    const list = choiceRowsByResId.get(id)
    if (!list) continue
    const canon = canonicalReservationIdKey(id)
    if (canon !== id && !choiceRowsByResId.has(canon)) {
      choiceRowsByResId.set(canon, list)
    }
  }
  return choiceRowsByResId
}

function mergeTours(
  primary: AntelopeCanyonTourLite[],
  linked: AntelopeCanyonTourLite[]
): AntelopeCanyonTourLite[] {
  const byId = new Map<string, AntelopeCanyonTourLite>()
  for (const tour of [...primary, ...linked]) {
    if (!tour?.id) continue
    if (isTourDeleted(tour.tour_status) || isTourCancelled(tour.tour_status)) continue
    byId.set(tour.id, tour)
  }
  return [...byId.values()].sort((a, b) => a.tour_date.localeCompare(b.tour_date))
}

export function useAntelopeCanyonBookingQueue(enabled = true) {
  const [mismatchRows, setMismatchRows] = useState<AntelopeCanyonMismatchTourRow[]>([])
  const [cancelDueRows, setCancelDueRows] = useState<AntelopeCanyonCancelDueTourRow[]>([])
  const [toursById, setToursById] = useState<Record<string, AntelopeCanyonTourLite>>({})
  const [allTickets, setAllTickets] = useState<AntelopeCanyonTicketLite[]>([])
  const [supplierProductsByBookingId, setSupplierProductsByBookingId] = useState<
    Map<string, { season_dates: SeasonDate[] | null }>
  >(() => new Map())
  const [loading, setLoading] = useState(false)
  const dateRange = useMemo(() => antelopeCanyonBookingMismatchDateRange(), [])
  const cancelDueCheckInYmd = useMemo(() => antelopeCanyonBookingCancelDueCheckInYmd(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setMismatchRows([])
      setCancelDueRows([])
      setToursById({})
      setAllTickets([])
      setSupplierProductsByBookingId(new Map())
      return
    }

    setLoading(true)

    try {
      const { start, end } = dateRange

      const [toursRes, ticketRes] = await Promise.all([
        supabase
          .from('tours')
          .select(TOUR_SELECT)
          .gte('tour_date', start)
          .lte('tour_date', end)
          .order('tour_date', { ascending: true }),
        supabase
          .from('ticket_bookings')
          .select(TICKET_SELECT)
          .gte('check_in_date', start)
          .lte('check_in_date', end),
      ])

      if (toursRes.error) throw toursRes.error
      if (ticketRes.error) throw ticketRes.error

      const allTickets = (ticketRes.data || []) as AntelopeCanyonTicketLite[]
      const linkedTourIds = [
        ...new Set(allTickets.map((t) => String(t.tour_id || '').trim()).filter(Boolean)),
      ]
      const linkedTours = await fetchToursByIds(linkedTourIds)
      const tours = mergeTours((toursRes.data || []) as AntelopeCanyonTourLite[], linkedTours)

      const tourDates = [...new Set(tours.map((t) => String(t.tour_date || '').slice(0, 10)).filter(Boolean))]
      const reservationDateStart = tourDates.length
        ? tourDates.reduce((min, d) => (d < min ? d : min), tourDates[0]!)
        : start
      const reservationDateEnd = tourDates.length
        ? tourDates.reduce((max, d) => (d > max ? d : max), tourDates[0]!)
        : end

      const { data: reservationsData, error: reservationsErr } = await supabase
        .from('reservations')
        .select('id, tour_date, product_id, status, total_people, canyon_choice, choices')
        .gte('tour_date', reservationDateStart)
        .lte('tour_date', reservationDateEnd)

      if (reservationsErr) throw reservationsErr

      const reservations = (reservationsData || []) as ReservationLite[]

      const ticketReservationIds = [
        ...new Set(
          allTickets
            .map((t) => String(t.reservation_id || '').trim())
            .filter(Boolean)
        ),
      ]
      const knownResIds = new Set(reservations.map((r) => String(r.id || '').trim()).filter(Boolean))
      const missingTicketResIds = ticketReservationIds.filter((id) => !knownResIds.has(id))
      if (missingTicketResIds.length > 0) {
        const extra: ReservationLite[] = []
        const BATCH = 100
        for (let i = 0; i < missingTicketResIds.length; i += BATCH) {
          const chunk = missingTicketResIds.slice(i, i + BATCH)
          const { data: extraRows, error: extraErr } = await supabase
            .from('reservations')
            .select('id, tour_date, product_id, status, total_people, canyon_choice, choices')
            .in('id', chunk)
          if (extraErr) throw extraErr
          extra.push(...((extraRows || []) as ReservationLite[]))
        }
        reservations.push(...extra)
      }

      const resById = new Map<string, ReservationLite>()
      for (const r of reservations) {
        const id = String(r.id || '').trim()
        if (!id) continue
        resById.set(id, r)
        const canon = canonicalReservationIdKey(id)
        if (canon !== id) resById.set(canon, r)
      }
      const assignedResIds: string[] = []
      for (const tour of tours) {
        for (const rid of normalizeReservationIds(tour.reservation_ids)) {
          assignedResIds.push(rid)
          const matched = resById.get(rid) || resById.get(canonicalReservationIdKey(rid))
          if (matched?.id) assignedResIds.push(matched.id)
        }
      }
      assignedResIds.push(...ticketReservationIds)
      const choiceRowsByResId = await fetchChoiceRowsByReservationIds(assignedResIds, reservations)
      const enrichedTours = enrichAntelopeCanyonToursForTourBadge(
        tours,
        reservations,
        choiceRowsByResId
      )
      const tourChoiceCountsByTourId = new Map(
        enrichedTours.map((tour) => [tour.id, tour.choice_counts || {}])
      )
      applyDateChangedPlaceholderChoicesToTourCounts({
        tourChoiceCountsByTourId,
        bookings: allTickets,
        placeholders: reservations,
        choiceRowsByResId,
      })
      const toursWithPlaceholderLx = enrichedTours.map((tour) => {
        const counts = tourChoiceCountsByTourId.get(tour.id) || {}
        return tourChoiceCountsHasDisplayable(counts)
          ? { ...tour, choice_counts: counts }
          : tour
      })

      const supplierMap = await fetchSupplierProductsByBookingIds(allTickets.map((t) => t.id))
      setSupplierProductsByBookingId(supplierMap)

      const byId: Record<string, AntelopeCanyonTourLite> = {}
      for (const tour of toursWithPlaceholderLx) {
        if (tour?.id) byId[tour.id] = tour
      }
      setToursById(byId)
      setAllTickets(filterTicketBookingsExcludedFromMainUi(allTickets))

      setMismatchRows(
        buildAntelopeCanyonMismatchRows({
          tours: toursWithPlaceholderLx,
          reservations,
          ticketBookings: allTickets,
          dateStart: start,
          dateEnd: end,
        })
      )

      setCancelDueRows(
        buildAntelopeCanyonCancelDueRows({
          tours: toursWithPlaceholderLx,
          reservations,
          ticketBookings: allTickets,
          supplierProductsByBookingId: supplierMap,
        })
      )
    } catch (e) {
      console.error('useAntelopeCanyonBookingQueue', e)
      setMismatchRows([])
      setCancelDueRows([])
      setToursById({})
      setAllTickets([])
      setSupplierProductsByBookingId(new Map())
    } finally {
      setLoading(false)
    }
  }, [cancelDueCheckInYmd, dateRange, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    mismatchRows,
    cancelDueRows,
    toursById,
    allTickets,
    supplierProductsByBookingId,
    loading,
    reload,
    dateRange,
    cancelDueCheckInYmd,
  }
}
