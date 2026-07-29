'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  composeGuideScheduleConfirmPreview,
  type GuideScheduleConfirmComposeInput,
  type GuideScheduleConfirmPreview,
} from '@/lib/guideScheduleConfirmMessage'
import { supabase } from '@/lib/supabase'
import { calculateAssignedPeople, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import { guideScheduleConfirmTargetDates } from '@/lib/guideScheduleConfirmTodo'

dayjs.extend(utc)
dayjs.extend(timezone)

export type GuideScheduleConfirmListRow = {
  id: string
  tour_date: string
  tour_start_datetime: string | null
  tour_status: string | null
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
  assigned_people: number
  guide_email: string | null
  assistant_email: string | null
}

type TourRow = {
  id: string
  tour_date: string
  tour_start_datetime?: string | null
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  tour_car_id?: string | null
  reservation_ids?: unknown
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

type TeamMember = {
  email: string
  name_ko: string | null
  nick_name?: string | null
  phone?: string | null
  languages?: string[] | null
}

type ReservationRow = {
  id: string
  status: string | null
  pickup_time: string | null
  pickup_hotel: string | null
  total_people: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

function teamDisplayName(member: TeamMember | undefined): string | null {
  if (!member) return null
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || null
}

export function useToursForGuideScheduleConfirm(enabled = true, adminLocale = 'ko') {
  const [rows, setRows] = useState<GuideScheduleConfirmListRow[]>([])
  const [previewByTourId, setPreviewByTourId] = useState<Map<string, GuideScheduleConfirmPreview>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetDates = useMemo(() => guideScheduleConfirmTargetDates(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setPreviewByTourId(new Map())
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
        .in('tour_date', targetDates)
        .order('tour_date', { ascending: true })
        .order('tour_start_datetime', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })

      if (qErr) throw qErr

      const activeTours = ((data || []) as TourRow[]).filter(
        (t) => !isTourDeleted(t.tour_status) && !isTourCancelled(t.tour_status)
      )

      const guideEmails = [
        ...new Set(activeTours.map((t) => t.tour_guide_id).filter((id): id is string => Boolean(id))),
      ]
      const assistantEmails = [
        ...new Set(activeTours.map((t) => t.assistant_id).filter((id): id is string => Boolean(id))),
      ]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const allReservationIds = [
        ...new Set(activeTours.flatMap((t) => normalizeReservationIds(t.reservation_ids))),
      ]

      const vehicleIds = [
        ...new Set(activeTours.map((t) => t.tour_car_id).filter((id): id is string => Boolean(id))),
      ]

      const [teamResult, reservationsResult, vehiclesResult] = await Promise.all([
        allEmails.length > 0
          ? supabase
              .from('team')
              .select('email, name_ko, nick_name, phone, languages')
              .in('email', allEmails)
          : Promise.resolve({ data: [] as TeamMember[], error: null }),
        allReservationIds.length > 0
          ? supabase
              .from('reservations')
              .select('id, status, pickup_time, pickup_hotel, total_people, adults, child, infant')
              .in('id', allReservationIds)
          : Promise.resolve({ data: [] as ReservationRow[], error: null }),
        vehicleIds.length > 0
          ? supabase.from('vehicles').select('id, vehicle_number').in('id', vehicleIds)
          : Promise.resolve({ data: [] as Array<{ id: string; vehicle_number: string | null }>, error: null }),
      ])

      if (teamResult.error) throw teamResult.error
      if (reservationsResult.error) throw reservationsResult.error
      if (vehiclesResult.error) throw vehiclesResult.error

      const teamMap = new Map<string, TeamMember>()
      for (const member of (teamResult.data || []) as TeamMember[]) {
        teamMap.set(member.email, member)
      }

      const reservationRows = (reservationsResult.data || []) as ReservationRow[]

      const vehicleMap = new Map<string, string | null>()
      for (const v of vehiclesResult.data || []) {
        vehicleMap.set(v.id, (v.vehicle_number && String(v.vehicle_number).trim()) || null)
      }

      const hotelIds = [
        ...new Set(
          reservationRows.map((r) => r.pickup_hotel).filter((id): id is string => Boolean(id))
        ),
      ]
      const hotelLabelById = new Map<string, string>()
      if (hotelIds.length > 0) {
        const { data: hotelsData, error: hotelErr } = await supabase
          .from('pickup_hotels')
          .select('id, hotel')
          .in('id', hotelIds)
        if (hotelErr) throw hotelErr
        for (const h of hotelsData || []) {
          const label = h.hotel?.trim()
          if (label) hotelLabelById.set(h.id, label)
        }
      }

      const reservationById = new Map(reservationRows.map((r) => [r.id, r]))
      const previews = new Map<string, GuideScheduleConfirmPreview>()

      const list = activeTours.map((t) => {
        const p = t.products
        const internalName = p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || '—'
        const tourReservationIds = normalizeReservationIds(t.reservation_ids)
        const tourReservationRows = tourReservationIds
          .map((id) => reservationById.get(id))
          .filter((r): r is ReservationRow => Boolean(r))

        const tourReservations = tourReservationRows.map(({ id, status, pickup_time, pickup_hotel }) => ({
          id,
          status,
          pickup_time,
          pickup_hotel,
        }))

        previews.set(
          t.id,
          composeGuideScheduleConfirmPreview(
            {
              tourId: t.id,
              tourDate: t.tour_date,
              tourGuideId: t.tour_guide_id ?? null,
              assistantId: t.assistant_id ?? null,
              product: p ?? null,
              reservations: tourReservations,
              teamByEmail: teamMap as GuideScheduleConfirmComposeInput['teamByEmail'],
              hotelLabelById,
            },
            adminLocale
          )
        )

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
          guide_email: t.tour_guide_id ?? null,
          assistant_email: t.assistant_id ?? null,
        } satisfies GuideScheduleConfirmListRow
      })

      setRows(list)
      setPreviewByTourId(previews)
    } catch (e) {
      console.error('useToursForGuideScheduleConfirm', e)
      setError('load_failed')
      setRows([])
      setPreviewByTourId(new Map())
    } finally {
      setLoading(false)
    }
  }, [enabled, targetDates, adminLocale])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, previewByTourId, loading, error, reload, targetDates }
}
