'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { tourHotelManagementDateRange } from '@/lib/tourHotelManagementTodo'
import {
  assignedReservationsForTour,
  countBookedTourHotelRooms,
  countCustomerHotelRoomsForTour,
  indexHotelChoicesByReservationId,
  isMultiDayTourProduct,
  requiredTourHotelRoomCount,
  sumCustomerHotelPeopleForTour,
  tourHotelBookingMismatch,
  type TourHotelBookingLite,
  type TourHotelChoiceLite,
  type TourHotelReservationLite,
} from '@/lib/tourHotelBookingCounts'
import { parseTourAssignmentEmails } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

export type TourHotelManagementQueueRow = {
  id: string
  tour_date: string
  product_id: string | null
  product_name: string
  guide_name: string | null
  booked_hotel_count: number
  required_hotel_count: number
  customer_hotel_count: number
  assigned_people: number
  reservation_count: number
}

type TourRow = {
  id: string
  tour_date: string
  product_id?: string | null
  tour_status?: string | null
  tour_guide_id?: string | null
  reservation_ids?: unknown
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

type TeamMember = { email: string; name_ko: string | null; nick_name?: string | null }

type ChoiceOptionEmbed = {
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
  option_key?: string | null
}

type ProductChoiceEmbed = {
  choice_group?: string | null
  choice_group_ko?: string | null
  choice_group_en?: string | null
}

type ReservationChoiceQueryRow = {
  reservation_id?: string | null
  quantity?: number | null
  choice_group?: string | null
  option_key?: string | null
  choice_options?: ChoiceOptionEmbed | ChoiceOptionEmbed[] | null
  product_choices?: ProductChoiceEmbed | ProductChoiceEmbed[] | null
}

function unwrapEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first ? first : null
  }
  return raw
}

function toHotelChoiceLite(row: ReservationChoiceQueryRow): TourHotelChoiceLite | null {
  const reservationId = String(row.reservation_id || '').trim()
  if (!reservationId) return null
  const option = unwrapEmbed(row.choice_options)
  const group = unwrapEmbed(row.product_choices)
  return {
    reservation_id: reservationId,
    quantity: row.quantity ?? null,
    choice_group: group?.choice_group || row.choice_group || null,
    choice_group_ko: group?.choice_group_ko || null,
    choice_group_en: group?.choice_group_en || null,
    option_key: option?.option_key || row.option_key || null,
    option_name: option?.option_name || null,
    option_name_ko: option?.option_name_ko || null,
    option_name_en: option?.option_name_en || null,
  }
}

function teamDisplayName(member: TeamMember | undefined): string | null {
  if (!member) return null
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || null
}

function productDisplayName(tour: TourRow): string {
  const p = tour.products
  return p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || tour.product_id || tour.id
}

export function useTourHotelManagementQueue(enabled = true) {
  const [rows, setRows] = useState<TourHotelManagementQueueRow[]>([])
  const [loading, setLoading] = useState(false)
  const dateRange = useMemo(() => tourHotelManagementDateRange(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      return
    }

    setLoading(true)
    const { start, end } = dateRange

    try {
      const { data: toursData, error: toursErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, product_id, tour_status, tour_guide_id, reservation_ids, products(name, name_ko, name_en)'
        )
        .gte('tour_date', start)
        .lte('tour_date', end)
        .order('tour_date', { ascending: true })
        .order('id', { ascending: true })

      if (toursErr) throw toursErr

      const multiDayTours = ((toursData || []) as TourRow[]).filter(
        (tour) =>
          isMultiDayTourProduct(tour.product_id) &&
          !isTourDeleted(tour.tour_status) &&
          !isTourCancelled(tour.tour_status)
      )

      if (!multiDayTours.length) {
        setRows([])
        return
      }

      const tourIds = multiDayTours.map((t) => t.id)

      const [reservationsRes, hotelBookingsRes] = await Promise.all([
        supabase
          .from('reservations')
          .select(
            'id, tour_date, product_id, status, pickup_hotel, total_people, adults, child, infant, choices'
          )
          .gte('tour_date', start)
          .lte('tour_date', end)
          .in('status', ['confirmed', 'recruiting']),
        supabase
          .from('tour_hotel_bookings')
          .select('tour_id, status, hotel, rooms, deletion_requested_at')
          .in('tour_id', tourIds),
      ])

      if (reservationsRes.error) throw reservationsRes.error
      if (hotelBookingsRes.error) throw hotelBookingsRes.error

      const reservations = (reservationsRes.data || []) as TourHotelReservationLite[]
      const hotelBookings = (hotelBookingsRes.data || []) as TourHotelBookingLite[]

      const reservationIds = reservations.map((r) => r.id).filter(Boolean)
      const hotelChoiceRows: TourHotelChoiceLite[] = []
      const CHOICE_SELECT_WITH_FK =
        'reservation_id, quantity, choice_group, option_key, choice_options!reservation_choices_option_id_fkey(option_name, option_name_ko, option_key), product_choices!reservation_choices_choice_id_fkey(choice_group, choice_group_ko, choice_group_en)'
      const CHOICE_SELECT_PLAIN =
        'reservation_id, quantity, choice_group, option_key, choice_options(option_name, option_name_ko, option_key), product_choices(choice_group, choice_group_ko, choice_group_en)'
      const CHOICE_SELECT_FALLBACK =
        'reservation_id, quantity, choice_group, option_key, choice_options(option_name, option_name_ko, option_key)'
      if (reservationIds.length > 0) {
        const selects = [CHOICE_SELECT_WITH_FK, CHOICE_SELECT_PLAIN, CHOICE_SELECT_FALLBACK]
        let selectIndex = 0
        const BATCH = 250
        for (let i = 0; i < reservationIds.length; i += BATCH) {
          const batchIds = reservationIds.slice(i, i + BATCH)
          let data: ReservationChoiceQueryRow[] | null = null
          let error: { message?: string } | null = null
          while (selectIndex < selects.length) {
            const result = await (supabase as any)
              .from('reservation_choices')
              .select(selects[selectIndex])
              .in('reservation_id', batchIds)
            data = result.data
            error = result.error
            if (!error) break
            selectIndex += 1
          }
          if (error) {
            console.error('useTourHotelManagementQueue choices', error)
            break
          }
          for (const row of data || []) {
            const lite = toHotelChoiceLite(row)
            if (lite) hotelChoiceRows.push(lite)
          }
        }
      }
      const choicesByReservationId = indexHotelChoicesByReservationId(hotelChoiceRows)

      const bookingsByTourId = new Map<string, TourHotelBookingLite[]>()
      for (const booking of hotelBookings) {
        const tid = String(booking.tour_id || '').trim()
        if (!tid) continue
        const list = bookingsByTourId.get(tid) || []
        list.push(booking)
        bookingsByTourId.set(tid, list)
      }

      const guideEmails = [
        ...new Set(
          multiDayTours.flatMap((t) => parseTourAssignmentEmails(t.tour_guide_id)).filter(Boolean)
        ),
      ]

      const teamMap = new Map<string, TeamMember>()
      if (guideEmails.length > 0) {
        const { data: teamMembers } = await supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .in('email', guideEmails)
        for (const member of (teamMembers || []) as TeamMember[]) {
          if (member.email) teamMap.set(member.email, member)
        }
      }

      const nextRows: TourHotelManagementQueueRow[] = []

      for (const tour of multiDayTours) {
        const customerHotelCount = countCustomerHotelRoomsForTour(
          tour,
          reservations,
          choicesByReservationId
        )
        if (customerHotelCount <= 0) continue

        const bookedHotelCount = countBookedTourHotelRooms(bookingsByTourId.get(tour.id) || [])
        const requiredHotelCount = requiredTourHotelRoomCount(customerHotelCount)
        if (!tourHotelBookingMismatch(customerHotelCount, bookedHotelCount)) continue

        const guideEmail = parseTourAssignmentEmails(tour.tour_guide_id)[0]
        nextRows.push({
          id: tour.id,
          tour_date: tour.tour_date,
          product_id: tour.product_id ? String(tour.product_id) : null,
          product_name: productDisplayName(tour),
          guide_name: guideEmail ? teamDisplayName(teamMap.get(guideEmail)) : null,
          booked_hotel_count: bookedHotelCount,
          required_hotel_count: requiredHotelCount,
          customer_hotel_count: customerHotelCount,
          assigned_people: sumCustomerHotelPeopleForTour(tour, reservations),
          reservation_count: assignedReservationsForTour(tour, reservations).length,
        })
      }

      setRows(nextRows)
    } catch (e) {
      console.error('useTourHotelManagementQueue', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, reload, dateRange }
}
