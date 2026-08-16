'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { markOtaSiteSynced } from '@/lib/markOtaSiteSynced'
import {
  buildChannelVariantListings,
  buildClosureHistoryByListingAndDate,
  encodeChannelVariantListing,
  getOtaClosureTargetListings,
  inferSaleStatus,
  isVehicleRemainingLow,
  requiresOtaPlatformClosure,
  resolveClosureHistoryEntries,
  resolveDefaultChannelVariantListing,
  resolveVehicleRemaining,
  type ChannelVariantListing,
  type OtaChannelInventoryHistoryRow,
  type OtaChannelInventoryRow,
  type OtaSaleStatus,
} from '@/lib/otaPriceInventory'
import {
  getOtaClosureListingsForDate,
  otaClosureTargetDates,
} from '@/lib/otaClosureTodo'
import { buildCapacityTotalsByDate } from '@/lib/scheduleTourCapacity'
import { buildDayCanyonReconByDate, formatCanyonReconBadges } from '@/lib/ticketBookingDateView'
import { loadCalendarChoiceRows } from '@/lib/fetchCanyonChoiceRows'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

export type OtaClosureCanyonBadge = {
  key: string
  text: string
  mismatch: boolean
}

export type OtaClosureQueueAction = {
  listing: ChannelVariantListing
  currentRemaining: number
  historyEntries: OtaChannelInventoryHistoryRow[]
  faviconUrl?: string
}

export type OtaClosureQueueRow = {
  key: string
  productId: string
  productName: string
  date: string
  status: OtaSaleStatus
  totalAssigned: number
  totalMax: number
  totalSpotsLeft: number
  vehicleRemaining: number | null
  isLowVehicleRemaining: boolean
  canyonBadges: OtaClosureCanyonBadge[]
  closureActions: OtaClosureQueueAction[]
}

type ProductRow = { id: string; name?: string | null; name_ko?: string | null }

type TeamMemberLite = {
  email: string
  nick_name?: string | null
  name_ko?: string | null
}

function buildInventoryByListingAndDate(
  rows: OtaChannelInventoryRow[]
): Record<string, Record<string, OtaChannelInventoryRow>> {
  const result: Record<string, Record<string, OtaChannelInventoryRow>> = {}
  for (const row of rows) {
    const listingId = encodeChannelVariantListing(row.channel_id, row.variant_key || 'default')
    if (!result[listingId]) result[listingId] = {}
    result[listingId][row.inventory_date] = row
  }
  return result
}

function isMissingOtaTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; status?: number }
  if (e.code === 'PGRST205' || e.code === '42P01') return true
  if (e.status === 404) return true
  const msg = (e.message || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

export function useOtaClosureQueue(enabled = true) {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)

  const [rows, setRows] = useState<OtaClosureQueueRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncingKey, setSyncingKey] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([])
  const [syncContextByRowKey, setSyncContextByRowKey] = useState<
    Record<
      string,
      {
        productId: string
        date: string
        internalSpotsLeft: number | null
        inventoryByListingAndDate: Record<string, Record<string, OtaChannelInventoryRow>>
        isSaleAvailable: boolean
      }
    >
  >({})

  const targetDates = useMemo(() => otaClosureTargetDates(), [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      return
    }

    setLoading(true)
    const { start, end } = { start: targetDates[0]!, end: targetDates[targetDates.length - 1]! }

    try {
      const [productsRes, channelsRes, teamRes, toursRes, reservationsRes, inventoryRes, historyRes] =
        await Promise.all([
          supabase
            .from('products')
            .select('id, name, name_ko')
            .eq('operator_id', activeOperatorId)
            .in('sub_category', ['Mania Tour', 'Mania Service'])
            .order('name', { ascending: true })
            .limit(500),
          supabase
            .from('channels')
            .select('id, name, type, favicon_url')
            .eq('status', 'active')
            .order('name'),
          supabase
            .from('team')
            .select('email, name_ko, nick_name')
            .eq('is_active', true)
            .order('name_ko'),
          supabase
            .from('tours')
            .select('id, tour_date, max_participants, tour_status, reservation_ids, product_id')
            .gte('tour_date', start)
            .lte('tour_date', end),
          supabase
            .from('reservations')
            .select('id, tour_date, product_id, total_people, status, canyon_choice, choices')
            .gte('tour_date', start)
            .lte('tour_date', end)
            .in('status', ['confirmed', 'recruiting']),
          fromUntypedTable(supabase, 'ota_channel_inventory')
            .select('*')
            .gte('inventory_date', start)
            .lte('inventory_date', end),
          fromUntypedTable(supabase, 'ota_channel_inventory_history')
            .select('*')
            .gte('inventory_date', start)
            .lte('inventory_date', end)
            .order('recorded_at', { ascending: false }),
        ])

      const products = (productsRes.data || []) as ProductRow[]
      const productIds = new Set(products.map((p) => p.id))
      const productNameById = new Map(
        products.map((p) => [p.id, p.name?.trim() || p.name_ko?.trim() || p.id])
      )

      const channels = (channelsRes.data || []) as Array<{
        id: string
        name?: string | null
        type?: string | null
        favicon_url?: string | null
      }>

      const faviconMap = new Map<string, string>()
      for (const ch of channels) {
        if (ch.favicon_url?.trim()) faviconMap.set(ch.id, ch.favicon_url.trim())
      }

      setTeamMembers(
        ((teamRes.data || []) as Array<{ email?: string | null; name_ko?: string | null; nick_name?: string | null }>)
          .filter((m): m is TeamMemberLite => Boolean(m.email?.trim()))
          .map((m) => ({
            email: m.email!.trim(),
            name_ko: m.name_ko ?? null,
            nick_name: m.nick_name ?? null,
          }))
      )

      const tourRows = ((toursRes.data || []) as Array<{
        id: string
        tour_date: string
        max_participants?: number | null
        tour_status?: string | null
        reservation_ids?: string[] | null
        product_id?: string | null
      }>).filter((t) => t.product_id && productIds.has(t.product_id))

      const activeProductIds = [
        ...new Set(tourRows.map((t) => String(t.product_id)).filter(Boolean)),
      ]

      if (!activeProductIds.length) {
        setRows([])
        setSyncContextByRowKey({})
        return
      }

      const reservationRows = ((reservationsRes.data || []) as Array<{
        id: string
        tour_date: string
        product_id?: string | null
        total_people?: number | null
        status?: string | null
        canyon_choice?: string | null
        choices?: unknown
      }>).filter((r) => r.product_id && productIds.has(r.product_id))

      let allInventory: OtaChannelInventoryRow[] = []
      if (!inventoryRes.error) {
        allInventory = ((inventoryRes.data || []) as OtaChannelInventoryRow[]).filter((row) =>
          activeProductIds.includes(row.product_id)
        )
      } else if (!isMissingOtaTableError(inventoryRes.error)) {
        console.error('useOtaClosureQueue inventory', inventoryRes.error)
      }

      let historyRows: OtaChannelInventoryHistoryRow[] = []
      if (!historyRes.error) {
        historyRows = ((historyRes.data || []) as OtaChannelInventoryHistoryRow[]).filter((row) =>
          activeProductIds.includes(row.product_id)
        )
      }
      const historyByListingAndDate = buildClosureHistoryByListingAndDate(historyRows)

      const inventoryByProduct = new Map<string, OtaChannelInventoryRow[]>()
      for (const row of allInventory) {
        const list = inventoryByProduct.get(row.product_id) || []
        list.push(row)
        inventoryByProduct.set(row.product_id, list)
      }

      const channelProductsRes = await supabase
        .from('channel_products')
        .select('product_id, channel_id, variant_key, variant_name_ko, variant_name_en')
        .in('product_id', activeProductIds)
        .eq('is_active', true)

      const channelProductsByProduct = new Map<
        string,
        Array<{
          channel_id: string
          variant_key?: string | null
          variant_name_ko?: string | null
          variant_name_en?: string | null
        }>
      >()
      for (const row of channelProductsRes.data || []) {
        const pid = String(row.product_id || '')
        if (!pid) continue
        const list = channelProductsByProduct.get(pid) || []
        list.push(row as {
          channel_id: string
          variant_key?: string | null
          variant_name_ko?: string | null
          variant_name_en?: string | null
        })
        channelProductsByProduct.set(pid, list)
      }

      const pricingRes = await supabase
        .from('dynamic_pricing')
        .select('product_id, channel_id, variant_key, date, is_sale_available')
        .in('product_id', activeProductIds)
        .gte('date', start)
        .lte('date', end)

      const saleAvailableByProductDate = new Map<string, boolean>()
      for (const row of pricingRes.data || []) {
        const key = `${row.product_id}:${row.date}`
        if (row.is_sale_available === false) saleAvailableByProductDate.set(key, false)
        else if (!saleAvailableByProductDate.has(key)) saleAvailableByProductDate.set(key, true)
      }

      const reservationIds = reservationRows.map((r) => r.id).filter(Boolean)
      const choiceRowsByResId = reservationIds.length
        ? await loadCalendarChoiceRows(supabase, reservationRows)
        : new Map()

      const tourIds = tourRows.map((t) => t.id).filter(Boolean)
      const ticketBookingsRaw: Array<{
        tour_id?: string | null
        ea?: number | null
        company?: string | null
        category?: string | null
        status?: string | null
        deletion_requested_at?: string | null
      }> = []

      if (tourIds.length > 0) {
        const BATCH = 100
        for (let i = 0; i < tourIds.length; i += BATCH) {
          const batchIds = tourIds.slice(i, i + BATCH)
          const { data: tbData, error: tbError } = await supabase
            .from('ticket_bookings')
            .select('tour_id, ea, company, category, status, deletion_requested_at')
            .in('tour_id', batchIds)

          if (tbError) {
            console.error('useOtaClosureQueue ticket_bookings', tbError)
            continue
          }
          ticketBookingsRaw.push(...((tbData || []) as typeof ticketBookingsRaw))
        }
      }

      const ticketBookings = filterTicketBookingsExcludedFromMainUi(ticketBookingsRaw)

      const nextRows: OtaClosureQueueRow[] = []
      const nextSyncContext: typeof syncContextByRowKey = {}

      for (const productId of activeProductIds) {
        const productTours = tourRows.filter((t) => t.product_id === productId)
        const productReservations = reservationRows.filter((r) => r.product_id === productId)
        const listings = buildChannelVariantListings(
          channels,
          channelProductsByProduct.get(productId) || []
        )
        const closureTargetListings = getOtaClosureTargetListings(listings)
        const defaultListing = resolveDefaultChannelVariantListing(listings)
        const inventoryByListingAndDate = buildInventoryByListingAndDate(
          inventoryByProduct.get(productId) || []
        )

        const capacityByDate = buildCapacityTotalsByDate(
          productTours,
          productReservations,
          productId,
          targetDates
        )

        const canyonReconByDate = buildDayCanyonReconByDate({
          tours: productTours,
          reservations: productReservations,
          choiceRowsByResId,
          ticketBookings,
          productId,
          dates: targetDates,
        })

        for (const date of targetDates) {
          const capacity = capacityByDate[date]
          if (!capacity) continue

          const defaultInventory = defaultListing
            ? inventoryByListingAndDate[defaultListing]?.[date]
            : undefined
          const isSaleAvailable = saleAvailableByProductDate.get(`${productId}:${date}`) !== false
          const status = inferSaleStatus(
            defaultInventory || null,
            isSaleAvailable,
            capacity.totalSpotsLeft
          )

          if (!requiresOtaPlatformClosure(status)) continue

          const vehicleRemaining = resolveVehicleRemaining(defaultInventory, capacity.totalSpotsLeft)
          const closureListings = getOtaClosureListingsForDate(
            date,
            status,
            closureTargetListings,
            inventoryByListingAndDate,
            capacity.totalSpotsLeft
          )

          const closureActions: OtaClosureQueueAction[] = closureListings
            .map((listing) => {
              const inventoryRow = inventoryByListingAndDate[listing.id]?.[date]
              const currentRemaining = resolveVehicleRemaining(inventoryRow, capacity.totalSpotsLeft)
              if (currentRemaining == null || !Number.isFinite(currentRemaining)) return null
              const faviconUrl = faviconMap.get(listing.channelId)
              return {
                listing,
                currentRemaining,
                historyEntries: resolveClosureHistoryEntries(
                  historyByListingAndDate[listing.id]?.[date],
                  inventoryRow
                ),
                ...(faviconUrl ? { faviconUrl } : {}),
              }
            })
            .filter((action): action is OtaClosureQueueAction => action != null)

          if (closureActions.length === 0) continue

          const rowKey = `${productId}:${date}`
          nextRows.push({
            key: rowKey,
            productId,
            productName: productNameById.get(productId) || productId,
            date,
            status,
            totalAssigned: capacity.totalAssigned,
            totalMax: capacity.totalMax,
            totalSpotsLeft: capacity.totalSpotsLeft,
            vehicleRemaining,
            isLowVehicleRemaining: isVehicleRemainingLow(vehicleRemaining),
            canyonBadges: formatCanyonReconBadges(canyonReconByDate[date]),
            closureActions,
          })

          nextSyncContext[rowKey] = {
            productId,
            date,
            internalSpotsLeft: capacity.totalSpotsLeft,
            inventoryByListingAndDate,
            isSaleAvailable,
          }
        }
      }

      nextRows.sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName))
      setRows(nextRows)
      setSyncContextByRowKey(nextSyncContext)
    } catch (e) {
      console.error('useOtaClosureQueue', e)
      setRows([])
      setSyncContextByRowKey({})
    } finally {
      setLoading(false)
    }
  }, [activeOperatorId, enabled, targetDates])

  useEffect(() => {
    void reload()
  }, [reload])

  const markSynced = useCallback(
    async (
      rowKey: string,
      listing: ChannelVariantListing,
      userEmail?: string | null,
      updaterName?: string | null
    ) => {
      const ctx = syncContextByRowKey[rowKey]
      if (!ctx) return

      const syncKey = `${listing.id}:${rowKey}`
      setSyncingKey(syncKey)
      try {
        const existing = ctx.inventoryByListingAndDate[listing.id]?.[ctx.date]
        await markOtaSiteSynced({
          supabase,
          activeOperatorId,
          productId: ctx.productId,
          date: ctx.date,
          listing,
          existing,
          internalRemaining: ctx.internalSpotsLeft,
          isSaleAvailable: ctx.isSaleAvailable,
          userEmail: userEmail ?? null,
          updaterName: updaterName ?? null,
        })
        await reload()
      } catch (e) {
        console.error('markSynced', e)
        alert('OTA 반영 저장에 실패했습니다.')
      } finally {
        setSyncingKey(null)
      }
    },
    [activeOperatorId, reload, syncContextByRowKey]
  )

  return {
    rows,
    loading,
    reload,
    markSynced,
    syncingKey,
    teamMembers,
    targetDates,
  }
}
