'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildDisplayOtaSaleStatusByProductDate,
  filterOtaSaleStatusByYmdRange,
  getScheduleDisplayCalendarWeekStart,
  getScheduleDisplayThreeWeekDateRange,
} from '@/lib/scheduleDisplayCalendarMeta'
import type { ScheduleDisplayDataPayload } from '@/lib/scheduleDisplayData'
import type { OtaSaleStatus } from '@/lib/otaPriceInventory'
import {
  DEFAULT_SCHEDULE_DISPLAY_STATUS_FILTER,
  tourMatchesScheduleDisplayStatusFilter,
  type ScheduleDisplayStatusFilterId,
} from '@/lib/scheduleDisplayStatusFilter'

type TourLike = {
  id: string
  tour_date?: string | null
  tour_status?: string | null
  product_id?: string | null
  products?: { name?: string | null } | null
}

type ReservationLike = {
  id: string
  product_id?: string | null
  tour_date?: string | null
}

export function buildDisplayToursByDateMap<T extends TourLike>(
  tours: T[],
  displayCalendarWeekStart: Date,
  displayCalendarStatusFilter: Set<ScheduleDisplayStatusFilterId>,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  const { start: windowStart, end: windowEnd } =
    getScheduleDisplayThreeWeekDateRange(displayCalendarWeekStart)

  for (const tour of tours) {
    const date = String(tour.tour_date || '').slice(0, 10)
    if (!date || date < windowStart || date > windowEnd) continue
    if (!tourMatchesScheduleDisplayStatusFilter(tour.tour_status, displayCalendarStatusFilter)) {
      continue
    }
    const list = map.get(date) || []
    list.push(tour)
    map.set(date, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const na = a.products?.name || a.product_id || ''
      const nb = b.products?.name || b.product_id || ''
      return String(na).localeCompare(String(nb), 'ko')
    })
  }

  return map
}

type UseScheduleDisplayCalendarParams = {
  isDisplayMode: boolean
  tours: TourLike[]
  reservations: ReservationLike[]
  usesPrefetchedScheduleData: boolean
  prefetchedScheduleData: ScheduleDisplayDataPayload | null
}

export function useScheduleDisplayCalendar({
  isDisplayMode,
  tours,
  reservations,
  usesPrefetchedScheduleData,
  prefetchedScheduleData,
}: UseScheduleDisplayCalendarParams) {
  const [displayCalendarWeekStart, setDisplayCalendarWeekStart] = useState(() =>
    getScheduleDisplayCalendarWeekStart(),
  )
  const [displayOtaSaleStatusByKey, setDisplayOtaSaleStatusByKey] = useState<
    Record<string, OtaSaleStatus>
  >({})
  const [displayCalendarStatusFilter, setDisplayCalendarStatusFilter] = useState(
    () => new Set<ScheduleDisplayStatusFilterId>(DEFAULT_SCHEDULE_DISPLAY_STATUS_FILTER),
  )
  const [displayStatusFilterModalOpen, setDisplayStatusFilterModalOpen] = useState(false)

  const prefetchedOtaForCalendarWeek = useMemo(() => {
    if (!usesPrefetchedScheduleData || !prefetchedScheduleData?.otaSaleStatusByKey) return null
    const { start, end } = getScheduleDisplayThreeWeekDateRange(displayCalendarWeekStart)
    return filterOtaSaleStatusByYmdRange(prefetchedScheduleData.otaSaleStatusByKey, start, end)
  }, [usesPrefetchedScheduleData, prefetchedScheduleData, displayCalendarWeekStart])

  useEffect(() => {
    if (!isDisplayMode) return
    if (prefetchedOtaForCalendarWeek) {
      setDisplayOtaSaleStatusByKey(prefetchedOtaForCalendarWeek)
      return
    }
    let cancelled = false
    const { start: windowStart, end: windowEnd } =
      getScheduleDisplayThreeWeekDateRange(displayCalendarWeekStart)
    const productIds = [
      ...new Set(
        tours
          .filter((tour) => {
            const date = String(tour.tour_date || '').slice(0, 10)
            if (date < windowStart || date > windowEnd) return false
            return tourMatchesScheduleDisplayStatusFilter(
              tour.tour_status,
              displayCalendarStatusFilter,
            )
          })
          .map((tour) => String(tour.product_id || ''))
          .filter(Boolean),
      ),
    ]
    if (productIds.length === 0) {
      setDisplayOtaSaleStatusByKey({})
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      try {
        const statusMap = await buildDisplayOtaSaleStatusByProductDate({
          weekStart: displayCalendarWeekStart,
          tours: tours as Parameters<typeof buildDisplayOtaSaleStatusByProductDate>[0]['tours'],
          reservations:
            reservations as Parameters<typeof buildDisplayOtaSaleStatusByProductDate>[0]['reservations'],
          productIds,
        })
        if (!cancelled) setDisplayOtaSaleStatusByKey(statusMap)
      } catch (error) {
        console.error('Display calendar OTA status load failed:', error)
        if (!cancelled) setDisplayOtaSaleStatusByKey({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    isDisplayMode,
    prefetchedOtaForCalendarWeek,
    displayCalendarWeekStart,
    tours,
    reservations,
    displayCalendarStatusFilter,
  ])

  const displayToursByDate = useMemo(() => {
    if (!isDisplayMode) return new Map<string, TourLike[]>()
    return buildDisplayToursByDateMap(tours, displayCalendarWeekStart, displayCalendarStatusFilter)
  }, [isDisplayMode, tours, displayCalendarWeekStart, displayCalendarStatusFilter])

  const displayCalendarVisibleTourCount = useMemo(() => {
    let count = 0
    for (const list of displayToursByDate.values()) count += list.length
    return count
  }, [displayToursByDate])

  const displayCalendarStatusFilterActiveCount = displayCalendarStatusFilter.size

  return {
    displayCalendarWeekStart,
    setDisplayCalendarWeekStart,
    displayOtaSaleStatusByKey,
    displayCalendarStatusFilter,
    setDisplayCalendarStatusFilter,
    displayStatusFilterModalOpen,
    setDisplayStatusFilterModalOpen,
    displayToursByDate,
    displayCalendarVisibleTourCount,
    displayCalendarStatusFilterActiveCount,
  }
}
