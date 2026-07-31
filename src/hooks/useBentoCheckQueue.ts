'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { buildBentoCheckTourRows, type BentoCheckTourRow } from '@/lib/bentoCheckQueue'
import { bentoCheckTargetTourDate } from '@/lib/bentoCheckTodo'
import { calculateAssignedPeople, isReservationCancelledStatus, isReservationDeletedStatus, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

type TourRow = {
  id: string
  tour_date: string
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  tour_car_id?: string | null
  reservation_ids?: unknown
  products?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  } | null
}

type ReservationRow = {
  id: string
  status: string | null
  customer_id: string | null
  total_people: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

type TeamMember = { email: string; name_ko: string | null; nick_name?: string | null }
type VehicleRow = { id: string; vehicle_number?: string | null }

export function useBentoCheckQueue(enabled = true) {
  const [rows, setRows] = useState<BentoCheckTourRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const targetDate = useMemo(() => bentoCheckTargetTourDate(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: toursData, error: toursErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, products(name, name_ko, name_en)'
        )
        .eq('tour_date', targetDate)
        .order('id', { ascending: true })

      if (toursErr) throw toursErr

      const activeTours = ((toursData || []) as TourRow[]).filter(
        (t) => !isTourDeleted(t.tour_status) && !isTourCancelled(t.tour_status)
      )

      if (!activeTours.length) {
        setRows([])
        return
      }

      const allReservationIds = [
        ...new Set(activeTours.flatMap((t) => normalizeReservationIds(t.reservation_ids))),
      ]

      if (!allReservationIds.length) {
        setRows([])
        return
      }

      const { data: reservationsData, error: reservationsErr } = await supabase
        .from('reservations')
        .select('id, status, customer_id, total_people, adults, child, infant')
        .in('id', allReservationIds)

      if (reservationsErr) throw reservationsErr

      const activeReservations = ((reservationsData || []) as ReservationRow[]).filter(
        (r) => !isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)
      )

      const activeReservationIds = activeReservations.map((r) => r.id)

      const [optionsRes, choicesRes, ordersRes] = await Promise.all([
        activeReservationIds.length
          ? supabase
              .from('reservation_options')
              .select('reservation_id, option_id, ea, status')
              .in('reservation_id', activeReservationIds)
          : Promise.resolve({ data: [], error: null }),
        activeReservationIds.length
          ? supabase
              .from('reservation_choices')
              .select('reservation_id, quantity, choice_options(option_name_ko, option_name)')
              .in('reservation_id', activeReservationIds)
          : Promise.resolve({ data: [], error: null }),
        fromUntypedTable(supabase, 'tour_bento_orders')
          .select('id, tour_id, ordered_at, ordered_by_email, note')
          .in(
            'tour_id',
            activeTours.map((t) => t.id)
          ),
      ])

      if (optionsRes.error) throw optionsRes.error
      if (choicesRes.error) throw choicesRes.error
      if (ordersRes.error) {
        // 테이블 미적용 시 빈 맵으로 진행
        if (!ordersRes.error.message?.includes('tour_bento_orders')) throw ordersRes.error
      }

      const reservationOptions = optionsRes.data || []
      const optionIds = [
        ...new Set(
          reservationOptions
            .map((r) => String((r as { option_id?: string }).option_id || '').trim())
            .filter(Boolean)
        ),
      ]

      const optionsCatalog = new Map<
        string,
        { name?: string | null; name_ko?: string | null; name_en?: string | null; category?: string | null }
      >()

      if (optionIds.length) {
        const { data: catalogData, error: catalogErr } = await supabase
          .from('options')
          .select('id, name, name_ko, name_en, category')
          .in('id', optionIds)
        if (catalogErr) throw catalogErr
        for (const opt of catalogData || []) {
          if (opt?.id) optionsCatalog.set(String(opt.id), opt)
        }
      }

      const customerIds = [
        ...new Set(
          activeReservations.map((r) => r.customer_id).filter((id): id is string => Boolean(id))
        ),
      ]
      const customers = new Map<string, { name?: string | null }>()
      if (customerIds.length) {
        const { data: customerData, error: customerErr } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        if (customerErr) throw customerErr
        for (const c of customerData || []) {
          if (c?.id) {
            const name = (c as { name?: string | null }).name
            customers.set(String(c.id), { name: name ?? null })
          }
        }
      }

      const guideEmails = [
        ...new Set(activeTours.map((t) => t.tour_guide_id).filter((id): id is string => Boolean(id))),
      ]
      const assistantEmails = [
        ...new Set(activeTours.map((t) => t.assistant_id).filter((id): id is string => Boolean(id))),
      ]
      const teamEmails = [...new Set([...guideEmails, ...assistantEmails])]
      const teamMap = new Map<string, TeamMember>()
      if (teamEmails.length) {
        const { data: teamData, error: teamErr } = await supabase
          .from('team')
          .select('email, name_ko, nick_name')
          .in('email', teamEmails)
        if (teamErr) throw teamErr
        for (const member of (teamData || []) as TeamMember[]) {
          teamMap.set(member.email, member)
        }
      }

      const vehicleIds = [
        ...new Set(activeTours.map((t) => t.tour_car_id).filter((id): id is string => Boolean(id))),
      ]
      const vehiclesMap = new Map<string, VehicleRow>()
      if (vehicleIds.length) {
        const { data: vehicleData, error: vehicleErr } = await supabase
          .from('vehicles')
          .select('id, vehicle_number')
          .in('id', vehicleIds)
        if (vehicleErr) throw vehicleErr
        for (const v of (vehicleData || []) as VehicleRow[]) {
          vehiclesMap.set(v.id, v)
        }
      }

      const ordersMap = new Map<
        string,
        { id: string; ordered_at: string | null; ordered_by_email: string | null; note: string | null }
      >()
      for (const order of ordersRes.data || []) {
        const tourId = String((order as { tour_id?: string }).tour_id || '')
        if (!tourId) continue
        ordersMap.set(tourId, {
          id: String((order as { id: string }).id),
          ordered_at: (order as { ordered_at?: string | null }).ordered_at ?? null,
          ordered_by_email: (order as { ordered_by_email?: string | null }).ordered_by_email ?? null,
          note: (order as { note?: string | null }).note ?? null,
        })
      }

      const assignedPeopleByTourId = new Map<string, number>()
      for (const tour of activeTours) {
        assignedPeopleByTourId.set(
          tour.id,
          calculateAssignedPeople(tour.reservation_ids, activeReservations)
        )
      }

      const nextRows = buildBentoCheckTourRows({
        tours: activeTours,
        reservations: activeReservations,
        customers,
        reservationOptions: reservationOptions as Array<{
          reservation_id: string | null
          option_id: string
          ea?: number | null
          status?: string | null
        }>,
        optionsCatalog,
        reservationChoices: (choicesRes.data || []) as Array<{
          reservation_id: string | null
          quantity?: number | null
          choice_options?: { option_name_ko?: string | null; option_name?: string | null } | null
        }>,
        teamMap,
        vehiclesMap,
        ordersMap,
        assignedPeopleByTourId,
      })

      setRows(nextRows)
    } catch (e) {
      console.error('useBentoCheckQueue', e)
      setRows([])
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [enabled, targetDate])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload, targetDate }
}
