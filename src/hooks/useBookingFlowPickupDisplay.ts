'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomerScheduleItem } from '@/components/product/TourScheduleCustomerItineraryView'
import { useProductDetailTourScheduleTiming } from '@/hooks/useProductDetailTourScheduleTiming'
import { formatYmdLong } from '@/lib/goblinGrandCanyonSunrisePickup'
import { supabase } from '@/lib/supabase'

type ProductForPickup = {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

function formatScheduleTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): string | null {
  const start = startTime?.substring(0, 5) ?? null
  if (!start) return null
  const end = endTime?.substring(0, 5) ?? null
  if (!end || end === start) return start
  return `${start} ~ ${end}`
}

export function useBookingFlowPickupDisplay(
  productId: string,
  selectedDate: string | null,
  product: ProductForPickup,
  isEnglish: boolean,
  departureTime?: string | null
) {
  const [schedules, setSchedules] = useState<CustomerScheduleItem[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadSchedules = async () => {
      setLoadingSchedules(true)
      try {
        const { data, error } = await supabase
          .from('product_schedules')
          .select(
            `
            id,
            day_number,
            start_time,
            end_time,
            duration_minutes,
            is_break,
            is_meal,
            is_transport,
            is_tour,
            title_ko,
            title_en,
            description_ko,
            description_en,
            location_ko,
            location_en,
            thumbnail_url,
            google_maps_link
          `
          )
          .eq('product_id', productId)
          .eq('show_to_customers', true)
          .order('day_number', { ascending: true })
          .order('order_index', { ascending: true })
          .order('start_time', { ascending: true })

        if (error) throw error
        if (!cancelled) {
          setSchedules((data ?? []) as CustomerScheduleItem[])
        }
      } catch {
        if (!cancelled) setSchedules([])
      } finally {
        if (!cancelled) setLoadingSchedules(false)
      }
    }

    void loadSchedules()

    return () => {
      cancelled = true
    }
  }, [productId])

  const getLocalizedTitle = useCallback(
    (schedule: CustomerScheduleItem) =>
      isEnglish
        ? schedule.title_en || schedule.title_ko || ''
        : schedule.title_ko || schedule.title_en || '',
    [isEnglish]
  )

  const { sunriseSummary, hotelPickupWindow, loadingSunrise } =
    useProductDetailTourScheduleTiming(
      schedules,
      selectedDate ?? '',
      product,
      isEnglish,
      getLocalizedTitle
    )

  const pickupDisplay = useMemo(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return null

    if (sunriseSummary?.pickupWindowLabel) {
      return sunriseSummary.pickupWindowLabel
    }

    if (hotelPickupWindow?.pickupWindowLabel) {
      return hotelPickupWindow.pickupWindowLabel
    }

    const firstPickupSchedule =
      schedules.find((schedule) => schedule.is_transport && schedule.start_time) ??
      schedules.find((schedule) => schedule.start_time)

    const scheduleTimeRange = formatScheduleTimeRange(
      firstPickupSchedule?.start_time,
      firstPickupSchedule?.end_time
    )

    if (scheduleTimeRange) {
      const dateLabel = formatYmdLong(selectedDate, isEnglish)
      return isEnglish
        ? `${dateLabel}: ${scheduleTimeRange}`
        : `${dateLabel} ${scheduleTimeRange}`
    }

    if (departureTime?.trim()) {
      const dateLabel = formatYmdLong(selectedDate, isEnglish)
      return isEnglish
        ? `${dateLabel}: ${departureTime.trim()}`
        : `${dateLabel} ${departureTime.trim()}`
    }

    return null
  }, [
    departureTime,
    hotelPickupWindow?.pickupWindowLabel,
    isEnglish,
    schedules,
    selectedDate,
    sunriseSummary?.pickupWindowLabel,
  ])

  return {
    pickupDisplay,
    loading: loadingSchedules || loadingSunrise,
  }
}
