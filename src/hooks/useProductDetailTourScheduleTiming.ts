'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CustomerScheduleItem } from '@/components/product/TourScheduleCustomerItineraryView'
import {
  buildCustomerScheduleDisplayItems,
  buildHotelPickupWindowDisplay,
  getSunrisePickupWindowSummary,
  resolveGrandCanyonSunrisePickupForDate,
} from '@/lib/productDetailTourScheduleTiming'
import {
  isGoblinGrandCanyonSunriseTour,
  type GrandCanyonSunrisePickupEmailInfo,
} from '@/lib/goblinGrandCanyonSunrisePickup'

type ProductForSunriseDetection = {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

export function useProductDetailTourScheduleTiming(
  schedules: CustomerScheduleItem[],
  selectedDate: string,
  product: ProductForSunriseDetection,
  isEnglish: boolean,
  getLocalizedTitle: (schedule: CustomerScheduleItem) => string
) {
  const [gcSunrise, setGcSunrise] = useState<GrandCanyonSunrisePickupEmailInfo | null>(null)
  const [loadingSunrise, setLoadingSunrise] = useState(false)

  const isSunriseTour = useMemo(() => isGoblinGrandCanyonSunriseTour(product), [product])
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)

  useEffect(() => {
    if (!hasValidDate || !isSunriseTour) {
      setGcSunrise(null)
      return
    }

    let cancelled = false

    const loadSunriseTiming = async () => {
      setLoadingSunrise(true)
      try {
        let cachedSunrise: string | null = null

        try {
          const { getCachedSunriseSunsetData } = await import('@/lib/weatherApi')
          const cached = await getCachedSunriseSunsetData('Grand Canyon South Rim', selectedDate)
          cachedSunrise = cached?.sunrise ?? null
        } catch {
          cachedSunrise = null
        }

        if (!cachedSunrise) {
          try {
            const response = await fetch(
              `/api/sunrise-sunset?lat=36.1069&lng=-112.1129&date=${selectedDate}`
            )
            if (response.ok) {
              const data = (await response.json()) as { sunrise?: string }
              cachedSunrise = data.sunrise ?? null
            }
          } catch {
            cachedSunrise = null
          }
        }

        if (cancelled) return
        setGcSunrise(await resolveGrandCanyonSunrisePickupForDate(selectedDate, cachedSunrise))
      } finally {
        if (!cancelled) setLoadingSunrise(false)
      }
    }

    void loadSunriseTiming()

    return () => {
      cancelled = true
    }
  }, [hasValidDate, isSunriseTour, selectedDate])

  const displayItems = useMemo(
    () =>
      buildCustomerScheduleDisplayItems(schedules, {
        selectedDate,
        isEnglish,
        gcSunrise: hasValidDate && isSunriseTour ? gcSunrise : null,
        getLocalizedTitle,
      }),
    [schedules, selectedDate, isEnglish, gcSunrise, hasValidDate, isSunriseTour, getLocalizedTitle]
  )

  const hotelPickupWindow = useMemo(() => {
    if (!hasValidDate || displayItems.length === 0) return null
    return buildHotelPickupWindowDisplay(selectedDate, displayItems[0], isEnglish)
  }, [displayItems, hasValidDate, isEnglish, selectedDate])

  const sunriseSummary = useMemo(
    () =>
      gcSunrise ? getSunrisePickupWindowSummary(gcSunrise, isEnglish, hotelPickupWindow) : null,
    [gcSunrise, isEnglish, hotelPickupWindow]
  )

  return {
    displayItems,
    sunriseSummary,
    hotelPickupWindow,
    loadingSunrise,
    isSunriseTour,
    hasValidDate,
  }
}
