/**
 * 예약 관리 카드 주간 뷰: 첫 paint용 스냅샷 sessionStorage 캐시.
 * 인접 주 전환 시 즉시 표시 후 백그라운드 갱신.
 */

export type AdminReservationCardWeekCachePayload = {
  data: Record<string, unknown>[]
  count: number | null
}

export type AdminReservationCardWeekCacheKeyArgs = {
  operatorId: string | null | undefined
  weekOffset: number
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
}

const CACHE_TTL_MS = 2 * 60 * 1000
/** v2: customers(id,name) embed 포함 스냅샷 */
const CACHE_KEY_PREFIX = 'admin-reservation-card-week-v2\u001f'

export function buildAdminReservationCardWeekCacheKey(
  args: AdminReservationCardWeekCacheKeyArgs
): string {
  return [
    CACHE_KEY_PREFIX,
    args.operatorId ?? '',
    String(args.weekOffset),
    args.selectedStatus || 'all',
    args.selectedChannel || 'all',
    args.dateRange.start || '',
    args.dateRange.end || '',
    args.customerIdFromUrl || '',
    args.debouncedSearchTerm.trim(),
  ].join('\u001f')
}

export function readAdminReservationCardWeekCache(
  key: string
): AdminReservationCardWeekCachePayload | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: AdminReservationCardWeekCachePayload }
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

export function writeAdminReservationCardWeekCache(
  key: string,
  payload: AdminReservationCardWeekCachePayload
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    // 첫 paint용 — 과도한 quota 방지로 행 수 상한
    const data = payload.data.slice(0, 500)
    sessionStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data: { data, count: payload.count } })
    )
  } catch {
    /* quota */
  }
}
