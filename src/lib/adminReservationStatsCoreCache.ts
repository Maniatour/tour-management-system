/**
 * 주간 통계 모달 코어 활동 구간 sessionStorage 캐시.
 * 동일 필터·구간 재오픈 시 즉시 표시 후 백그라운드 갱신.
 */

export type AdminReservationStatsCoreCacheKeyArgs = {
  operatorId: string | null | undefined
  rangeStartIso: string
  rangeEndIso: string
  selectedStatus: string
  selectedChannel: string
  selectedPickupHotel?: string | undefined
  selectedProduct?: string | undefined
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
}

const CACHE_TTL_MS = 3 * 60 * 1000
/** v2: product_id·channel_id 포함 SELECT — 구캐시(Unknown 상품/채널) 무효화 */
const CACHE_KEY_PREFIX = 'admin-reservation-stats-core-v2\u001f'

export function buildAdminReservationStatsCoreCacheKey(
  args: AdminReservationStatsCoreCacheKeyArgs
): string {
  return [
    CACHE_KEY_PREFIX,
    args.operatorId ?? '',
    args.rangeStartIso,
    args.rangeEndIso,
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

export function readAdminReservationStatsCoreCache(
  key: string
): Record<string, unknown>[] | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: Record<string, unknown>[] }
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    if (!Array.isArray(parsed.data)) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function writeAdminReservationStatsCoreCache(
  key: string,
  data: Record<string, unknown>[]
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data: data.slice(0, 8000) })
    )
  } catch {
    /* quota */
  }
}
