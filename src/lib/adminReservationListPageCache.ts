/**
 * 예약 관리 목록뷰(card-flat) 페이지 sessionStorage 캐시.
 * 뒤로가기·동일 필터 재진입 시 즉시 paint 후 백그라운드 갱신.
 */

export type AdminReservationListPageCachePayload = {
  data: Record<string, unknown>[]
  count: number | null
}

export type AdminReservationListPageCacheKeyArgs = {
  operatorId: string | null | undefined
  page: number
  pageSize: number
  selectedStatus: string
  selectedChannel: string
  selectedPickupHotel?: string | undefined
  selectedProduct?: string | undefined
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
  sortBy?: string
  sortOrder?: string
}

const CACHE_TTL_MS = 2 * 60 * 1000
/** v2: customers(id,name) embed 포함 스냅샷 */
const CACHE_KEY_PREFIX = 'admin-reservation-list-page-v2\u001f'

export function buildAdminReservationListPageCacheKey(
  args: AdminReservationListPageCacheKeyArgs
): string {
  return [
    CACHE_KEY_PREFIX,
    args.operatorId ?? '',
    String(args.page),
    String(args.pageSize),
    args.selectedStatus || 'all',
    args.selectedChannel || 'all',
    args.selectedPickupHotel || 'all',
    args.selectedProduct || 'all',
    args.dateRange.start || '',
    args.dateRange.end || '',
    args.customerIdFromUrl || '',
    args.debouncedSearchTerm.trim(),
    args.sortBy || 'created_at',
    args.sortOrder || 'desc',
  ].join('\u001f')
}

export function readAdminReservationListPageCache(
  key: string
): AdminReservationListPageCachePayload | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: AdminReservationListPageCachePayload }
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

export function writeAdminReservationListPageCache(
  key: string,
  payload: AdminReservationListPageCachePayload
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: payload }))
  } catch {
    /* quota */
  }
}

/** 다음 페이지가 있으면 true (count 기준). count 없으면 현재 페이지가 pageSize만큼 꽉 찼을 때만 true */
export function hasAdminReservationListNextPage(args: {
  page: number
  pageSize: number
  count: number | null
  loadedRowCount: number
}): boolean {
  if (args.count != null && args.count >= 0) {
    return args.page * args.pageSize < args.count
  }
  return args.loadedRowCount >= args.pageSize
}

