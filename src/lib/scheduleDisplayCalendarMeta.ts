import dayjs from 'dayjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  inferSaleStatus,
  type OtaChannelInventoryRow,
  type OtaSaleStatus,
} from '@/lib/otaPriceInventory'
import {
  computeDayTourCapacityTotals,
  type ScheduleReservationCapacityInput,
  type ScheduleTourCapacityInput,
} from '@/lib/scheduleTourCapacity'

export const SCHEDULE_DISPLAY_CALENDAR_WEEKS = 3

/** display 모드 초기 fetch — 달력 주 이동 시 refetch 없이 커버할 과거·미래 주 수 */
export const SCHEDULE_DISPLAY_FETCH_WEEKS_BACK = 4
export const SCHEDULE_DISPLAY_FETCH_WEEKS_FORWARD = 10

/** 스케줄 디스플레이 전용 데이터 fetch 날짜 범위 (주 이동과 무관하게 고정) */
export function getScheduleDisplayFetchDateRange(displayDayCount: number): {
  start: string
  end: string
} {
  const today = dayjs().startOf('day')
  const start = today
    .subtract(SCHEDULE_DISPLAY_FETCH_WEEKS_BACK, 'week')
    .subtract(3, 'day')
    .format('YYYY-MM-DD')
  const gridEnd = today.add(Math.max(displayDayCount, 1) - 1, 'day')
  const prefetchEnd = today.add(SCHEDULE_DISPLAY_FETCH_WEEKS_FORWARD, 'week')
  const latest = gridEnd.isAfter(prefetchEnd, 'day') ? gridEnd : prefetchEnd
  return {
    start,
    end: latest.add(1, 'day').format('YYYY-MM-DD'),
  }
}

/** 오늘이 포함된 주의 일요일 (0=일요일) */
export function getScheduleDisplayCalendarWeekStart(date: Date = new Date()): Date {
  const d = dayjs(date).startOf('day')
  return d.subtract(d.day(), 'day').toDate()
}

export function getScheduleDisplayThreeWeekDateRange(weekStart: Date): { start: string; end: string } {
  const start = dayjs(weekStart).startOf('day').format('YYYY-MM-DD')
  const end = dayjs(weekStart)
    .add(SCHEDULE_DISPLAY_CALENDAR_WEEKS * 7 - 1, 'day')
    .format('YYYY-MM-DD')
  return { start, end }
}

export function buildScheduleDisplayThreeWeekDays(
  weekStart: Date
): Array<{ day: number; date: string }> {
  const anchor = dayjs(weekStart).startOf('day')
  const total = SCHEDULE_DISPLAY_CALENDAR_WEEKS * 7
  const days: Array<{ day: number; date: string }> = []
  for (let i = 0; i < total; i++) {
    const d = anchor.add(i, 'day')
    days.push({ day: d.date(), date: d.format('YYYY-MM-DD') })
  }
  return days
}

export type ScheduleDisplayProductRef = {  internal_name_ko?: string | null
  internal_name_en?: string | null
  name_ko?: string | null
  name?: string | null
  name_en?: string | null
}

export function scheduleDisplayProductDateKey(productId: string, date: string): string {
  return `${productId}|${date.slice(0, 10)}`
}

/** 스케줄 디스플레이 달력 — products.name (관리자 「상품명 (내부 한국어)」) */
export function resolveScheduleDisplayInternalProductName(
  product: ScheduleDisplayProductRef | null | undefined,
  locale: string
): string {
  if (!product) return '—'
  const adminInternalKo = product.name?.trim()
  if (adminInternalKo) return adminInternalKo

  const isKo = locale === 'ko' || locale.startsWith('ko')
  if (isKo) {
    return (
      product.name_ko?.trim() ||
      product.internal_name_ko?.trim() ||
      '—'
    )
  }
  return (
    product.name_en?.trim() ||
    product.internal_name_en?.trim() ||
    '—'
  )
}

/** 투어 product_id + products 목록에서 「상품명 (내부 한국어)」 */
export function resolveScheduleDisplayInternalProductNameForTour(
  tour: { product_id?: string | null; products?: ScheduleDisplayProductRef | null },
  productsCatalog: Array<ScheduleDisplayProductRef & { id?: string }>,
  locale: string
): string {
  const catalog = productsCatalog.find(
    (product) => product.id != null && String(product.id) === String(tour.product_id || '')
  )
  const embedded = tour.products
  return resolveScheduleDisplayInternalProductName(
    {
      name: embedded?.name ?? catalog?.name ?? null,
      internal_name_ko: catalog?.internal_name_ko ?? embedded?.internal_name_ko ?? null,
      internal_name_en: catalog?.internal_name_en ?? embedded?.internal_name_en ?? null,
      name_ko: catalog?.name_ko ?? embedded?.name_ko ?? null,
      name_en: catalog?.name_en ?? embedded?.name_en ?? null,
    },
    locale
  )
}

function pickInventoryRow(
  rows: OtaChannelInventoryRow[]
): OtaChannelInventoryRow | null {
  if (rows.length === 0) return null
  return rows.reduce((best, row) => {
    if (!best) return row
    const bestAt = best.updated_at || ''
    const rowAt = row.updated_at || ''
    return rowAt > bestAt ? row : best
  })
}

function enumerateYmdDatesInclusive(startYmd: string, endYmdInclusive: string): string[] {
  const dates: string[] = []
  let cur = dayjs(startYmd).startOf('day')
  const end = dayjs(endYmdInclusive).startOf('day')
  while (!cur.isAfter(end, 'day')) {
    dates.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return dates
}

/** 서버·클라이언트 공통 — YMD 구간 전체 OTA 판매 상태 (주 이동 시 클라이언트 필터만) */
export async function buildDisplayOtaSaleStatusForYmdRange(
  supabase: SupabaseClient,
  input: {
    rangeStart: string
    rangeEndInclusive: string
    calendarDates?: string[]
    tours: ScheduleTourCapacityInput[]
    reservations: ScheduleReservationCapacityInput[]
    productIds: string[]
  },
): Promise<Record<string, OtaSaleStatus>> {
  const { rangeStart, rangeEndInclusive, tours, reservations, productIds } = input
  const uniqueProductIds = [...new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (uniqueProductIds.length === 0) return {}

  const calendarDates =
    input.calendarDates ?? enumerateYmdDatesInclusive(rangeStart, rangeEndInclusive)

  const [inventoryRes, pricingRes] = await Promise.all([
    fromUntypedTable(supabase, 'ota_channel_inventory')
      .select(
        'product_id, inventory_date, antelope_x_seats, antelope_l_seats, vehicle_seats, sale_status, updated_at',
      )
      .in('product_id', uniqueProductIds)
      .gte('inventory_date', rangeStart)
      .lte('inventory_date', rangeEndInclusive),
    supabase
      .from('dynamic_pricing')
      .select('product_id, date, is_sale_available')
      .in('product_id', uniqueProductIds)
      .gte('date', rangeStart)
      .lte('date', rangeEndInclusive),
  ])

  const inventoryRowsByKey = new Map<string, OtaChannelInventoryRow[]>()
  if (!inventoryRes.error) {
    for (const row of (inventoryRes.data || []) as OtaChannelInventoryRow[]) {
      const key = scheduleDisplayProductDateKey(row.product_id, row.inventory_date)
      const list = inventoryRowsByKey.get(key) || []
      list.push(row)
      inventoryRowsByKey.set(key, list)
    }
  }

  const pricingAvailableByKey = new Map<string, boolean>()
  for (const row of pricingRes.data || []) {
    const productId = String(row.product_id || '').trim()
    const date = String(row.date || '').slice(0, 10)
    if (!productId || !date) continue
    const key = scheduleDisplayProductDateKey(productId, date)
    const available = row.is_sale_available !== false
    const prev = pricingAvailableByKey.get(key)
    pricingAvailableByKey.set(key, prev == null ? available : prev && available)
  }

  const result: Record<string, OtaSaleStatus> = {}
  for (const productId of uniqueProductIds) {
    for (const date of calendarDates) {
      const key = scheduleDisplayProductDateKey(productId, date)
      const inventory = pickInventoryRow(inventoryRowsByKey.get(key) || [])
      const isSaleAvailable = pricingAvailableByKey.get(key) ?? true
      const capacity = computeDayTourCapacityTotals(tours, reservations, date, productId)
      result[key] = inferSaleStatus(inventory, isSaleAvailable, capacity?.totalSpotsLeft)
    }
  }

  return result
}

/** 상품·일별 Price & Inventory 와 동일한 판매 상태 (판매중 / 잔여 적음 / 매진 / 판매 안함) */
export async function buildDisplayOtaSaleStatusByProductDate(input: {
  weekStart: Date
  tours: ScheduleTourCapacityInput[]
  reservations: ScheduleReservationCapacityInput[]
  productIds: string[]
  supabaseClient?: SupabaseClient
}): Promise<Record<string, OtaSaleStatus>> {
  const { weekStart, tours, reservations, productIds } = input
  const { start, end } = getScheduleDisplayThreeWeekDateRange(weekStart)
  const calendarDates = buildScheduleDisplayThreeWeekDays(weekStart).map((cell) => cell.date)

  const { supabase } = await import('@/lib/supabase')
  const client = input.supabaseClient ?? supabase

  return buildDisplayOtaSaleStatusForYmdRange(client, {
    rangeStart: start,
    rangeEndInclusive: end,
    calendarDates,
    tours,
    reservations,
    productIds,
  })
}

export function filterOtaSaleStatusByYmdRange(
  statusByKey: Record<string, OtaSaleStatus>,
  rangeStart: string,
  rangeEndInclusive: string,
): Record<string, OtaSaleStatus> {
  const filtered: Record<string, OtaSaleStatus> = {}
  for (const [key, status] of Object.entries(statusByKey)) {
    const date = key.split('|')[1]
    if (!date || date < rangeStart || date > rangeEndInclusive) continue
    filtered[key] = status
  }
  return filtered
}

export function resolveDisplayOtaSaleStatus(
  statusByKey: Record<string, OtaSaleStatus>,
  productId: string | null | undefined,
  tourDate: string | null | undefined
): OtaSaleStatus {
  const pid = String(productId || '').trim()
  const date = String(tourDate || '').slice(0, 10)
  if (!pid || !date) return 'on_sale'
  return statusByKey[scheduleDisplayProductDateKey(pid, date)] || 'on_sale'
}
