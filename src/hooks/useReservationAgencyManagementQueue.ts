'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  isReservationAgencyProduct,
  isCustomerCreditCardAgencyPaymentMethod,
  reservationAgencyActionComplete,
  reservationAgencyManagementDateRange,
} from '@/lib/reservationAgencyManagementTodo'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { isPaymentRequestedStatus } from '@/utils/reservationPricingBalance'
import { isReservationCancelledStatus, isReservationDeletedStatus } from '@/utils/tourUtils'

export type ReservationAgencyManagementItem = {
  reservationId: string
  tourDate: string
  channelRn: string | null
  customerName: string
  productName: string
  subCategory: string | null
  totalPeople: number
  ticketBookingCount: number
}

type ReservationRow = {
  id: string
  tour_date: string | null
  status: string | null
  channel_rn: string | null
  product_id: string | null
  customer_id: string | null
  total_people: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}

type ProductRow = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  sub_category?: string | null
}

type CustomerRow = {
  id: string
  name?: string | null
}

function reservationTotalPeople(r: ReservationRow): number {
  if (typeof r.total_people === 'number' && !Number.isNaN(r.total_people)) return r.total_people
  return (Number(r.adults) || 0) + (Number(r.child) || 0) + (Number(r.infant) || 0)
}

function productDisplayName(
  product: ProductRow | null | undefined,
  productId: string | null,
  reservationId: string
): string {
  return (
    product?.name_ko?.trim() ||
    product?.name?.trim() ||
    product?.name_en?.trim() ||
    productId ||
    reservationId
  )
}

function isActiveReservation(r: ReservationRow): boolean {
  if (isReservationCancelledStatus(r.status)) return false
  if (isReservationDeletedStatus(r.status)) return false
  return true
}

async function fetchRowsByIds<T extends { id: string }>(
  table: 'products' | 'customers',
  ids: string[],
  select: string
): Promise<Map<string, T>> {
  const map = new Map<string, T>()
  const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (!unique.length) return map

  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase.from(table).select(select).in('id', chunk)
    if (error) throw error
    for (const row of (data || []) as unknown as T[]) {
      map.set(row.id, row)
    }
  }
  return map
}

async function fetchCustomerCreditCardPaymentMethodKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, method, display_name')
  if (error) throw error

  for (const row of data || []) {
    const method = String((row as { method?: string | null }).method ?? '').trim()
    const displayName = String((row as { display_name?: string | null }).display_name ?? '').trim()
    const id = String((row as { id?: string | null }).id ?? '').trim()
    if (!method && !displayName && !id) continue

    const matches =
      isCustomerCreditCardAgencyPaymentMethod(method) ||
      isCustomerCreditCardAgencyPaymentMethod(displayName)
    if (!matches) continue

    if (id) keys.add(id.toLowerCase())
    if (method) keys.add(method.toLowerCase())
    if (displayName) keys.add(displayName.toLowerCase())
  }

  return keys
}

function paymentMethodMatchesCustomerCreditCard(
  paymentMethod: string | null | undefined,
  knownKeys: Set<string>
): boolean {
  const raw = String(paymentMethod ?? '').trim()
  if (!raw) return false
  if (isCustomerCreditCardAgencyPaymentMethod(raw)) return true
  const lower = raw.toLowerCase()
  if (knownKeys.has(lower)) return true
  return knownKeys.has(raw.trim().toLowerCase())
}

function shouldIgnorePaymentRecordStatus(paymentStatus: string | null | undefined): boolean {
  const status = String(paymentStatus ?? '').trim()
  if (!status) return false
  if (status.toLowerCase() === 'deleted') return true
  return isPaymentRequestedStatus(status)
}

async function fetchReservationIdsWithExpenses(reservationIds: string[]): Promise<Set<string>> {
  const withExpenses = new Set<string>()
  const chunkSize = 100
  for (let i = 0; i < reservationIds.length; i += chunkSize) {
    const chunk = reservationIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservation_expenses')
      .select('reservation_id')
      .in('reservation_id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const rid = String((row as { reservation_id?: string | null }).reservation_id || '').trim()
      if (rid) withExpenses.add(rid)
    }
  }
  return withExpenses
}

async function fetchReservationIdsWithCustomerCreditCardPayment(
  reservationIds: string[],
  customerCardMethodKeys: Set<string>
): Promise<Set<string>> {
  const completed = new Set<string>()
  const chunkSize = 100
  for (let i = 0; i < reservationIds.length; i += chunkSize) {
    const chunk = reservationIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('payment_records')
      .select('reservation_id, payment_method, payment_status')
      .in('reservation_id', chunk)
    if (error) throw error

    for (const row of data || []) {
      const rid = String((row as { reservation_id?: string | null }).reservation_id || '').trim()
      if (!rid || completed.has(rid)) continue
      const status = (row as { payment_status?: string | null }).payment_status
      if (shouldIgnorePaymentRecordStatus(status)) continue
      const paymentMethod = (row as { payment_method?: string | null }).payment_method
      if (paymentMethodMatchesCustomerCreditCard(paymentMethod, customerCardMethodKeys)) {
        completed.add(rid)
      }
    }
  }
  return completed
}

async function fetchReservationIdsWithAgencyActionComplete(
  reservationIds: string[],
  customerCardMethodKeys: Set<string>
): Promise<Set<string>> {
  const [withExpenses, withCustomerCardPayment] = await Promise.all([
    fetchReservationIdsWithExpenses(reservationIds),
    fetchReservationIdsWithCustomerCreditCardPayment(reservationIds, customerCardMethodKeys),
  ])
  const completed = new Set<string>()
  for (const id of reservationIds) {
    if (
      reservationAgencyActionComplete({
        hasReservationExpense: withExpenses.has(id),
        hasCustomerCreditCardPayment: withCustomerCardPayment.has(id),
      })
    ) {
      completed.add(id)
    }
  }
  return completed
}

async function fetchTicketBookingCountsByReservation(
  reservationIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!reservationIds.length) return counts

  const chunkSize = 100
  for (let i = 0; i < reservationIds.length; i += chunkSize) {
    const chunk = reservationIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('ticket_bookings')
      .select('reservation_id, deletion_requested_at')
      .in('reservation_id', chunk)
    if (error) throw error

    const rows = filterTicketBookingsExcludedFromMainUi(
      (data || []) as Array<{ reservation_id?: string | null; deletion_requested_at?: string | null }>
    )
    for (const row of rows) {
      const rid = String(row.reservation_id || '').trim()
      if (!rid) continue
      counts.set(rid, (counts.get(rid) || 0) + 1)
    }
  }
  return counts
}

export function useReservationAgencyManagementQueue(enabled = true) {
  const [items, setItems] = useState<ReservationAgencyManagementItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dateRange = useMemo(() => reservationAgencyManagementDateRange(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      return
    }

    setLoading(true)
    setError(null)
    const { start, end } = dateRange

    try {
      const { data, error: reservationsErr } = await supabase
        .from('reservations')
        .select(
          'id, tour_date, status, channel_rn, product_id, customer_id, total_people, adults, child, infant'
        )
        .gte('tour_date', start)
        .lte('tour_date', end)
        .in('status', ['confirmed', 'recruiting'])
        .order('tour_date', { ascending: true })
        .order('id', { ascending: true })

      if (reservationsErr) throw reservationsErr

      const reservationRows = (data || []) as ReservationRow[]
      const productIds = reservationRows
        .map((row) => row.product_id)
        .filter((id): id is string => Boolean(id))
      const customerIds = reservationRows
        .map((row) => row.customer_id)
        .filter((id): id is string => Boolean(id))

      const [productMap, customerMap] = await Promise.all([
        fetchRowsByIds<ProductRow>(
          'products',
          productIds,
          'id, name, name_ko, name_en, sub_category'
        ),
        fetchRowsByIds<CustomerRow>('customers', customerIds, 'id, name'),
      ])

      const agencyRows = reservationRows.filter((row) => {
        const product = row.product_id ? productMap.get(row.product_id) : null
        return (
          isActiveReservation(row) &&
          isReservationAgencyProduct(product) &&
          String(row.tour_date || '').trim()
        )
      })

      if (!agencyRows.length) {
        setItems([])
        return
      }

      const reservationIds = agencyRows.map((row) => row.id)
      const customerCardMethodKeys = await fetchCustomerCreditCardPaymentMethodKeys()
      const [completedReservationIds, ticketCounts] = await Promise.all([
        fetchReservationIdsWithAgencyActionComplete(reservationIds, customerCardMethodKeys),
        fetchTicketBookingCountsByReservation(reservationIds),
      ])

      const nextItems: ReservationAgencyManagementItem[] = agencyRows
        .filter((row) => !completedReservationIds.has(row.id))
        .map((row) => {
          const product = row.product_id ? productMap.get(row.product_id) : null
          const customer = row.customer_id ? customerMap.get(row.customer_id) : null
          return {
            reservationId: row.id,
            tourDate: String(row.tour_date || '').slice(0, 10),
            channelRn: row.channel_rn?.trim() || null,
            customerName: customer?.name?.trim() || '—',
            productName: productDisplayName(product, row.product_id, row.id),
            subCategory: product?.sub_category?.trim() || null,
            totalPeople: reservationTotalPeople(row),
            ticketBookingCount: ticketCounts.get(row.id) || 0,
          }
        })

      setItems(nextItems)
    } catch (e) {
      console.error('useReservationAgencyManagementQueue', e)
      setError(e instanceof Error ? e.message : 'load failed')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    items,
    loading,
    error,
    reload,
    dateRange,
    count: items.length,
  }
}
