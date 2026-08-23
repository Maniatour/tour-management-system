'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import {
  buildRentalCarPickupDropoffCards,
  rentalCarPickupDropoffTodayYmd,
  staffDisplayName,
  type RentalCarPickupDropoffCard,
  type RentalCarTeamOption,
  type TeamNameRow,
  type TourAssignmentRow,
  type VehicleRentalRow,
} from '@/lib/rentalCarPickupDropoffQueue'

const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'inactive'])

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, (d || 1) + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function useRentalCarPickupDropoffQueue(enabled = true, locale = 'ko') {
  const [pickups, setPickups] = useState<RentalCarPickupDropoffCard[]>([])
  const [returns, setReturns] = useState<RentalCarPickupDropoffCard[]>([])
  const [teamOptions, setTeamOptions] = useState<RentalCarTeamOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = useMemo(() => rentalCarPickupDropoffTodayYmd(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setPickups([])
      setReturns([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const fromDate = addDaysYmd(today, -7)
      const toDate = addDaysYmd(today, 1)

      const [vehiclesRes, teamRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select(
            'id, vehicle_number, nick, status, vehicle_category, rental_company, rental_agreement_number, rental_start_date, rental_end_date, rental_pickup_location, rental_return_location, rental_pickup_time, rental_return_time, rental_reserved_by'
          )
          .eq('vehicle_category', 'rental')
          .lte('rental_start_date', today)
          .gte('rental_end_date', today),
        supabase
          .from('team')
          .select('email, name_ko, name_en, nick_name, display_name, phone, is_active, languages')
          .eq('is_active', true)
          .order('nick_name', { ascending: true }),
      ])

      if (vehiclesRes.error) throw vehiclesRes.error
      if (teamRes.error) throw teamRes.error

      const vehicles = ((vehiclesRes.data || []) as VehicleRentalRow[]).filter((v) => {
        const status = String(v.status || '').trim().toLowerCase()
        return !INACTIVE_STATUSES.has(status)
      })

      const teamRows = (teamRes.data || []) as TeamNameRow[]
      const teamMap = new Map<string, TeamNameRow>()
      for (const member of teamRows) {
        const email = String(member.email || '').trim()
        if (!email) continue
        teamMap.set(email, member)
        teamMap.set(email.toLowerCase(), member)
      }

      setTeamOptions(
        teamRows
          .map((member) => ({
            email: String(member.email || '').trim(),
            displayName: staffDisplayName(member, String(member.email || ''), locale),
          }))
          .filter((m) => m.email)
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))
      )

      if (!vehicles.length) {
        setPickups([])
        setReturns([])
        return
      }

      const vehicleIds = vehicles.map((v) => v.id)
      const { data: toursData, error: toursErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, product_id, products(id, name, name_ko, name_en)'
        )
        .in('tour_car_id', vehicleIds)
        .gte('tour_date', fromDate)
        .lte('tour_date', toDate)

      if (toursErr) throw toursErr

      const tours = ((toursData || []) as TourAssignmentRow[]).filter(
        (t) => !isTourDeleted(t.tour_status) && !isTourCancelled(t.tour_status)
      )

      const extraEmails = [
        ...vehicles.map((v) => v.rental_reserved_by),
        ...tours.map((t) => t.tour_guide_id),
        ...tours.map((t) => t.assistant_id),
      ]
        .map((e) => String(e || '').trim())
        .filter(Boolean)
        .filter((email) => !teamMap.has(email) && !teamMap.has(email.toLowerCase()))

      if (extraEmails.length) {
        const { data: extraTeam } = await supabase
          .from('team')
          .select('email, name_ko, name_en, nick_name, display_name, phone, is_active, languages')
          .in('email', extraEmails)
        for (const member of (extraTeam || []) as TeamNameRow[]) {
          const email = String(member.email || '').trim()
          if (!email) continue
          teamMap.set(email, member)
          teamMap.set(email.toLowerCase(), member)
        }
      }

      const cards = buildRentalCarPickupDropoffCards({
        today,
        vehicles,
        tours,
        teamMap,
        locale,
      })
      setPickups(cards.pickups)
      setReturns(cards.returns)
    } catch (e) {
      console.error('useRentalCarPickupDropoffQueue', e)
      setPickups([])
      setReturns([])
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [enabled, locale, today])

  useEffect(() => {
    void reload()
  }, [reload])

  return { pickups, returns, teamOptions, loading, error, reload, today }
}
