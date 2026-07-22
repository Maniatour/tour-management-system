import dayjs from 'dayjs'
import { findChoicePricingData } from '@/utils/choicePricingMatcher'
import { choiceLabelToTourCountKey } from '@/lib/tourChoiceCounts'

export type OtaSaleStatus = 'on_sale' | 'low' | 'sold_out' | 'not_for_sale'

export type CanyonPriceKey = 'X' | 'L'

export interface OtaChannelInventoryRow {
  id?: string
  product_id: string
  channel_id: string
  variant_key?: string
  inventory_date: string
  antelope_x_seats: number | null
  antelope_l_seats: number | null
  vehicle_seats: number | null
  ota_synced_vehicle_seats?: number | null
  sale_status: OtaSaleStatus
  notes?: string | null
  updated_by_email?: string | null
  updated_by_name?: string | null
  updated_at?: string | null
}

export interface OtaChannelInventoryHistoryRow {
  id?: string
  product_id: string
  channel_id: string
  variant_key?: string
  inventory_date: string
  sale_status?: OtaSaleStatus | null
  antelope_x_seats?: number | null
  antelope_l_seats?: number | null
  vehicle_seats?: number | null
  ota_synced_vehicle_seats?: number | null
  notes?: string | null
  updated_by_email?: string | null
  updated_by_name?: string | null
  recorded_at: string
}

export interface ChoiceCombinationLite {
  id: string
  combination_key?: string
  combination_name?: string
  combination_name_ko?: string
  adult_price?: number
  combination_details?: Array<{
    groupId: string
    optionId: string
    optionKey?: string
    optionName?: string
    optionNameKo?: string
  }>
}

export interface DayPricingInfo {
  adultPrice: number
  isSaleAvailable: boolean
  canyonPrices: Partial<Record<CanyonPriceKey, number>>
}

const LOW_SEAT_THRESHOLD = 5

/** 예약 반영 잔여 좌석이 이 값 이하이면 자동으로 잔여 적음 */
export const AUTO_LOW_REMAINING_THRESHOLD = 4

/** 차량 잔여 좌석 3석 이하일 때만 달력 강조 */
export const VEHICLE_REMAINING_HIGHLIGHT_THRESHOLD = 3

export function isVehicleRemainingLow(remaining: number | null | undefined): boolean {
  if (remaining == null || !Number.isFinite(remaining)) return false
  return remaining <= VEHICLE_REMAINING_HIGHLIGHT_THRESHOLD
}

/** 달력 🚌 잔여와 동일: OTA 수동값 우선, 없으면 내부 잔여 */
export function resolveVehicleRemaining(
  inventory: Pick<OtaChannelInventoryRow, 'vehicle_seats'> | null | undefined,
  internalSpotsLeft?: number | null
): number | null {
  const otaVehicle = inventory?.vehicle_seats
  if (otaVehicle != null && Number.isFinite(otaVehicle)) return otaVehicle
  if (internalSpotsLeft != null && Number.isFinite(internalSpotsLeft)) return internalSpotsLeft
  return null
}

export function resolveDefaultGoblinProductId(
  products: Array<{ id: string; name?: string | null; name_ko?: string | null }>
): string {
  const byId = products.find((p) => p.id === 'MDGCSUNRISE')
  if (byId) return byId.id
  const byName = products.find((p) => {
    const label = `${p.name_ko || ''} ${p.name || ''}`
    return label.includes('도깨비')
  })
  return byName?.id || products[0]?.id || ''
}

export function resolveDefaultOtaChannelId(
  channels: Array<{ id: string; name?: string | null; type?: string | null }>
): string {
  const otaChannels = channels.filter((c) => (c.type || '').toLowerCase() === 'ota')
  const klook = otaChannels.find((c) => /klook/i.test(c.name || ''))
  return klook?.id || otaChannels[0]?.id || ''
}

/** GetYourGuide (GYG) 채널 여부 */
export function isGetYourGuideChannel(
  channelId: string,
  channelName?: string | null
): boolean {
  const id = channelId.toLowerCase()
  const name = (channelName || '').toLowerCase()
  return (
    id === 'getyourguide' ||
    /getyourguide|(^|[^a-z])gyg([^a-z]|$)/i.test(id) ||
    /getyourguide|(^|[^a-z])gyg([^a-z]|$)/i.test(name)
  )
}

/** Klook 채널 여부 */
export function isKlookChannel(channelId: string, channelName?: string | null): boolean {
  const id = channelId.toLowerCase()
  const name = (channelName || '').toLowerCase()
  return id === 'klook' || /klook/.test(id) || /klook|클룩/.test(name)
}

/** OTA 플랫폼에서 마감·잔여조정 설정이 필요한 판매 상태 */
export function requiresOtaPlatformClosure(status: OtaSaleStatus): boolean {
  return status === 'sold_out' || status === 'low'
}

/** 예약 저장 후 Price & Inventory 모달을 열어야 하는 잔여 좌석 조건 */
export function shouldOpenPriceInventoryForRemaining(
  spotsLeftAfter: number | null | undefined,
  spotsLeftBefore?: number | null
): boolean {
  if (spotsLeftAfter == null || !Number.isFinite(spotsLeftAfter)) return false
  if (spotsLeftAfter <= AUTO_LOW_REMAINING_THRESHOLD) return true
  if (
    spotsLeftBefore != null &&
    Number.isFinite(spotsLeftBefore) &&
    spotsLeftBefore > AUTO_LOW_REMAINING_THRESHOLD &&
    spotsLeftAfter <= AUTO_LOW_REMAINING_THRESHOLD
  ) {
    return true
  }
  return false
}

/** OTA 사이트에 현재 잔여 좌석을 아직 반영하지 않았는지 */
export function needsOtaRemainingSiteUpdate(
  row: OtaChannelInventoryRow | null | undefined,
  currentRemaining: number | null | undefined
): boolean {
  if (currentRemaining == null || !Number.isFinite(currentRemaining)) return false
  if (row?.ota_synced_vehicle_seats == null || !Number.isFinite(row.ota_synced_vehicle_seats)) {
    return true
  }
  return row.ota_synced_vehicle_seats !== currentRemaining
}

/** @deprecated needsOtaRemainingSiteUpdate 사용 */
export function isOtaClosureAcknowledged(row?: OtaChannelInventoryRow | null): boolean {
  return row?.ota_synced_vehicle_seats != null
}

/** GYG 1건 + Klook 전체 variant */
export function getOtaClosureTargetListings(
  listings: ChannelVariantListing[]
): ChannelVariantListing[] {
  const gyg = listings.find((listing) =>
    isGetYourGuideChannel(listing.channelId, listing.channelName)
  )
  const klookVariants = listings.filter((listing) =>
    isKlookChannel(listing.channelId, listing.channelName)
  )
  const result: ChannelVariantListing[] = []
  if (gyg) result.push(gyg)
  result.push(...klookVariants)
  return result
}

export function abbreviateKlookVariantLabel(
  variantKey: string,
  variantLabel: string
): string {
  const label = `${variantLabel} ${variantKey}`.toLowerCase()
  if (/korean|한국/.test(label)) return '🇰🇷'
  if (/all.?inclusive|올인|전체\s*포함/.test(label)) return '✅'
  if (/exclusion|불포함/.test(label)) return '➕'
  if (variantLabel.length <= 3) return variantLabel
  return variantLabel.slice(0, 2)
}

export const CHANNEL_VARIANT_KEY_SEP = '::'

export interface ChannelVariantListing {
  id: string
  channelId: string
  channelName: string
  variantKey: string
  variantLabel: string
  displayLabel: string
}

export function encodeChannelVariantListing(channelId: string, variantKey: string): string {
  return `${channelId}${CHANNEL_VARIANT_KEY_SEP}${variantKey || 'default'}`
}

export function decodeChannelVariantListing(listingId: string): {
  channelId: string
  variantKey: string
} {
  const sep = listingId.indexOf(CHANNEL_VARIANT_KEY_SEP)
  if (sep === -1) {
    return { channelId: listingId, variantKey: 'default' }
  }
  return {
    channelId: listingId.slice(0, sep),
    variantKey: listingId.slice(sep + CHANNEL_VARIANT_KEY_SEP.length) || 'default',
  }
}

export function formatVariantLabel(
  variantNameKo?: string | null,
  variantNameEn?: string | null,
  variantKey?: string | null
): string {
  return (
    variantNameKo?.trim() ||
    variantNameEn?.trim() ||
    variantKey?.trim() ||
    'default'
  )
}

export function buildChannelVariantListings(
  channels: Array<{ id: string; name?: string | null; type?: string | null }>,
  channelProducts: Array<{
    channel_id: string
    variant_key?: string | null
    variant_name_ko?: string | null
    variant_name_en?: string | null
  }>,
  extraVariantsByChannel: Record<string, string[]> = {}
): ChannelVariantListing[] {
  const otaChannelIds = new Set(
    channels
      .filter((c) => (c.type || '').toLowerCase() === 'ota')
      .map((c) => c.id)
  )
  const channelNameById = new Map(channels.map((c) => [c.id, c.name || c.id]))

  const byChannel = new Map<string, Map<string, ChannelVariantListing>>()

  for (const row of channelProducts) {
    if (!otaChannelIds.has(row.channel_id)) continue
    const variantKey = row.variant_key?.trim() || 'default'
    const variantLabel = formatVariantLabel(
      row.variant_name_ko,
      row.variant_name_en,
      variantKey
    )
    const channelName = channelNameById.get(row.channel_id) || row.channel_id
    if (!byChannel.has(row.channel_id)) byChannel.set(row.channel_id, new Map())
    byChannel.get(row.channel_id)!.set(variantKey, {
      id: encodeChannelVariantListing(row.channel_id, variantKey),
      channelId: row.channel_id,
      channelName,
      variantKey,
      variantLabel,
      displayLabel: `${channelName} · ${variantLabel}`,
    })
  }

  for (const [channelId, variantKeys] of Object.entries(extraVariantsByChannel)) {
    if (!otaChannelIds.has(channelId)) continue
    const channelName = channelNameById.get(channelId) || channelId
    if (!byChannel.has(channelId)) byChannel.set(channelId, new Map())
    const bucket = byChannel.get(channelId)!
    for (const variantKey of variantKeys) {
      const key = variantKey || 'default'
      if (bucket.has(key)) continue
      bucket.set(key, {
        id: encodeChannelVariantListing(channelId, key),
        channelId,
        channelName,
        variantKey: key,
        variantLabel: key,
        displayLabel: `${channelName} · ${key}`,
      })
    }
  }

  // OTA 채널이지만 variant가 없는 경우 default 1건
  for (const channelId of otaChannelIds) {
    if (byChannel.has(channelId)) continue
    const channelName = channelNameById.get(channelId) || channelId
    byChannel.set(channelId, new Map([
      [
        'default',
        {
          id: encodeChannelVariantListing(channelId, 'default'),
          channelId,
          channelName,
          variantKey: 'default',
          variantLabel: 'default',
          displayLabel: `${channelName} · default`,
        },
      ],
    ]))
  }

  return Array.from(byChannel.values())
    .flatMap((m) => Array.from(m.values()))
    .sort((a, b) =>
      a.channelName.localeCompare(b.channelName, 'ko') ||
      a.variantLabel.localeCompare(b.variantLabel, 'ko')
    )
}

export function resolveDefaultChannelVariantListing(
  listings: ChannelVariantListing[]
): string {
  if (listings.length === 0) return ''
  const klookAllInclusive = listings.find(
    (l) =>
      /klook/i.test(l.channelName) &&
      (/전체\s*포함|all[\s-]*inclusive/i.test(l.variantLabel) ||
        /전체\s*포함|all[\s-]*inclusive/i.test(l.displayLabel))
  )
  if (klookAllInclusive) return klookAllInclusive.id
  const klook = listings.find((l) => /klook/i.test(l.channelName))
  if (klook) return klook.id
  return listings[0]!.id
}

export function getCanyonKeyFromCombination(combination: ChoiceCombinationLite): CanyonPriceKey | null {
  const details = combination.combination_details || []
  for (const detail of details) {
    const key = choiceLabelToTourCountKey(
      detail.optionNameKo || null,
      detail.optionName || null,
      detail.optionKey || null
    )
    if (key === 'X' || key === 'L') return key
  }

  const label = `${combination.combination_name_ko || ''} ${combination.combination_name || ''}`
  const fromLabel = choiceLabelToTourCountKey(label, label, combination.combination_key || null)
  if (fromLabel === 'X' || fromLabel === 'L') return fromLabel
  return null
}

export function extractCanyonPricesFromRule(
  choicesPricing: Record<string, unknown> | null | undefined,
  choiceCombinations: ChoiceCombinationLite[],
  fallbackAdultPrice = 0
): Partial<Record<CanyonPriceKey, number>> {
  const result: Partial<Record<CanyonPriceKey, number>> = {}
  const pricing = (choicesPricing || {}) as Record<string, Record<string, unknown>>

  for (const combination of choiceCombinations) {
    const canyonKey = getCanyonKeyFromCombination(combination)
    if (!canyonKey || result[canyonKey] != null) continue

    const { data } = findChoicePricingData(combination, pricing)
    const adult =
      Number((data as { adult_price?: number })?.adult_price) ||
      Number((data as { ota_sale_price?: number })?.ota_sale_price) ||
      Number(combination.adult_price) ||
      fallbackAdultPrice

    if (adult > 0) result[canyonKey] = adult
  }

  return result
}

export function inferSaleStatus(
  inventory: Pick<OtaChannelInventoryRow, 'antelope_x_seats' | 'antelope_l_seats' | 'vehicle_seats' | 'sale_status'> | null,
  isSaleAvailable = true,
  internalSpotsLeft?: number | null
): OtaSaleStatus {
  if (!isSaleAvailable) return 'not_for_sale'

  const autoStatus = getAutoSaleStatusForDate(inventory, internalSpotsLeft)
  if (autoStatus) return autoStatus

  if (!inventory) return isSaleAvailable ? 'on_sale' : 'not_for_sale'

  const seats = [
    inventory.antelope_x_seats,
    inventory.antelope_l_seats,
    inventory.vehicle_seats,
  ].filter((v): v is number => v != null)

  if (seats.length === 0) {
    return inventory.sale_status || (isSaleAvailable ? 'on_sale' : 'not_for_sale')
  }

  const total = seats.reduce((sum, n) => sum + Math.max(0, n), 0)
  if (total === 0) return 'sold_out'
  if (seats.some((n) => n >= 0 && n <= LOW_SEAT_THRESHOLD)) return 'low'
  return inventory.sale_status === 'not_for_sale' ? 'not_for_sale' : 'on_sale'
}

/** 예약·OTA 잔여 기준 자동 판매 상태 (매진 0석 / 잔여 적음 4석 이하) */
export function getAutoSaleStatusForDate(
  inventory: Pick<OtaChannelInventoryRow, 'vehicle_seats'> | null | undefined,
  internalSpotsLeft?: number | null
): OtaSaleStatus | null {
  if (internalSpotsLeft != null && Number.isFinite(internalSpotsLeft) && internalSpotsLeft === 0) {
    return 'sold_out'
  }

  const otaVehicle = inventory?.vehicle_seats
  if (otaVehicle != null && Number.isFinite(otaVehicle) && otaVehicle === 0) {
    return 'sold_out'
  }

  const remaining = resolveVehicleRemaining(inventory, internalSpotsLeft)
  if (remaining == null || !Number.isFinite(remaining)) return null
  if (remaining <= AUTO_LOW_REMAINING_THRESHOLD) return 'low'
  return null
}

/** @deprecated getAutoSaleStatusForDate 사용 */
export function getAutoSaleStatusFromInternalRemaining(
  internalSpotsLeft: number | null | undefined
): OtaSaleStatus | null {
  return getAutoSaleStatusForDate(null, internalSpotsLeft)
}

export function formatOtaUpdateStamp(updatedAt?: string | null): string {
  if (!updatedAt) return ''
  return dayjs(updatedAt).format('MM/DD hh:mma')
}

export function getMonthDateRange(month: Date): { start: string; end: string } {
  const start = dayjs(month).startOf('month').format('YYYY-MM-DD')
  const end = dayjs(month).endOf('month').format('YYYY-MM-DD')
  return { start, end }
}

export function buildCalendarDays(month: Date): Array<{ day: number; date: string; isCurrentMonth: boolean } | null> {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  const days: Array<{ day: number; date: string; isCurrentMonth: boolean } | null> = []

  for (let i = 0; i < startingDayOfWeek; i++) days.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({ day, date, isCurrentMonth: true })
  }
  return days
}

export const OTA_STATUS_META: Record<
  OtaSaleStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  on_sale: {
    label: '판매중',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  low: {
    label: '잔여 적음',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  sold_out: {
    label: '매진',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
  },
  not_for_sale: {
    label: '판매 안함',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
}

export function formatClosureHistoryActor(
  row: Pick<OtaChannelInventoryHistoryRow, 'updated_by_name' | 'updated_by_email'>,
  teamMembers: Array<{ email: string; nick_name?: string | null; name_ko?: string | null }> = []
): string {
  if (row.updated_by_name?.trim()) return row.updated_by_name.trim()
  if (row.updated_by_email) {
    const member = teamMembers.find((m) => m.email === row.updated_by_email)
    return member?.nick_name || member?.name_ko || row.updated_by_email.split('@')[0] || '알 수 없음'
  }
  return '알 수 없음'
}

export function formatClosureHistoryDetail(row: OtaChannelInventoryHistoryRow): string {
  const parts: string[] = []
  if (row.ota_synced_vehicle_seats != null) {
    parts.push(`OTA 사이트 ${row.ota_synced_vehicle_seats}석 반영`)
  }
  if (row.sale_status) {
    parts.push(OTA_STATUS_META[row.sale_status]?.label || row.sale_status)
  }
  if (row.vehicle_seats != null) parts.push(`🚌 ${row.vehicle_seats}`)
  if (row.antelope_x_seats != null) parts.push(`X ${row.antelope_x_seats}`)
  if (row.antelope_l_seats != null) parts.push(`L ${row.antelope_l_seats}`)
  if (row.notes?.trim()) parts.push(row.notes.trim())
  return parts.length > 0 ? parts.join(' · ') : '변경 기록'
}

export function formatOtaHistoryListingShortLabel(listing: ChannelVariantListing): string {
  if (isGetYourGuideChannel(listing.channelId, listing.channelName)) {
    return 'GYG'
  }

  if (isKlookChannel(listing.channelId, listing.channelName)) {
    const label = `${listing.variantLabel} ${listing.variantKey}`.toLowerCase()
    if (/korean|한국|\bkr\b/.test(label)) return 'Klook kr'
    if (/all.?inclusive|올인|전체\s*포함|exclusion|불포함/.test(label)) return 'Klook +'
    const abbr = abbreviateKlookVariantLabel(listing.variantKey, listing.variantLabel)
    if (abbr === '🇰🇷') return 'Klook kr'
    if (abbr === '➕' || abbr === '✅') return 'Klook +'
    const variantShort = listing.variantLabel.trim() || listing.variantKey
    return variantShort ? `Klook ${variantShort}` : 'Klook'
  }

  const channelName = (listing.channelName || listing.channelId).trim()
  if (listing.variantKey && listing.variantKey !== 'default') {
    const variantShort = listing.variantLabel.trim() || listing.variantKey
    return variantShort ? `${channelName} ${variantShort}` : channelName
  }
  return channelName
}

export type OtaHistoryHoverItem = {
  row: OtaChannelInventoryHistoryRow
  listingLabel: string
}

export function formatOtaHistoryHoverLine(
  item: OtaHistoryHoverItem,
  teamMembers: Array<{ email: string; nick_name?: string | null; name_ko?: string | null }> = []
): string {
  const { row, listingLabel } = item
  const actor = formatClosureHistoryActor(row, teamMembers)
  const stamp = formatOtaUpdateStamp(row.recorded_at)
  const seats =
    row.ota_synced_vehicle_seats != null
      ? row.ota_synced_vehicle_seats
      : row.vehicle_seats != null
        ? row.vehicle_seats
        : null
  const seatsPart = seats != null ? `${seats}석 반영` : '반영'
  const statusPart = row.sale_status
    ? OTA_STATUS_META[row.sale_status]?.label || row.sale_status
    : ''
  return `${actor} ${stamp} - ${listingLabel} ${seatsPart}${statusPart ? ` - ${statusPart}` : ''}`
}

export function buildAllChannelHistoryForDate(
  date: string,
  listings: ChannelVariantListing[],
  historyByListingAndDate: Record<string, Record<string, OtaChannelInventoryHistoryRow[]>>,
  inventoryByListingAndDate: Record<string, Record<string, OtaChannelInventoryRow>>
): OtaHistoryHoverItem[] {
  const result: OtaHistoryHoverItem[] = []

  for (const listing of listings) {
    const history = historyByListingAndDate[listing.id]?.[date]
    const inventory = inventoryByListingAndDate[listing.id]?.[date]
    const entries = resolveClosureHistoryEntries(history, inventory)
    const listingLabel = formatOtaHistoryListingShortLabel(listing)
    for (const row of entries) {
      result.push({ row, listingLabel })
    }
  }

  return result.sort(
    (a, b) => dayjs(b.row.recorded_at).valueOf() - dayjs(a.row.recorded_at).valueOf()
  )
}

export function buildClosureHistoryByListingAndDate(
  rows: OtaChannelInventoryHistoryRow[]
): Record<string, Record<string, OtaChannelInventoryHistoryRow[]>> {
  const result: Record<string, Record<string, OtaChannelInventoryHistoryRow[]>> = {}
  for (const row of rows) {
    const listingId = encodeChannelVariantListing(row.channel_id, row.variant_key || 'default')
    if (!result[listingId]) result[listingId] = {}
    if (!result[listingId][row.inventory_date]) result[listingId][row.inventory_date] = []
    result[listingId][row.inventory_date]!.push(row)
  }
  for (const byDate of Object.values(result)) {
    for (const date of Object.keys(byDate)) {
      byDate[date] = byDate[date]!.sort(
        (a, b) => dayjs(b.recorded_at).valueOf() - dayjs(a.recorded_at).valueOf()
      )
    }
  }
  return result
}

export function resolveClosureHistoryEntries(
  history: OtaChannelInventoryHistoryRow[] | undefined,
  inventory: OtaChannelInventoryRow | undefined
): OtaChannelInventoryHistoryRow[] {
  if (history && history.length > 0) return history
  if (!inventory) return []
  if (!inventory.updated_at && !inventory.updated_by_email && !inventory.updated_by_name) return []
  return [
    {
      product_id: inventory.product_id,
      channel_id: inventory.channel_id,
      variant_key: inventory.variant_key || 'default',
      inventory_date: inventory.inventory_date,
      sale_status: inventory.sale_status,
      antelope_x_seats: inventory.antelope_x_seats,
      antelope_l_seats: inventory.antelope_l_seats,
      vehicle_seats: inventory.vehicle_seats,
      ota_synced_vehicle_seats: inventory.ota_synced_vehicle_seats ?? null,
      notes: inventory.notes ?? null,
      updated_by_email: inventory.updated_by_email ?? null,
      updated_by_name: inventory.updated_by_name ?? null,
      recorded_at: inventory.updated_at || new Date().toISOString(),
    },
  ]
}
