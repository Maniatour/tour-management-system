/**
 * 예약 관리 캘린더 뷰: 첫 paint용 스냅샷 sessionStorage 캐시.
 * 인접 월 전환 시 즉시 표시 후 백그라운드 갱신.
 */

export type AdminReservationCalendarCachePayload = {
  data: Record<string, unknown>[]
  count: number | null
}

export type AdminReservationCalendarCacheKeyArgs = {
  operatorId: string | null | undefined
  monthOffset: number
  selectedStatus: string
  selectedChannel: string
  selectedPickupHotel?: string | undefined
  selectedProduct?: string | undefined
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
}

const CACHE_TTL_MS = 2 * 60 * 1000
const CACHE_KEY_PREFIX = 'admin-reservation-calendar\u001f'

export function buildAdminReservationCalendarCacheKey(
  args: AdminReservationCalendarCacheKeyArgs
): string {
  return [
    CACHE_KEY_PREFIX,
    args.operatorId ?? '',
    String(args.monthOffset),
    args.selectedStatus || 'all',
    args.selectedChannel || 'all',
    args.selectedPickupHotel || 'all',
    args.selectedProduct || 'all',
    args.dateRange.start || '',
    args.dateRange.end || '',
    args.customerIdFromUrl || '',
    args.debouncedSearchTerm.trim(),
  ].join('\u001f')
}

export function readAdminReservationCalendarCache(
  key: string
): AdminReservationCalendarCachePayload | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: AdminReservationCalendarCachePayload }
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    if (!parsed.data || !Array.isArray(parsed.data.data)) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function writeAdminReservationCalendarCache(
  key: string,
  payload: AdminReservationCalendarCachePayload
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const data = payload.data.slice(0, 500)
    sessionStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data: { data, count: payload.count } })
    )
  } catch {
    /* quota */
  }
}
