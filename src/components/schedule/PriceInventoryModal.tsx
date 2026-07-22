'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  RefreshCw,
  Save,
  Star,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  buildCapacityTotalsByDate,
  type DayTourCapacityTotals,
} from '@/lib/scheduleTourCapacity'
import {
  buildDayCanyonReconByDate,
  formatCanyonReconBadges,
  type DayCanyonReconTotals,
} from '@/lib/ticketBookingDateView'
import {
  choiceLabelToTourCountKey,
  type ReservationChoiceRow,
  type TourChoiceCountKey,
} from '@/lib/tourChoiceCounts'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { operatorIdInsert, resolveOperatorId } from '@/lib/operators/scopeQuery'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { useChoiceManagement } from '@/hooks/useChoiceManagement'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  OTA_STATUS_META,
  type OtaChannelInventoryRow,
  type OtaChannelInventoryHistoryRow,
  type OtaSaleStatus,
  type ChannelVariantListing,
  buildCalendarDays,
  buildChannelVariantListings,
  encodeChannelVariantListing,
  extractCanyonPricesFromRule,
  formatOtaUpdateStamp,
  getMonthDateRange,
  inferSaleStatus,
  getAutoSaleStatusForDate,
  getOtaClosureTargetListings,
  needsOtaRemainingSiteUpdate,
  resolveVehicleRemaining,
  abbreviateKlookVariantLabel,
  buildClosureHistoryByListingAndDate,
  formatClosureHistoryActor,
  formatClosureHistoryDetail,
  requiresOtaPlatformClosure,
  resolveClosureHistoryEntries,
  isVehicleRemainingLow,
  resolveDefaultChannelVariantListing,
  resolveDefaultGoblinProductId,
} from '@/lib/otaPriceInventory'

type ProductOption = {
  id: string
  name?: string | null
  name_ko?: string | null
}

type ChannelOption = {
  id: string
  name?: string | null
  type?: string | null
  favicon_url?: string | null
}

type TeamMemberLite = {
  email: string
  nick_name?: string | null
  name_ko?: string | null
}

export interface PriceInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  products: ProductOption[]
  userEmail?: string | null
  teamMembers?: TeamMemberLite[]
  initialProductId?: string
  initialSelectedDate?: string | null
}

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

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

function getUpdaterDisplayName(
  row: OtaChannelInventoryRow | undefined,
  teamMembers: TeamMemberLite[]
): string {
  if (!row) return ''
  if (row.updated_by_name) return row.updated_by_name
  if (row.updated_by_email) {
    const member = teamMembers.find((m) => m.email === row.updated_by_email)
    return member?.nick_name || member?.name_ko || row.updated_by_email.split('@')[0] || ''
  }
  return ''
}

function isMissingOtaTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; status?: number }
  if (e.code === 'PGRST205' || e.code === '42P01') return true
  if (e.status === 404) return true
  const msg = (e.message || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('could not find the table')
}

function OtaClosureChannelButton({
  listing,
  faviconUrl,
  currentRemaining,
  saving,
  historyEntries,
  teamMembers,
  onMarkSynced,
}: {
  listing: ChannelVariantListing
  faviconUrl?: string
  currentRemaining: number
  saving: boolean
  historyEntries: OtaChannelInventoryHistoryRow[]
  teamMembers: TeamMemberLite[]
  onMarkSynced: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hideTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [failed, setFailed] = useState(false)
  const isKlook = /klook|클룩/i.test(`${listing.channelId} ${listing.channelName}`)
  const variantBadge = isKlook
    ? abbreviateKlookVariantLabel(listing.variantKey, listing.variantLabel)
    : null

  const showPopover = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setOpen(true)
  }, [])

  const scheduleHidePopover = useCallback(() => {
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 140)
  }, [])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setCoords({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    })
  }, [open])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[12050] w-[min(92vw,240px)] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-white p-2.5 text-left shadow-xl"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={showPopover}
            onMouseLeave={scheduleHidePopover}
            role="tooltip"
          >
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">{listing.displayLabel}</p>
            <p className="mb-1 text-[10px] text-muted-foreground">
              현재 잔여 <span className="font-semibold text-foreground">{currentRemaining}석</span>
            </p>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">OTA 반영 히스토리</p>
            {historyEntries.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">아직 기록이 없습니다.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {historyEntries.slice(0, 10).map((entry, index) => (
                  <li
                    key={entry.id || `${entry.recorded_at}-${index}`}
                    className="rounded-md bg-slate-50 px-2 py-1"
                  >
                    <p className="text-[10px] font-semibold text-foreground">
                      {formatClosureHistoryActor(entry, teamMembers)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {formatOtaUpdateStamp(entry.recorded_at)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {formatClosureHistoryDetail(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!saving) onMarkSynced()
        }}
        disabled={saving}
        onMouseEnter={showPopover}
        onMouseLeave={scheduleHidePopover}
        onFocus={showPopover}
        onBlur={scheduleHidePopover}
        aria-label={`${listing.displayLabel} OTA 사이트 ${currentRemaining}석 반영 완료`}
        title={`클릭 → OTA 사이트에 ${currentRemaining}석 반영 완료`}
        className="inline-flex h-8 min-w-[2rem] flex-col items-center justify-center rounded-md border border-red-200 bg-red-50 px-1 py-0.5 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        {saving ? (
          <span className="text-[9px] font-bold leading-none text-red-800">…</span>
        ) : faviconUrl && !failed ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-bold leading-none text-red-800">
            {isKlook ? 'K' : 'G'}
          </span>
        )}
        {!saving && variantBadge ? (
          <span className="mt-0.5 text-[8px] leading-none text-red-900">{variantBadge}</span>
        ) : null}
      </button>
      {popover}
    </>
  )
}

export default function PriceInventoryModal({
  isOpen,
  onClose,
  products,
  userEmail,
  teamMembers = [],
  initialProductId,
  initialSelectedDate,
}: PriceInventoryModalProps) {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)

  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [channelVariantListings, setChannelVariantListings] = useState<ChannelVariantListing[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedListingId, setSelectedListingId] = useState('')
  const [currentMonth, setCurrentMonth] = useState(() => dayjs().startOf('month').toDate())
  const [inventoryByDate, setInventoryByDate] = useState<Record<string, OtaChannelInventoryRow>>({})
  const [inventoryByListingAndDate, setInventoryByListingAndDate] = useState<
    Record<string, Record<string, OtaChannelInventoryRow>>
  >({})
  const [closureHistoryByListingAndDate, setClosureHistoryByListingAndDate] = useState<
    Record<string, Record<string, OtaChannelInventoryHistoryRow[]>>
  >({})
  const [watchDates, setWatchDates] = useState<Set<string>>(new Set())
  const [pricingByDate, setPricingByDate] = useState<
    Record<string, { adultPrice: number; isSaleAvailable: boolean; choicesPricing: Record<string, unknown> }>
  >({})
  const [internalCapacityByDate, setInternalCapacityByDate] = useState<
    Record<string, DayTourCapacityTotals>
  >({})
  const [canyonReconByDate, setCanyonReconByDate] = useState<
    Record<string, DayCanyonReconTotals>
  >({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [otaTablesReady, setOtaTablesReady] = useState(true)
  const [statusMenuDate, setStatusMenuDate] = useState<string | null>(null)
  const [savingStatusDate, setSavingStatusDate] = useState<string | null>(null)
  const [syncingOtaKey, setSyncingOtaKey] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    antelope_x_seats: '',
    antelope_l_seats: '',
    vehicle_seats: '',
    sale_status: 'on_sale' as OtaSaleStatus,
    notes: '',
  })

  const selectedListing = useMemo(
    () => channelVariantListings.find((listing) => listing.id === selectedListingId),
    [channelVariantListings, selectedListingId]
  )
  const selectedChannelId = selectedListing?.channelId || ''
  const selectedVariantKey = selectedListing?.variantKey || 'default'

  const closureTargetListings = useMemo(
    () => getOtaClosureTargetListings(channelVariantListings),
    [channelVariantListings]
  )

  const faviconByChannelId = useMemo(() => {
    const map = new Map<string, string>()
    for (const channel of channels) {
      const url = channel.favicon_url?.trim()
      if (url) map.set(channel.id, url)
    }
    return map
  }, [channels])

  const refreshInventoryForDate = useCallback(
    async (date: string) => {
      if (!selectedProductId) return
      try {
        const { data, error } = await fromUntypedTable(supabase, 'ota_channel_inventory')
          .select('*')
          .eq('product_id', selectedProductId)
          .eq('inventory_date', date)

        if (error) throw error

        setInventoryByListingAndDate((prev) => {
          const next: Record<string, Record<string, OtaChannelInventoryRow>> = { ...prev }
          for (const row of (data || []) as OtaChannelInventoryRow[]) {
            const listingId = encodeChannelVariantListing(
              row.channel_id,
              row.variant_key || 'default'
            )
            next[listingId] = { ...(next[listingId] || {}), [date]: row }
          }
          return next
        })
      } catch (error) {
        if (!isMissingOtaTableError(error)) {
          console.error('OTA inventory refresh failed:', error)
        }
      }
    },
    [selectedProductId]
  )

  const refreshClosureHistoryForDate = useCallback(
    async (date: string) => {
      if (!selectedProductId) return
      try {
        const { data, error } = await fromUntypedTable(supabase, 'ota_channel_inventory_history')
          .select('*')
          .eq('product_id', selectedProductId)
          .eq('inventory_date', date)
          .order('recorded_at', { ascending: false })

        if (error) throw error

        setClosureHistoryByListingAndDate((prev) => {
          const next: Record<string, Record<string, OtaChannelInventoryHistoryRow[]>> = { ...prev }
          for (const listingId of Object.keys(next)) {
            if (next[listingId]?.[date]) {
              const { [date]: _, ...rest } = next[listingId]!
              next[listingId] = rest
            }
          }
          for (const row of (data || []) as OtaChannelInventoryHistoryRow[]) {
            const listingId = encodeChannelVariantListing(
              row.channel_id,
              row.variant_key || 'default'
            )
            if (!next[listingId]) next[listingId] = {}
            if (!next[listingId][date]) next[listingId][date] = []
            next[listingId][date]!.push(row)
          }
          return next
        })
      } catch (error) {
        if (!isMissingOtaTableError(error)) {
          console.error('OTA closure history refresh failed:', error)
        }
      }
    },
    [selectedProductId]
  )

  const getClosureListingsForDate = useCallback(
    (date: string, status: OtaSaleStatus) => {
      if (!requiresOtaPlatformClosure(status)) return []
      const internalRemaining = internalCapacityByDate[date]?.totalSpotsLeft
      return closureTargetListings.filter((listing) => {
        const row = inventoryByListingAndDate[listing.id]?.[date]
        const currentRemaining = resolveVehicleRemaining(row, internalRemaining)
        return needsOtaRemainingSiteUpdate(row, currentRemaining)
      })
    },
    [closureTargetListings, internalCapacityByDate, inventoryByListingAndDate]
  )

  const updaterName = useMemo(() => {
    if (!userEmail) return ''
    const member = teamMembers.find((m) => m.email === userEmail)
    return member?.nick_name || member?.name_ko || userEmail.split('@')[0] || ''
  }, [teamMembers, userEmail])

  const markOtaSiteSynced = useCallback(
    async (date: string, listing: ChannelVariantListing) => {
      if (!selectedProductId) return
      const syncKey = `${listing.id}:${date}`
      setSyncingOtaKey(syncKey)
      try {
        const internalRemaining = internalCapacityByDate[date]?.totalSpotsLeft
        const existing = inventoryByListingAndDate[listing.id]?.[date]
        const currentRemaining = resolveVehicleRemaining(existing, internalRemaining)
        if (currentRemaining == null || !Number.isFinite(currentRemaining)) return

        const pricing = pricingByDate[date]
        const saleStatus = inferSaleStatus(
          existing || null,
          pricing?.isSaleAvailable ?? true,
          internalRemaining
        )

        const payload = {
          ...operatorIdInsert(activeOperatorId),
          product_id: selectedProductId,
          channel_id: listing.channelId,
          variant_key: listing.variantKey,
          inventory_date: date,
          antelope_x_seats: existing?.antelope_x_seats ?? null,
          antelope_l_seats: existing?.antelope_l_seats ?? null,
          vehicle_seats: existing?.vehicle_seats ?? null,
          ota_synced_vehicle_seats: currentRemaining,
          sale_status: saleStatus,
          notes: existing?.notes ?? null,
          updated_by_email: userEmail || null,
          updated_by_name: updaterName || null,
          updated_at: new Date().toISOString(),
        }

        const { error } = await fromUntypedTable(supabase, 'ota_channel_inventory').upsert(payload, {
          onConflict: 'product_id,channel_id,variant_key,inventory_date',
        })

        if (error) throw error

        await refreshInventoryForDate(date)
        await refreshClosureHistoryForDate(date)

        if (listing.id === selectedListingId) {
          const { data } = await fromUntypedTable(supabase, 'ota_channel_inventory')
            .select('*')
            .eq('product_id', selectedProductId)
            .eq('inventory_date', date)
            .eq('channel_id', listing.channelId)
            .eq('variant_key', listing.variantKey)
            .maybeSingle()

          if (data) {
            setInventoryByDate((prev) => ({
              ...prev,
              [date]: data as OtaChannelInventoryRow,
            }))
          }
        }
      } catch (error) {
        if (isMissingOtaTableError(error)) {
          setOtaTablesReady(false)
        } else {
          console.error('OTA site sync mark failed:', error)
        }
      } finally {
        setSyncingOtaKey(null)
      }
    },
    [
      activeOperatorId,
      internalCapacityByDate,
      inventoryByListingAndDate,
      pricingByDate,
      refreshClosureHistoryForDate,
      refreshInventoryForDate,
      selectedListingId,
      selectedProductId,
      updaterName,
      userEmail,
    ]
  )

  const { choiceCombinations } = useChoiceManagement(
    selectedProductId || '',
    selectedChannelId || undefined,
    'OTA'
  )

  useEffect(() => {
    if (!isOpen) return
    setSelectedProductId((prev) => prev || resolveDefaultGoblinProductId(products))
  }, [isOpen, products])

  useEffect(() => {
    if (!isOpen) return
    if (initialProductId) {
      setSelectedProductId(initialProductId)
    }
    if (initialSelectedDate) {
      setSelectedDate(initialSelectedDate)
      setCurrentMonth(dayjs(initialSelectedDate).startOf('month').toDate())
    }
  }, [isOpen, initialProductId, initialSelectedDate])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('channels')
        .select('id, name, type, favicon_url')
        .eq('status', 'active')
        .order('name')
      if (cancelled) return
      setChannels((data || []) as ChannelOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !selectedProductId || channels.length === 0) return
    let cancelled = false
    ;(async () => {
      const [channelProductsRes, pricingVariantsRes] = await Promise.all([
        supabase
          .from('channel_products')
          .select('channel_id, variant_key, variant_name_ko, variant_name_en')
          .eq('product_id', selectedProductId)
          .eq('is_active', true)
          .order('channel_id')
          .order('variant_key'),
        supabase
          .from('dynamic_pricing')
          .select('channel_id, variant_key')
          .eq('product_id', selectedProductId),
      ])

      if (cancelled) return

      const extraVariantsByChannel: Record<string, string[]> = {}
      for (const row of pricingVariantsRes.data || []) {
        const channelId = String(row.channel_id || '')
        const variantKey = String(row.variant_key || 'default').trim() || 'default'
        if (!channelId) continue
        if (!extraVariantsByChannel[channelId]) extraVariantsByChannel[channelId] = []
        if (!extraVariantsByChannel[channelId].includes(variantKey)) {
          extraVariantsByChannel[channelId].push(variantKey)
        }
      }

      const listings = buildChannelVariantListings(
        channels,
        (channelProductsRes.data || []) as Array<{
          channel_id: string
          variant_key?: string | null
          variant_name_ko?: string | null
          variant_name_en?: string | null
        }>,
        extraVariantsByChannel
      )

      setChannelVariantListings(listings)
      setSelectedListingId((prev) => {
        if (prev && listings.some((listing) => listing.id === prev)) return prev
        return resolveDefaultChannelVariantListing(listings)
      })
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedProductId, channels])

  const loadMonthData = useCallback(async () => {
    if (!selectedProductId || !selectedChannelId || !selectedListingId) return
    setLoading(true)
    const { start, end } = getMonthDateRange(currentMonth)

    try {
      const [inventoryRes, allInventoryRes, historyRes, watchRes, pricingRes, toursRes, reservationsRes] =
        await Promise.all([
        fromUntypedTable(supabase, 'ota_channel_inventory')
          .select('*')
          .eq('product_id', selectedProductId)
          .eq('channel_id', selectedChannelId)
          .eq('variant_key', selectedVariantKey)
          .gte('inventory_date', start)
          .lte('inventory_date', end),
        fromUntypedTable(supabase, 'ota_channel_inventory')
          .select('*')
          .eq('product_id', selectedProductId)
          .gte('inventory_date', start)
          .lte('inventory_date', end),
        fromUntypedTable(supabase, 'ota_channel_inventory_history')
          .select('*')
          .eq('product_id', selectedProductId)
          .gte('inventory_date', start)
          .lte('inventory_date', end)
          .order('recorded_at', { ascending: false }),
        fromUntypedTable(supabase, 'ota_inventory_watch_dates')
          .select('watch_date')
          .eq('product_id', selectedProductId)
          .eq('channel_id', selectedChannelId)
          .eq('variant_key', selectedVariantKey)
          .gte('watch_date', start)
          .lte('watch_date', end),
        supabase
          .from('dynamic_pricing')
          .select('date, adult_price, is_sale_available, choices_pricing')
          .eq('product_id', selectedProductId)
          .eq('channel_id', selectedChannelId)
          .eq('variant_key', selectedVariantKey)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('tours')
          .select('id, tour_date, max_participants, tour_status, reservation_ids, product_id')
          .eq('product_id', selectedProductId)
          .gte('tour_date', start)
          .lte('tour_date', end),
        supabase
          .from('reservations')
          .select('id, tour_date, product_id, total_people, status')
          .eq('product_id', selectedProductId)
          .gte('tour_date', start)
          .lte('tour_date', end)
          .in('status', ['confirmed', 'recruiting']),
      ])

      const inventoryMap: Record<string, OtaChannelInventoryRow> = {}
      if (inventoryRes.error) {
        if (isMissingOtaTableError(inventoryRes.error)) {
          setOtaTablesReady(false)
        } else {
          console.error('OTA inventory load failed:', inventoryRes.error)
        }
      } else {
        setOtaTablesReady(true)
        for (const row of (inventoryRes.data || []) as OtaChannelInventoryRow[]) {
          inventoryMap[row.inventory_date] = row
        }
      }
      setInventoryByDate(inventoryMap)

      if (allInventoryRes.error) {
        if (!isMissingOtaTableError(allInventoryRes.error)) {
          console.error('OTA all-channel inventory load failed:', allInventoryRes.error)
        }
        setInventoryByListingAndDate({})
      } else {
        setInventoryByListingAndDate(
          buildInventoryByListingAndDate((allInventoryRes.data || []) as OtaChannelInventoryRow[])
        )
      }

      if (historyRes.error) {
        if (!isMissingOtaTableError(historyRes.error)) {
          console.error('OTA closure history load failed:', historyRes.error)
        }
        setClosureHistoryByListingAndDate({})
      } else {
        setClosureHistoryByListingAndDate(
          buildClosureHistoryByListingAndDate(
            (historyRes.data || []) as OtaChannelInventoryHistoryRow[]
          )
        )
      }

      if (watchRes.error) {
        if (!isMissingOtaTableError(watchRes.error)) {
          console.error('OTA watch dates load failed:', watchRes.error)
        }
        setWatchDates(new Set())
      } else {
        setWatchDates(
          new Set(
            ((watchRes.data || []) as Array<{ watch_date: string }>).map((r) => r.watch_date)
          )
        )
      }

      const pricingMap: Record<
        string,
        { adultPrice: number; isSaleAvailable: boolean; choicesPricing: Record<string, unknown> }
      > = {}
      for (const row of pricingRes.data || []) {
        let choicesPricing: Record<string, unknown> = {}
        const raw = row.choices_pricing
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          choicesPricing = raw as Record<string, unknown>
        } else if (typeof raw === 'string') {
          try {
            choicesPricing = JSON.parse(raw) as Record<string, unknown>
          } catch {
            choicesPricing = {}
          }
        }
        pricingMap[row.date] = {
          adultPrice: Number(row.adult_price) || 0,
          isSaleAvailable: row.is_sale_available !== false,
          choicesPricing,
        }
      }
      setPricingByDate(pricingMap)

      const monthDates = buildCalendarDays(currentMonth)
        .filter((cell): cell is { day: number; date: string; isCurrentMonth: boolean } => !!cell)
        .map((cell) => cell.date)

      const tourRows = (toursRes.data || []) as Array<{
        id: string
        tour_date: string
        max_participants?: number | null
        tour_status?: string | null
        reservation_ids?: string[] | null
        product_id?: string | null
      }>
      const reservationRows = (reservationsRes.data || []) as Array<{
        id: string
        tour_date: string
        product_id?: string | null
        total_people?: number | null
        status?: string | null
      }>

      setInternalCapacityByDate(
        buildCapacityTotalsByDate(tourRows, reservationRows, selectedProductId, monthDates)
      )

      const reservationIds = reservationRows.map((row) => row.id).filter(Boolean)
      const choiceRowsFlat: Array<{
        reservation_id: string
        choiceKey: TourChoiceCountKey
        quantity: number
      }> = []

      if (reservationIds.length > 0) {
        const BATCH = 100
        for (let i = 0; i < reservationIds.length; i += BATCH) {
          const batchIds = reservationIds.slice(i, i + BATCH)
          const { data: rcData, error: rcError } = await supabase
            .from('reservation_choices')
            .select(
              'reservation_id, quantity, choice_options!inner(option_key, option_name_ko, option_name)'
            )
            .in('reservation_id', batchIds)

          if (rcError) {
            console.error('Price & Inventory reservation_choices load failed:', rcError)
            continue
          }

          for (const row of (rcData || []) as Array<{
            reservation_id: string | null
            quantity?: number | null
            choice_options?: {
              option_key?: string | null
              option_name_ko?: string | null
              option_name?: string | null
            } | null
          }>) {
            if (!row.reservation_id) continue
            const opt = row.choice_options
            choiceRowsFlat.push({
              reservation_id: row.reservation_id,
              choiceKey: choiceLabelToTourCountKey(
                opt?.option_name_ko ?? null,
                opt?.option_name ?? null,
                opt?.option_key ?? null
              ),
              quantity: Number(row.quantity) || 1,
            })
          }
        }
      }

      const choiceRowsByResId = new Map<string, ReservationChoiceRow[]>()
      for (const row of choiceRowsFlat) {
        const list = choiceRowsByResId.get(row.reservation_id) || []
        list.push({ choiceKey: row.choiceKey, quantity: row.quantity })
        choiceRowsByResId.set(row.reservation_id, list)
      }

      const tourIds = tourRows.map((tour) => tour.id).filter(Boolean)
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
            console.error('Price & Inventory ticket_bookings load failed:', tbError)
            continue
          }
          ticketBookingsRaw.push(...((tbData || []) as typeof ticketBookingsRaw))
        }
      }

      setCanyonReconByDate(
        buildDayCanyonReconByDate({
          tours: tourRows,
          reservations: reservationRows,
          choiceRowsByResId,
          ticketBookings: filterTicketBookingsExcludedFromMainUi(ticketBookingsRaw),
          productId: selectedProductId,
          dates: monthDates,
        })
      )
    } catch (error) {
      console.error('Price & Inventory load failed:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProductId, selectedChannelId, selectedVariantKey, selectedListingId, currentMonth])

  useEffect(() => {
    if (!isOpen || !selectedProductId || !selectedListingId) return
    void loadMonthData()
  }, [isOpen, selectedProductId, selectedListingId, currentMonth, loadMonthData])

  useEffect(() => {
    if (!selectedDate) return
    const row = inventoryByDate[selectedDate]
    const internal = internalCapacityByDate[selectedDate]
    const pricing = pricingByDate[selectedDate]
    const resolvedStatus = inferSaleStatus(
      row || null,
      pricing?.isSaleAvailable ?? true,
      internal?.totalSpotsLeft
    )
    setDraft({
      antelope_x_seats: row?.antelope_x_seats != null ? String(row.antelope_x_seats) : '',
      antelope_l_seats: row?.antelope_l_seats != null ? String(row.antelope_l_seats) : '',
      vehicle_seats: row?.vehicle_seats != null ? String(row.vehicle_seats) : '',
      sale_status: resolvedStatus,
      notes: row?.notes || '',
    })
  }, [selectedDate, inventoryByDate, internalCapacityByDate, pricingByDate])

  const toggleWatchDate = useCallback(
    async (date: string) => {
      if (!selectedProductId || !selectedChannelId || !selectedListingId) return

      const isWatched = watchDates.has(date)
      const next = new Set(watchDates)
      if (isWatched) next.delete(date)
      else next.add(date)
      setWatchDates(next)

      try {
        if (isWatched) {
          await fromUntypedTable(supabase, 'ota_inventory_watch_dates')
            .delete()
            .eq('product_id', selectedProductId)
            .eq('channel_id', selectedChannelId)
            .eq('variant_key', selectedVariantKey)
            .eq('watch_date', date)
        } else {
          await fromUntypedTable(supabase, 'ota_inventory_watch_dates').insert({
            ...operatorIdInsert(activeOperatorId),
            product_id: selectedProductId,
            channel_id: selectedChannelId,
            variant_key: selectedVariantKey,
            watch_date: date,
            marked_by_email: userEmail || null,
          })
        }
      } catch (error) {
        if (isMissingOtaTableError(error)) {
          setOtaTablesReady(false)
        } else {
          console.error('Watch date toggle failed:', error)
          void loadMonthData()
        }
      }
    },
    [
      activeOperatorId,
      loadMonthData,
      selectedChannelId,
      selectedListingId,
      selectedProductId,
      selectedVariantKey,
      userEmail,
      watchDates,
    ]
  )

  useEffect(() => {
    if (!statusMenuDate) return
    const close = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-status-menu-root]')) return
      setStatusMenuDate(null)
    }
    const timerId = window.setTimeout(() => {
      document.addEventListener('mousedown', close)
    }, 0)
    return () => {
      window.clearTimeout(timerId)
      document.removeEventListener('mousedown', close)
    }
  }, [statusMenuDate])

  const buildInventorySyncPayloads = useCallback(
    (
      date: string,
      existingRows: OtaChannelInventoryRow[],
      patch: (args: {
        listing: ChannelVariantListing
        isCurrent: boolean
        existing?: OtaChannelInventoryRow
        draftForCurrent?: typeof draft
      }) => Record<string, unknown>
    ) => {
      const existingByListingId = new Map<string, OtaChannelInventoryRow>()
      for (const row of existingRows) {
        existingByListingId.set(
          encodeChannelVariantListing(row.channel_id, row.variant_key || 'default'),
          row
        )
      }

      const updatedAt = new Date().toISOString()
      return channelVariantListings.map((listing) => {
        const isCurrent = listing.id === selectedListingId
        const existing = existingByListingId.get(listing.id)
        const base = {
          ...operatorIdInsert(activeOperatorId),
          product_id: selectedProductId,
          channel_id: listing.channelId,
          variant_key: listing.variantKey,
          inventory_date: date,
          updated_by_email: userEmail || null,
          updated_by_name: updaterName || null,
          updated_at: updatedAt,
        }
        return {
          ...base,
          ...patch({
            listing,
            isCurrent,
            ...(existing ? { existing } : {}),
            ...(isCurrent ? { draftForCurrent: draft } : {}),
          }),
        }
      })
    },
    [
      activeOperatorId,
      channelVariantListings,
      draft,
      selectedListingId,
      selectedProductId,
      updaterName,
      userEmail,
    ]
  )

  const resolveDraftSaleStatus = useCallback(
    (nextDraft: typeof draft, date: string): OtaSaleStatus => {
      const internal = internalCapacityByDate[date]
      const pricing = pricingByDate[date]
      return inferSaleStatus(
        {
          antelope_x_seats:
            nextDraft.antelope_x_seats === '' ? null : Number(nextDraft.antelope_x_seats),
          antelope_l_seats:
            nextDraft.antelope_l_seats === '' ? null : Number(nextDraft.antelope_l_seats),
          vehicle_seats:
            nextDraft.vehicle_seats === '' ? null : Number(nextDraft.vehicle_seats),
          sale_status: nextDraft.sale_status,
        },
        pricing?.isSaleAvailable ?? true,
        internal?.totalSpotsLeft
      )
    },
    [internalCapacityByDate, pricingByDate]
  )

  const syncSaleStatusForDate = useCallback(
    async (date: string, saleStatus: OtaSaleStatus) => {
      if (!selectedProductId || !selectedChannelId || channelVariantListings.length === 0) return
      setSavingStatusDate(date)
      try {
        const { data: existingRows, error: fetchError } = await fromUntypedTable(
          supabase,
          'ota_channel_inventory'
        )
          .select('*')
          .eq('product_id', selectedProductId)
          .eq('inventory_date', date)

        if (fetchError) throw fetchError

        const payloads = buildInventorySyncPayloads(
          date,
          (existingRows || []) as OtaChannelInventoryRow[],
          ({ existing }) => ({
            antelope_x_seats: existing?.antelope_x_seats ?? null,
            antelope_l_seats: existing?.antelope_l_seats ?? null,
            vehicle_seats: existing?.vehicle_seats ?? null,
            ota_synced_vehicle_seats: existing?.ota_synced_vehicle_seats ?? null,
            sale_status: saleStatus,
            notes: existing?.notes ?? null,
          })
        )

        const { data, error } = await fromUntypedTable(supabase, 'ota_channel_inventory')
          .upsert(payloads, { onConflict: 'product_id,channel_id,variant_key,inventory_date' })
          .select('*')
          .eq('product_id', selectedProductId)
          .eq('inventory_date', date)
          .eq('channel_id', selectedChannelId)
          .eq('variant_key', selectedVariantKey)

        if (error) throw error

        const currentRow = (data || []).find(
          (row: OtaChannelInventoryRow) =>
            row.channel_id === selectedChannelId &&
            (row.variant_key || 'default') === selectedVariantKey
        ) as OtaChannelInventoryRow | undefined

        if (currentRow) {
          setInventoryByDate((prev) => ({ ...prev, [date]: currentRow }))
        }

        await refreshInventoryForDate(date)
        await refreshClosureHistoryForDate(date)

        if (selectedDate === date) {
          setDraft((prev) => ({ ...prev, sale_status: saleStatus }))
        }

        setStatusMenuDate(null)
      } catch (error) {
        if (isMissingOtaTableError(error)) {
          setOtaTablesReady(false)
        } else {
          console.error('OTA sale status sync failed:', error)
        }
      } finally {
        setSavingStatusDate(null)
      }
    },
    [
      buildInventorySyncPayloads,
      channelVariantListings.length,
      refreshClosureHistoryForDate,
      refreshInventoryForDate,
      selectedChannelId,
      selectedDate,
      selectedProductId,
      selectedVariantKey,
    ]
  )

  // 내부·OTA 잔여 0석 → 매진, 4석 이하 → 잔여 적음 자동 동기화
  const autoStatusSyncInFlightRef = useRef<Set<string>>(new Set())

  const monthDates = useMemo(
    () =>
      buildCalendarDays(currentMonth)
        .filter((cell): cell is { day: number; date: string; isCurrentMonth: boolean } => !!cell)
        .map((cell) => cell.date),
    [currentMonth]
  )

  useEffect(() => {
    if (!isOpen || !otaTablesReady || loading || !selectedProductId) return
    if (channelVariantListings.length === 0) return

    let cancelled = false

    void (async () => {
      for (const date of monthDates) {
        if (cancelled) return

        const capacity = internalCapacityByDate[date]
        const inventory = inventoryByDate[date]
        const autoStatus = getAutoSaleStatusForDate(
          inventory || null,
          capacity?.totalSpotsLeft
        )
        if (!autoStatus) continue

        const pricing = pricingByDate[date]
        if (pricing && pricing.isSaleAvailable === false) continue

        const stored = inventoryByDate[date]?.sale_status
        if (stored === 'not_for_sale') continue
        if (stored === autoStatus) continue

        const syncKey = `${date}:${autoStatus}`
        if (autoStatusSyncInFlightRef.current.has(syncKey)) continue

        autoStatusSyncInFlightRef.current.add(syncKey)
        try {
          await syncSaleStatusForDate(date, autoStatus)
        } finally {
          autoStatusSyncInFlightRef.current.delete(syncKey)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    channelVariantListings.length,
    internalCapacityByDate,
    inventoryByDate,
    isOpen,
    loading,
    monthDates,
    otaTablesReady,
    pricingByDate,
    selectedProductId,
    syncSaleStatusForDate,
  ])

  const saveInventory = useCallback(async () => {
    if (!selectedDate || !selectedProductId || !selectedChannelId || !selectedListingId) return
    if (channelVariantListings.length === 0) return
    setSaving(true)
    try {
      const { data: existingRows, error: fetchError } = await fromUntypedTable(
        supabase,
        'ota_channel_inventory'
      )
        .select('*')
        .eq('product_id', selectedProductId)
        .eq('inventory_date', selectedDate)

      if (fetchError) throw fetchError

      const payloads = buildInventorySyncPayloads(
        selectedDate,
        (existingRows || []) as OtaChannelInventoryRow[],
        ({ isCurrent, existing, draftForCurrent }) => {
          const resolvedSaleStatus = resolveDraftSaleStatus(
            isCurrent && draftForCurrent ? draftForCurrent : draft,
            selectedDate
          )
          if (isCurrent && draftForCurrent) {
            return {
              antelope_x_seats:
                draftForCurrent.antelope_x_seats === ''
                  ? null
                  : Number(draftForCurrent.antelope_x_seats),
              antelope_l_seats:
                draftForCurrent.antelope_l_seats === ''
                  ? null
                  : Number(draftForCurrent.antelope_l_seats),
              vehicle_seats:
                draftForCurrent.vehicle_seats === ''
                  ? null
                  : Number(draftForCurrent.vehicle_seats),
              sale_status: resolvedSaleStatus,
              notes: draftForCurrent.notes.trim() || null,
            }
          }
          return {
            antelope_x_seats: existing?.antelope_x_seats ?? null,
            antelope_l_seats: existing?.antelope_l_seats ?? null,
            vehicle_seats: existing?.vehicle_seats ?? null,
            ota_synced_vehicle_seats: existing?.ota_synced_vehicle_seats ?? null,
            sale_status: resolvedSaleStatus,
            notes: existing?.notes ?? null,
          }
        }
      )

      const { data, error } = await fromUntypedTable(supabase, 'ota_channel_inventory')
        .upsert(payloads, { onConflict: 'product_id,channel_id,variant_key,inventory_date' })
        .select('*')
        .eq('product_id', selectedProductId)
        .eq('inventory_date', selectedDate)
        .eq('channel_id', selectedChannelId)
        .eq('variant_key', selectedVariantKey)

      if (error) throw error

      const currentRow = (data || []).find(
        (row: OtaChannelInventoryRow) =>
          row.channel_id === selectedChannelId &&
          (row.variant_key || 'default') === selectedVariantKey
      ) as OtaChannelInventoryRow | undefined

      if (currentRow) {
        setInventoryByDate((prev) => ({
          ...prev,
          [selectedDate]: currentRow,
        }))
      }

      await refreshInventoryForDate(selectedDate)
      await refreshClosureHistoryForDate(selectedDate)
    } catch (error) {
      if (isMissingOtaTableError(error)) {
        setOtaTablesReady(false)
      } else {
        console.error('OTA inventory save failed:', error)
      }
    } finally {
      setSaving(false)
    }
  }, [
    buildInventorySyncPayloads,
    channelVariantListings.length,
    draft,
    resolveDraftSaleStatus,
    refreshClosureHistoryForDate,
    refreshInventoryForDate,
    selectedChannelId,
    selectedDate,
    selectedListingId,
    selectedProductId,
    selectedVariantKey,
  ])

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth])

  const getDayMeta = useCallback(
    (date: string) => {
      const inventory = inventoryByDate[date]
      const pricing = pricingByDate[date]
      const canyonPrices = extractCanyonPricesFromRule(
        pricing?.choicesPricing,
        choiceCombinations,
        pricing?.adultPrice || 0
      )
      const internalCapacity = internalCapacityByDate[date]
      const status = inferSaleStatus(
        inventory || null,
        pricing?.isSaleAvailable ?? true,
        internalCapacity?.totalSpotsLeft
      )
      const isWatched = watchDates.has(date)
      const isStale =
        !!inventory?.updated_at &&
        dayjs().diff(dayjs(inventory.updated_at), 'hour') >= 24
      const otaVehicle = inventory?.vehicle_seats
      const vehicleRemaining =
        otaVehicle != null
          ? otaVehicle
          : internalCapacity != null
            ? internalCapacity.totalSpotsLeft
            : null
      const isLowVehicleRemaining = isVehicleRemainingLow(vehicleRemaining)
      const hasMismatch =
        otaVehicle != null &&
        internalCapacity != null &&
        Math.abs(otaVehicle - internalCapacity.totalSpotsLeft) >= 3

      return {
        inventory,
        pricing,
        canyonPrices,
        status,
        isWatched,
        isStale,
        internalCapacity,
        vehicleRemaining,
        isLowVehicleRemaining,
        hasMismatch,
        canyonRecon: canyonReconByDate[date],
        canyonReconBadges: formatCanyonReconBadges(canyonReconByDate[date]),
      }
    },
    [choiceCombinations, canyonReconByDate, inventoryByDate, internalCapacityByDate, pricingByDate, watchDates]
  )

  const selectedMeta = selectedDate ? getDayMeta(selectedDate) : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(98vw,1536px)] max-w-none flex-col gap-0 overflow-hidden p-0"
        forceZIndex={11050}
      >
        <DialogHeader className="border-b px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <DollarSign className="h-5 w-5 text-primary" aria-hidden />
                Price &amp; Inventory
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                OTA 채널별 가격·잔여 좌석 수동 추적 (날짜 숫자 클릭 → 주시 날짜 지정)
              </p>
              {!otaTablesReady ? (
                <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  OTA 재고 테이블이 아직 없습니다. Supabase에{' '}
                  <code className="rounded bg-amber-100 px-1">20260719530000_ota_channel_inventory.sql</code>{' '}
                  마이그레이션을 적용해 주세요. 가격은 표시되지만 재고 저장은 불가합니다.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="h-10 w-[180px] sm:w-[220px]">
                  <SelectValue placeholder="상품 선택" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_ko || p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                <SelectTrigger className="h-10 w-[200px] sm:w-[280px]">
                  <SelectValue placeholder="채널 · Variant" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,320px)]">
                  {channelVariantListings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.displayLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => void loadMonthData()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-medium hover:bg-muted/50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                새로고침
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth((m) => dayjs(m).subtract(1, 'month').toDate())
                  }
                  className="rounded-lg p-2 hover:bg-muted"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="min-w-[120px] text-center text-base font-semibold">
                  {dayjs(currentMonth).format('YYYY년 M월')}
                </h3>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((m) => dayjs(m).add(1, 'month').toDate())}
                  className="rounded-lg p-2 hover:bg-muted"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(dayjs().startOf('month').toDate())}
                  className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  오늘
                </button>
              </div>
              <div className="hidden flex-wrap gap-2 sm:flex">
                {Object.values(OTA_STATUS_META).map((meta) => (
                  <span
                    key={meta.label}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                    {meta.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <div className="mb-1 grid grid-cols-7 gap-1">
                {weekDays.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} className="min-h-[130px]" />

                  const meta = getDayMeta(cell.date)

                  const statusMeta = OTA_STATUS_META[meta.status]
                  const updater = getUpdaterDisplayName(meta.inventory, teamMembers)
                  const updatedStamp = formatOtaUpdateStamp(meta.inventory?.updated_at)
                  const isSelected = selectedDate === cell.date
                  const isToday = cell.date === dayjs().format('YYYY-MM-DD')

                  const cellSurfaceClass = meta.isWatched
                    ? isToday
                      ? 'border-2 border-primary bg-amber-50 shadow-md shadow-primary/10'
                      : 'bg-amber-50 border-amber-300'
                    : isToday
                      ? 'border-2 border-primary bg-sky-50 shadow-md shadow-primary/15'
                      : 'bg-white border-border/70'

                  const cellFocusClass = isSelected
                    ? 'ring-2 ring-primary ring-offset-2'
                    : isToday
                      ? 'ring-2 ring-primary/35 ring-offset-1'
                      : 'hover:shadow-sm'

                  const isStatusMenuOpen = statusMenuDate === cell.date
                  const isSavingStatus = savingStatusDate === cell.date
                  const closureListings = getClosureListingsForDate(cell.date, meta.status)
                  const internalRemaining = meta.internalCapacity?.totalSpotsLeft

                  return (
                    <div
                      key={cell.date}
                      role="button"
                      tabIndex={0}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={isToday ? `${cell.day}일, 오늘` : `${cell.day}일`}
                      onClick={() => {
                        setStatusMenuDate(null)
                        setSelectedDate(cell.date)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedDate(cell.date)
                        }
                      }}
                      className={[
                        'relative min-h-[130px] cursor-pointer rounded-xl border p-1.5 text-left transition-all',
                        cellSurfaceClass,
                        cellFocusClass,
                        meta.isLowVehicleRemaining
                          ? 'shadow-[inset_0_0_0_2px] shadow-red-400/80'
                          : '',
                      ].join(' ')}
                    >
                      <div className="mb-1 flex items-start justify-between gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleWatchDate(cell.date)
                          }}
                          className={[
                            'inline-flex h-6 min-w-[1.5rem] items-center justify-center gap-0.5 rounded-md px-1 text-xs font-bold',
                            meta.isWatched
                              ? 'bg-amber-200 text-amber-950'
                              : isToday
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-foreground hover:bg-muted',
                          ].join(' ')}
                          title="클릭하여 주시 날짜 지정/해제"
                          aria-label={
                            meta.isWatched
                              ? `${cell.day}일 주시 해제`
                              : isToday
                                ? `${cell.day}일, 오늘 — 주시 지정`
                                : `${cell.day}일 주시 지정`
                          }
                        >
                          {meta.isWatched ? (
                            <Star className="h-3 w-3 shrink-0 fill-amber-600 text-amber-600" aria-hidden />
                          ) : null}
                          {cell.day}
                        </button>
                        <div
                          className="relative flex shrink-0 flex-col items-end gap-0.5"
                          data-status-menu-root
                        >
                          {isToday ? (
                            <span className="rounded bg-primary px-1 py-0.5 text-[8px] font-bold leading-none text-primary-foreground">
                              오늘
                            </span>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSavingStatus || !otaTablesReady}
                            onClick={(e) => {
                              e.stopPropagation()
                              setStatusMenuDate((prev) =>
                                prev === cell.date ? null : cell.date
                              )
                            }}
                            className={[
                              'rounded border px-1 py-0.5 text-[9px] font-semibold leading-none transition-colors',
                              'hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              statusMeta.badgeClass,
                              isStatusMenuOpen ? 'ring-2 ring-primary ring-offset-1' : '',
                              isSavingStatus ? 'opacity-60' : '',
                            ].join(' ')}
                            title="클릭하여 판매 상태 변경 (모든 채널 동기화)"
                            aria-label={`${cell.day}일 판매 상태 ${statusMeta.label}, 클릭하여 변경`}
                            aria-expanded={isStatusMenuOpen}
                            aria-haspopup="menu"
                          >
                            {isSavingStatus ? '…' : statusMeta.label}
                          </button>
                          {isStatusMenuOpen ? (
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-30 mt-0.5 min-w-[88px] overflow-hidden rounded-lg border border-border bg-white py-0.5 shadow-lg"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {(Object.keys(OTA_STATUS_META) as OtaSaleStatus[]).map((key) => {
                                const optionMeta = OTA_STATUS_META[key]
                                const isActive = meta.status === key
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    role="menuitem"
                                    disabled={isSavingStatus}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void syncSaleStatusForDate(cell.date, key)
                                    }}
                                    className={[
                                      'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[10px] font-medium hover:bg-muted',
                                      isActive ? 'bg-muted/80' : '',
                                    ].join(' ')}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${optionMeta.dotClass}`}
                                      aria-hidden
                                    />
                                    {optionMeta.label}
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mb-1 flex flex-wrap gap-0.5">
                        {(['X', 'L'] as const).map((key) => {
                          const price = meta.canyonPrices[key]
                          if (!price) return null
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-800"
                            >
                              🏜️ {key} ${Math.round(price)}
                            </span>
                          )
                        })}
                      </div>

                      <div className="mb-1 flex flex-wrap gap-0.5">
                        {meta.internalCapacity ? (
                          <span
                            className={[
                              'inline-flex rounded px-1 py-0.5 text-[9px] font-medium tabular-nums',
                              meta.isLowVehicleRemaining
                                ? 'animate-pulse border border-red-400 bg-red-100 font-bold text-red-900 shadow-sm'
                                : 'bg-blue-50 text-blue-900',
                            ].join(' ')}
                            title={
                              meta.isLowVehicleRemaining
                                ? `차량 잔여 ${meta.vehicleRemaining}석 — 잔여 부족`
                                : undefined
                            }
                          >
                            🚌 {meta.internalCapacity.totalAssigned} / {meta.internalCapacity.totalMax}
                            {meta.isLowVehicleRemaining ? (
                              <span className="ml-0.5 text-[8px] font-bold text-red-700">
                                (잔여 {meta.vehicleRemaining})
                              </span>
                            ) : null}
                            {meta.hasMismatch ? ' ⚠️' : ''}
                          </span>
                        ) : null}
                        {meta.canyonReconBadges.map((badge) => (
                          <span
                            key={badge.key}
                            title={
                              badge.mismatch
                                ? '예약 초이스와 입장권 부킹 수가 다릅니다'
                                : '예약 초이스 / 입장권 부킹'
                            }
                            className={[
                              'inline-flex rounded px-1 py-0.5 text-[9px] font-medium tabular-nums',
                              badge.mismatch
                                ? 'border border-amber-300 bg-amber-50 text-amber-950'
                                : 'bg-orange-50 text-orange-900',
                            ].join(' ')}
                          >
                            {badge.text}
                            {badge.mismatch ? ' ⚠️' : ''}
                          </span>
                        ))}
                      </div>

                      {closureListings.length > 0 ? (
                        <div className="mb-0.5 flex flex-wrap items-center gap-1">
                          {closureListings.map((listing) => {
                            const inventoryRow = inventoryByListingAndDate[listing.id]?.[cell.date]
                            const currentRemaining = resolveVehicleRemaining(
                              inventoryRow,
                              internalRemaining
                            )
                            if (currentRemaining == null) return null
                            const historyEntries = resolveClosureHistoryEntries(
                              closureHistoryByListingAndDate[listing.id]?.[cell.date],
                              inventoryRow
                            )
                            const syncKey = `${listing.id}:${cell.date}`
                            const faviconUrl = faviconByChannelId.get(listing.channelId)
                            return (
                              <OtaClosureChannelButton
                                key={listing.id}
                                listing={listing}
                                {...(faviconUrl ? { faviconUrl } : {})}
                                currentRemaining={currentRemaining}
                                saving={syncingOtaKey === syncKey}
                                historyEntries={historyEntries}
                                teamMembers={teamMembers}
                                onMarkSynced={() => {
                                  void markOtaSiteSynced(cell.date, listing)
                                }}
                              />
                            )
                          })}
                        </div>
                      ) : null}

                      {updater || updatedStamp ? (
                        <p className="truncate text-[9px] leading-tight text-muted-foreground">
                          {updater}
                          {updater && updatedStamp ? ', ' : ''}
                          {updatedStamp}
                        </p>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/60">미기록</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedDate && selectedMeta ? (
              <div className="border-t bg-slate-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {dayjs(selectedDate).format('M월 D일 (ddd)')} — OTA 재고 업데이트
                    </p>
                    {selectedListing ? (
                      <p className="text-xs text-muted-foreground">{selectedListing.displayLabel}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {selectedMeta.internalCapacity ? (
                        <>
                          내부 배정: 🚌 {selectedMeta.internalCapacity.totalAssigned} /{' '}
                          {selectedMeta.internalCapacity.totalMax}
                          {' — '}
                          {selectedMeta.internalCapacity.totalSpotsLeft}명 추가 가능
                        </>
                      ) : (
                        <>내부 배정 투어 없음</>
                      )}
                      {selectedMeta.hasMismatch ? (
                        <span className="ml-2 text-orange-600">⚠️ OTA 차량 잔여와 차이 있음</span>
                      ) : null}
                      {selectedMeta.canyonReconBadges.length > 0 ? (
                        <span className="ml-2">
                          {selectedMeta.canyonReconBadges.map((badge) => (
                            <span
                              key={badge.key}
                              className={[
                                'mr-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                                badge.mismatch
                                  ? 'border border-amber-300 bg-amber-50 text-amber-950'
                                  : 'bg-orange-50 text-orange-900',
                              ].join(' ')}
                            >
                              {badge.text}
                              {badge.mismatch ? ' ⚠️' : ''}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="rounded-lg p-1.5 hover:bg-muted"
                    aria-label="패널 닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      🏜️ X 잔여
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft.antelope_x_seats}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, antelope_x_seats: e.target.value }))
                      }
                      className="h-10 w-full rounded-lg border border-input px-3"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      🏜️ L 잔여
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft.antelope_l_seats}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, antelope_l_seats: e.target.value }))
                      }
                      className="h-10 w-full rounded-lg border border-input px-3"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      🚌 차량 잔여
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft.vehicle_seats}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = { ...d, vehicle_seats: e.target.value }
                          if (!selectedDate) return next
                          return {
                            ...next,
                            sale_status: resolveDraftSaleStatus(next, selectedDate),
                          }
                        })
                      }
                      className="h-10 w-full rounded-lg border border-input px-3"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      판매 상태
                    </span>
                    <select
                      value={draft.sale_status}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          sale_status: e.target.value as OtaSaleStatus,
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-input px-3"
                    >
                      {Object.entries(OTA_STATUS_META).map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      저장 시 모든 채널·Variant에 동일하게 적용됩니다
                    </span>
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      OTA 반영 메모
                    </span>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                      placeholder="예: Klook에 14석으로 업데이트 완료"
                      className="h-10 w-full rounded-lg border border-input px-3"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveInventory()}
                    disabled={saving || !otaTablesReady}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? '저장 중…' : 'OTA 재고 저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => {
                        const next = {
                          ...d,
                          vehicle_seats:
                            selectedMeta.internalCapacity &&
                            selectedMeta.internalCapacity.totalSpotsLeft >= 0
                              ? String(selectedMeta.internalCapacity.totalSpotsLeft)
                              : d.vehicle_seats,
                        }
                        if (!selectedDate) return next
                        return {
                          ...next,
                          sale_status: resolveDraftSaleStatus(next, selectedDate),
                        }
                      })
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm hover:bg-white"
                  >
                    <Calendar className="h-4 w-4" aria-hidden />
                    내부 잔여석 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleWatchDate(selectedDate)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm hover:bg-white"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    {watchDates.has(selectedDate) ? '주시 해제' : '주시 지정'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
      </DialogContent>
    </Dialog>
  )
}
