'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { supabase } from '@/lib/supabase'
import {
  calculateAssignedPeople,
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import { isWithin48HoursBeforeTourStartLocal } from '@/utils/reservationUtils'
import type { TourEnvelopePrintListRow } from '@/hooks/useToursForEnvelopePrint'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export type PickupNotificationTourRow = TourEnvelopePrintListRow & {
  /** 배정·비취소 예약의 서로 다른 픽업 호텔 수 */
  pickup_hotel_count: number
}

function countDistinctPickupHotels(
  tour: { reservation_ids?: unknown },
  reservations: Array<{ id: string; status: string | null; pickup_hotel: string | null }>
): number {
  const ids = normalizeReservationIds(tour.reservation_ids)
  if (ids.length === 0) return 0
  const idSet = new Set(ids.map((id) => String(id).trim()))
  const hotels = new Set<string>()
  for (const reservation of reservations) {
    if (!idSet.has(String(reservation.id ?? '').trim())) continue
    if (isReservationCancelledStatus(reservation.status)) continue
    if (isReservationDeletedStatus(reservation.status)) continue
    const hotelId = (reservation.pickup_hotel ?? '').trim()
    if (!hotelId) continue
    hotels.add(hotelId)
  }
  return hotels.size
}

type TourRow = {
  id: string
  tour_date: string
  product_id?: string | null
  tour_start_datetime?: string | null
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  tour_car_id?: string | null
  reservation_ids?: unknown
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

type TeamMember = { email: string; name_ko: string | null; nick_name?: string | null }

function teamDisplayName(member: TeamMember | undefined): string | null {
  if (!member) return null
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || null
}

function tourTimeFromStartDatetime(tourStartDatetime: string | null | undefined): string | null {
  if (!tourStartDatetime) return null
  const d = new Date(tourStartDatetime)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isTourWithinPickupNotificationWindow(tour: Pick<TourRow, 'tour_date' | 'tour_start_datetime'>): boolean {
  const tourTime = tourTimeFromStartDatetime(tour.tour_start_datetime)
  return isWithin48HoursBeforeTourStartLocal({
    tourDate: tour.tour_date,
    tourTime,
  })
}

export function useToursForPickupNotification(enabled = true) {
  const [rows, setRows] = useState<PickupNotificationTourRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateRange = useMemo(() => {
    const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
    const end = dayjs().tz(LV_TZ).add(3, 'day').format('YYYY-MM-DD')
    return { start, end }
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, product_id, tour_start_datetime, tour_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, products(name, name_ko, name_en)'
        )
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)
        .order('tour_start_datetime', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })

      if (qErr) throw qErr

      const activeTours = ((data || []) as TourRow[]).filter(
        (t) =>
          !isTourDeleted(t.tour_status) &&
          !isTourCancelled(t.tour_status) &&
          isTourWithinPickupNotificationWindow(t)
      )

      const guideEmails = [
        ...new Set(activeTours.map((t) => t.tour_guide_id).filter((id): id is string => Boolean(id))),
      ]
      const assistantEmails = [
        ...new Set(activeTours.map((t) => t.assistant_id).filter((id): id is string => Boolean(id))),
      ]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const teamMap = new Map<string, TeamMember>()
      if (allEmails.length > 0) {
        const { data: teamMembers, error: teamErr } = await supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .in('email', allEmails)
        if (teamErr) throw teamErr
        for (const member of (teamMembers || []) as TeamMember[]) {
          teamMap.set(member.email, member)
        }
      }

      const vehicleIds = [
        ...new Set(activeTours.map((t) => t.tour_car_id).filter((id): id is string => Boolean(id))),
      ]
      const vehicleMap = new Map<string, string | null>()
      if (vehicleIds.length > 0) {
        const { data: vehiclesData, error: vehicleErr } = await supabase
          .from('vehicles')
          .select('id, vehicle_number')
          .in('id', vehicleIds)
        if (vehicleErr) throw vehicleErr
        for (const v of vehiclesData || []) {
          const num = (v.vehicle_number && String(v.vehicle_number).trim()) || null
          vehicleMap.set(v.id, num)
        }
      }

      const allReservationIds = [
        ...new Set(activeTours.flatMap((t) => normalizeReservationIds(t.reservation_ids))),
      ]
      const reservationRows: Array<{
        id: string
        status: string | null
        total_people: number | null
        adults?: number | null
        child?: number | null
        infant?: number | null
        pickup_hotel: string | null
      }> = []
      if (allReservationIds.length > 0) {
        const { data: reservationsData, error: resErr } = await supabase
          .from('reservations')
          .select('id, status, total_people, adults, child, infant, pickup_hotel')
          .in('id', allReservationIds)
        if (resErr) throw resErr
        reservationRows.push(...(reservationsData || []))
      }

      const list = activeTours.map((t) => {
        const p = t.products
        const internalName = p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || '—'
        return {
          id: t.id,
          tour_date: t.tour_date,
          tour_start_datetime: t.tour_start_datetime ?? null,
          tour_status: t.tour_status ?? null,
          product_internal_name: internalName,
          guide_name: t.tour_guide_id ? teamDisplayName(teamMap.get(t.tour_guide_id)) : null,
          assistant_name: t.assistant_id ? teamDisplayName(teamMap.get(t.assistant_id)) : null,
          vehicle_number: t.tour_car_id ? vehicleMap.get(t.tour_car_id) ?? null : null,
          assigned_people: calculateAssignedPeople(t, reservationRows),
          pickup_hotel_count: countDistinctPickupHotels(t, reservationRows),
        } satisfies PickupNotificationTourRow
      })

      setRows(list)
    } catch (e) {
      console.error('useToursForPickupNotification', e)
      setError('load_failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateRange.end, dateRange.start, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload }
}
