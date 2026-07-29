'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isActiveTourHotelBookingStatus } from '@/lib/tourHotelBookingCounts'
import {
  formatTourHotelBookingPrice,
  isTourHotelPriceCheckBookingInRange,
  tourHotelPriceCheckDateRange,
} from '@/lib/tourHotelPriceCheckTodo'

export type TourHotelPriceCheckQueueRow = {
  id: string
  tour_id: string | null
  check_in_date: string
  check_out_date: string
  hotel: string
  city: string
  reservation_name: string
  rooms: number
  unit_price: number | null
  total_price: number | null
  display_price: number | null
  website: string | null
  status: string | null
  tour_date: string | null
  tour_name: string | null
}

type BookingRow = {
  id: string
  tour_id?: string | null
  check_in_date: string
  check_out_date: string
  reservation_name?: string | null
  rooms?: number | null
  city?: string | null
  hotel?: string | null
  room_type?: string | null
  unit_price?: number | null
  total_price?: number | null
  website?: string | null
  status?: string | null
  deletion_requested_at?: string | null
}

type TourRow = {
  id: string
  tour_date: string
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

function productDisplayName(tour: TourRow | undefined): string | null {
  if (!tour) return null
  const p = tour.products
  return p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || null
}

export function useTourHotelPriceCheckQueue(enabled = true) {
  const [rows, setRows] = useState<TourHotelPriceCheckQueueRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dateRange = useMemo(() => tourHotelPriceCheckDateRange(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const { start, end } = dateRange

    try {
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('tour_hotel_bookings')
        .select(
          'id, tour_id, check_in_date, check_out_date, reservation_name, rooms, city, hotel, room_type, unit_price, total_price, website, status, deletion_requested_at'
        )
        .is('deletion_requested_at', null)
        .gte('check_out_date', start)
        .lte('check_in_date', end)
        .order('check_in_date', { ascending: true })
        .order('hotel', { ascending: true })

      if (bookingsErr) throw bookingsErr

      const bookings = ((bookingsData || []) as BookingRow[]).filter(
        (b) =>
          isActiveTourHotelBookingStatus(b.status) &&
          Boolean(String(b.hotel || '').trim()) &&
          isTourHotelPriceCheckBookingInRange(b.check_in_date, b.check_out_date, { start, end })
      )

      if (!bookings.length) {
        setRows([])
        return
      }

      const tourIds = [...new Set(bookings.map((b) => b.tour_id).filter(Boolean))] as string[]
      const toursMap = new Map<string, TourRow>()

      if (tourIds.length > 0) {
        const { data: toursData, error: toursErr } = await supabase
          .from('tours')
          .select('id, tour_date, products(name, name_ko, name_en)')
          .in('id', tourIds)

        if (toursErr) throw toursErr
        for (const tour of (toursData || []) as TourRow[]) {
          toursMap.set(tour.id, tour)
        }
      }

      const nextRows: TourHotelPriceCheckQueueRow[] = bookings.map((booking) => {
        const tour = booking.tour_id ? toursMap.get(booking.tour_id) : undefined
        const rooms = Math.max(1, Number(booking.rooms) || 1)
        return {
          id: booking.id,
          tour_id: booking.tour_id ?? null,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          hotel: String(booking.hotel || '').trim(),
          city: String(booking.city || '').trim(),
          reservation_name: String(booking.reservation_name || '').trim(),
          rooms,
          unit_price: booking.unit_price ?? null,
          total_price: booking.total_price ?? null,
          display_price: formatTourHotelBookingPrice(
            booking.total_price,
            booking.unit_price,
            booking.rooms
          ),
          website: booking.website?.trim() || null,
          status: booking.status ?? null,
          tour_date: tour?.tour_date ?? null,
          tour_name: productDisplayName(tour),
        }
      })

      setRows(nextRows)
    } catch (e) {
      console.error('useTourHotelPriceCheckQueue', e)
      setRows([])
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [dateRange, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload, dateRange }
}
