'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  isConfirmedTourHotelBookingForCcForm,
  normalizeTourHotelCcStatus,
  tourHotelCcFormTargetCheckInDate,
  type TourHotelCcStatus,
} from '@/lib/tourHotelCcFormTodo'

export type TourHotelCcFormQueueRow = {
  id: string
  tour_id: string | null
  check_in_date: string
  check_out_date: string
  hotel: string
  city: string
  reservation_name: string
  rn_number: string | null
  rooms: number
  cc: TourHotelCcStatus
  name_change_confirmed_at: string | null
  name_change_confirmed_by: string | null
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
  rn_number?: string | null
  rooms?: number | null
  city?: string | null
  hotel?: string | null
  cc?: string | null
  name_change_confirmed_at?: string | null
  name_change_confirmed_by?: string | null
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

export function useTourHotelCcFormQueue(enabled = true) {
  const [rows, setRows] = useState<TourHotelCcFormQueueRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const targetCheckIn = useMemo(() => tourHotelCcFormTargetCheckInDate(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('tour_hotel_bookings')
        .select(
          'id, tour_id, check_in_date, check_out_date, reservation_name, rn_number, rooms, city, hotel, cc, name_change_confirmed_at, name_change_confirmed_by, status, deletion_requested_at'
        )
        .is('deletion_requested_at', null)
        .eq('check_in_date', targetCheckIn)
        .order('hotel', { ascending: true })
        .order('reservation_name', { ascending: true })

      if (bookingsErr) throw bookingsErr

      const bookings = ((bookingsData || []) as BookingRow[]).filter(
        (b) =>
          isConfirmedTourHotelBookingForCcForm(b.status) && Boolean(String(b.hotel || '').trim())
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

      const nextRows: TourHotelCcFormQueueRow[] = bookings.map((booking) => {
        const tour = booking.tour_id ? toursMap.get(booking.tour_id) : undefined
        return {
          id: booking.id,
          tour_id: booking.tour_id ?? null,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          hotel: String(booking.hotel || '').trim(),
          city: String(booking.city || '').trim(),
          reservation_name: String(booking.reservation_name || '').trim(),
          rn_number: booking.rn_number?.trim() || null,
          rooms: Math.max(1, Number(booking.rooms) || 1),
          cc: normalizeTourHotelCcStatus(booking.cc),
          name_change_confirmed_at: booking.name_change_confirmed_at ?? null,
          name_change_confirmed_by: booking.name_change_confirmed_by ?? null,
          status: booking.status ?? null,
          tour_date: tour?.tour_date ?? null,
          tour_name: productDisplayName(tour),
        }
      })

      setRows(nextRows)
    } catch (e) {
      console.error('useTourHotelCcFormQueue', e)
      setRows([])
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [enabled, targetCheckIn])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload, targetCheckIn, setRows }
}
