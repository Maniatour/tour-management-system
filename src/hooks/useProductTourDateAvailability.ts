'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTourDateStatus, toIsoDateLocal } from '@/lib/productTourDateStatus'

export function useProductTourDateAvailability(productId: string | undefined) {
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const todayIso = useMemo(() => toIsoDateLocal(new Date()), [])

  useEffect(() => {
    if (!productId) {
      setClosedDates(new Set())
      setReservationCounts({})
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)

      try {
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 6)

        const [pricingRes, reservationsRes] = await Promise.all([
          supabase
            .from('dynamic_pricing')
            .select('date, is_sale_available')
            .eq('product_id', productId)
            .eq('channel_id', 'M00001')
            .eq('price_type', 'dynamic')
            .gte('date', todayIso)
            .lte('date', toIsoDateLocal(endDate)),
          supabase
            .from('reservations')
            .select('tour_date, total_people, status')
            .eq('product_id', productId)
            .gte('tour_date', todayIso)
            .lte('tour_date', toIsoDateLocal(endDate))
            .not('status', 'ilike', '%canceled%'),
        ])

        if (cancelled) return

        const closed = new Set<string>()
        pricingRes.data?.forEach((row) => {
          if (row.is_sale_available === false && row.date) {
            closed.add(row.date)
          }
        })

        const counts: Record<string, number> = {}
        reservationsRes.data?.forEach((reservation) => {
          const status = String(reservation.status ?? '').toLowerCase()
          if (status.includes('cancel') || status === 'inquiry') return
          const date = reservation.tour_date
          if (!date) return
          counts[date] = (counts[date] || 0) + (reservation.total_people || 0)
        })

        setClosedDates(closed)
        setReservationCounts(counts)
      } catch (error) {
        console.error('[useProductTourDateAvailability]', error)
        if (!cancelled) {
          setClosedDates(new Set())
          setReservationCounts({})
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productId, todayIso])

  const getStatusForDate = (date: Date) => {
    const iso = toIsoDateLocal(date)
    return getTourDateStatus(iso, todayIso, closedDates, reservationCounts)
  }

  const isDateSelectable = (date: Date) => {
    const iso = toIsoDateLocal(date)
    const status = getTourDateStatus(iso, todayIso, closedDates, reservationCounts)
    return status !== 'past' && status !== 'closed'
  }

  return {
    loading,
    closedDates,
    reservationCounts,
    todayIso,
    getStatusForDate,
    isDateSelectable,
  }
}
