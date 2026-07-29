'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { tourHotelManagementDateRange } from '@/lib/tourHotelManagementTodo'
import {
  countBookedTourHotelRooms,
  countCustomerHotelRoomsForTour,
  isMultiDayTourProduct,
  requiredTourHotelRoomCount,
  sumCustomerHotelPeopleForTour,
  tourHotelBookingMismatch,
  type TourHotelBookingLite,
  type TourHotelReservationLite,
} from '@/lib/tourHotelBookingCounts'
import { parseTourAssignmentEmails } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

export type TourHotelManagementQueueRow = {
  id: string
  tour_date: string
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
          .select('id, tour_date, product_id, status, pickup_hotel, total_people, adults, child, infant')
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
        const customerHotelCount = countCustomerHotelRoomsForTour(tour, reservations)
        if (customerHotelCount <= 0) continue

        const bookedHotelCount = countBookedTourHotelRooms(bookingsByTourId.get(tour.id) || [])
        const requiredHotelCount = requiredTourHotelRoomCount(customerHotelCount)
        if (!tourHotelBookingMismatch(customerHotelCount, bookedHotelCount)) continue

        const guideEmail = parseTourAssignmentEmails(tour.tour_guide_id)[0]
        nextRows.push({
          id: tour.id,
          tour_date: tour.tour_date,
          product_name: productDisplayName(tour),
          guide_name: guideEmail ? teamDisplayName(teamMap.get(guideEmail)) : null,
          booked_hotel_count: bookedHotelCount,
          required_hotel_count: requiredHotelCount,
          customer_hotel_count: customerHotelCount,
          assigned_people: sumCustomerHotelPeopleForTour(tour, reservations),
          reservation_count: customerHotelCount,
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
