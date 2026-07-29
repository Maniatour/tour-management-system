'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  customerInfoReviewTargetDates,
  hasRiskyCommunicationChannel,
  isPickupHotelMissing,
  isResidentStatusCountIncomplete,
  productRequiresResidentStatus,
  type CustomerInfoReviewIssue,
} from '@/lib/customerInfoReviewTodo'
import { calculateAssignedPeople, isReservationCancelledStatus, isReservationDeletedStatus, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'

export type CustomerInfoReviewItem = {
  reservationId: string
  customerId: string | null
  customerName: string
  customerLanguage: string | null
  totalPeople: number
  adults: number
  child: number
  infant: number
  issues: CustomerInfoReviewIssue[]
  customerCommunicationChannel: string | null
  channelId: string | null
  channelName: string | null
  productCode: string | null
  prefetchedResidentCustomerRows: Array<{ resident_status: string | null }>
}

export type CustomerInfoReviewTourGroup = {
  id: string
  tour_date: string
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
  assigned_people: number
  items: CustomerInfoReviewItem[]
}

type TourRow = {
  id: string
  tour_date: string
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  tour_car_id?: string | null
  reservation_ids?: unknown
  product_id?: string | null
  products?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    product_code?: string | null
  } | null
}

type TeamMember = { email: string; name_ko: string | null; nick_name?: string | null }

type ReservationRow = {
  id: string
  status: string | null
  customer_id: string | null
  channel_rn: string | null
  pickup_hotel: string | null
  customer_communication_channel: string | null
  channel_id: string | null
  product_id: string | null
  total_people: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

function teamDisplayName(member: TeamMember | undefined): string | null {
  if (!member) return null
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || null
}

function reservationTotalPeople(r: ReservationRow): number {
  if (typeof r.total_people === 'number' && !Number.isNaN(r.total_people)) return r.total_people
  return (Number(r.adults) || 0) + (Number(r.child) || 0) + (Number(r.infant) || 0)
}

function isActiveAssignedReservation(r: ReservationRow): boolean {
  if (isReservationCancelledStatus(r.status)) return false
  if (isReservationDeletedStatus(r.status)) return false
  return true
}

export function useCustomerInfoReviewQueue(enabled = true) {
  const [groups, setGroups] = useState<CustomerInfoReviewTourGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetDates = useMemo(() => customerInfoReviewTargetDates(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setGroups([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('tours')
        .select(
          'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, product_id, products(name, name_ko, name_en, product_code)'
        )
        .in('tour_date', targetDates)
        .order('tour_date', { ascending: true })
        .order('id', { ascending: true })

      if (qErr) throw qErr

      const activeTours = ((data || []) as TourRow[]).filter(
        (t) => !isTourDeleted(t.tour_status) && !isTourCancelled(t.tour_status)
      )

      if (!activeTours.length) {
        setGroups([])
        return
      }

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
          vehicleMap.set(v.id, (v.vehicle_number && String(v.vehicle_number).trim()) || null)
        }
      }

      const allReservationIds = [
        ...new Set(activeTours.flatMap((t) => normalizeReservationIds(t.reservation_ids))),
      ]

      const reservationMap = new Map<string, ReservationRow>()
      const customerIds = new Set<string>()
      const channelIds = new Set<string>()

      if (allReservationIds.length > 0) {
        const { data: reservationsData, error: resErr } = await supabase
          .from('reservations')
          .select(
            'id, status, customer_id, channel_rn, pickup_hotel, customer_communication_channel, channel_id, product_id, total_people, adults, child, infant'
          )
          .in('id', allReservationIds)
        if (resErr) throw resErr
        for (const row of (reservationsData || []) as ReservationRow[]) {
          reservationMap.set(row.id, row)
          if (row.customer_id) customerIds.add(row.customer_id)
          if (row.channel_id) channelIds.add(row.channel_id)
        }
      }

      const customerNameMap = new Map<string, string>()
      const customerLanguageMap = new Map<string, string | null>()
      if (customerIds.size > 0) {
        const { data: customersData, error: customerErr } = await supabase
          .from('customers')
          .select('id, name, language')
          .in('id', [...customerIds])
        if (customerErr) throw customerErr
        for (const c of customersData || []) {
          customerNameMap.set(c.id, (c.name && String(c.name).trim()) || '—')
          customerLanguageMap.set(c.id, (c.language && String(c.language).trim()) || null)
        }
      }

      const channelNameMap = new Map<string, string>()
      if (channelIds.size > 0) {
        const { data: channelsData, error: channelErr } = await supabase
          .from('channels')
          .select('id, name')
          .in('id', [...channelIds])
        if (channelErr) throw channelErr
        for (const ch of channelsData || []) {
          channelNameMap.set(ch.id, (ch.name && String(ch.name).trim()) || '')
        }
      }

      const residentRowsByReservation = new Map<string, Array<{ resident_status?: string | null; pass_covered_count?: number | null }>>()
      if (allReservationIds.length > 0) {
        const { data: residentRows, error: residentErr } = await supabase
          .from('reservation_customers')
          .select('reservation_id, resident_status, pass_covered_count')
          .in('reservation_id', allReservationIds)
        if (residentErr) throw residentErr
        for (const row of residentRows || []) {
          const list = residentRowsByReservation.get(row.reservation_id) || []
          list.push({
            resident_status: row.resident_status,
            pass_covered_count: row.pass_covered_count,
          })
          residentRowsByReservation.set(row.reservation_id, list)
        }
      }

      const productCodeByProductId = new Map<string, string | null>()
      for (const tour of activeTours) {
        if (tour.product_id && tour.products?.product_code != null) {
          productCodeByProductId.set(String(tour.product_id), tour.products.product_code)
        }
      }

      const list: CustomerInfoReviewTourGroup[] = []

      for (const tour of activeTours) {
        const reservationIds = normalizeReservationIds(tour.reservation_ids)
        const items: CustomerInfoReviewItem[] = []

        for (const reservationId of reservationIds) {
          const reservation = reservationMap.get(reservationId)
          if (!reservation || !isActiveAssignedReservation(reservation)) continue

          const issues: CustomerInfoReviewIssue[] = []
          const channelName = reservation.channel_id
            ? channelNameMap.get(reservation.channel_id) || null
            : null

          if (
            hasRiskyCommunicationChannel(
              reservation.customer_communication_channel,
              reservation.channel_id,
              channelName
            )
          ) {
            issues.push('communication')
          }

          if (isPickupHotelMissing(reservation.pickup_hotel)) {
            issues.push('pickup_hotel')
          }

          const productCode =
            tour.products?.product_code ||
            (reservation.product_id ? productCodeByProductId.get(reservation.product_id) : null) ||
            null

          if (productRequiresResidentStatus(productCode)) {
            const totalPeople = reservationTotalPeople(reservation)
            const residentRows = residentRowsByReservation.get(reservationId)
            if (isResidentStatusCountIncomplete(residentRows, totalPeople)) {
              issues.push('resident_status')
            }
          }

          if (!issues.length) continue

          items.push({
            reservationId,
            customerId: reservation.customer_id,
            customerName: reservation.customer_id
              ? customerNameMap.get(reservation.customer_id) || '—'
              : '—',
            customerLanguage: reservation.customer_id
              ? customerLanguageMap.get(reservation.customer_id) ?? null
              : null,
            totalPeople: reservationTotalPeople(reservation),
            adults: Number(reservation.adults) || 0,
            child: Number(reservation.child) || 0,
            infant: Number(reservation.infant) || 0,
            issues,
            customerCommunicationChannel: reservation.customer_communication_channel,
            channelId: reservation.channel_id,
            channelName,
            productCode,
            prefetchedResidentCustomerRows: (residentRowsByReservation.get(reservationId) || []).map(
              (row) => ({ resident_status: row.resident_status ?? null })
            ),
          })
        }

        if (!items.length) continue

        const p = tour.products
        const internalName = p?.name?.trim() || p?.name_ko?.trim() || p?.name_en?.trim() || '—'

        list.push({
          id: tour.id,
          tour_date: tour.tour_date,
          product_internal_name: internalName,
          guide_name: tour.tour_guide_id ? teamDisplayName(teamMap.get(tour.tour_guide_id)) : null,
          assistant_name: tour.assistant_id ? teamDisplayName(teamMap.get(tour.assistant_id)) : null,
          vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) ?? null : null,
          assigned_people: calculateAssignedPeople(tour, [...reservationMap.values()]),
          items,
        })
      }

      setGroups(list)
    } catch (e) {
      console.error('useCustomerInfoReviewQueue', e)
      setError('load_failed')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [enabled, targetDates])

  useEffect(() => {
    void reload()
  }, [reload])

  const issueCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups]
  )

  return { groups, loading, error, reload, targetDates, issueCount }
}
