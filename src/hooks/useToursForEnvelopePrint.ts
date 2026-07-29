'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateAssignedPeople, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

export type TourEnvelopePrintListRow = {
  id: string
  tour_date: string
  tour_start_datetime: string | null
  tour_status: string | null
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
  assigned_people: number
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

export function useToursForEnvelopePrint(tourDate: string | null, enabled = true) {
  const [rows, setRows] = useState<TourEnvelopePrintListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !tourDate) {
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
        .eq('tour_date', tourDate)
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
      }> = []
      if (allReservationIds.length > 0) {
        const { data: reservationsData, error: resErr } = await supabase
          .from('reservations')
          .select('id, status, total_people, adults, child, infant')
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
        } satisfies TourEnvelopePrintListRow
      })

      setRows(list)
    } catch (e) {
      console.error('useToursForEnvelopePrint', e)
      setError('load_failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [enabled, tourDate])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload }
}
