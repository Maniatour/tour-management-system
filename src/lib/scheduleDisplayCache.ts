import type { ScheduleDisplayDataPayload } from '@/lib/scheduleDisplayData'

/** 캐시가 신선하다고 간주하는 시간 — 이 안이면 네트워크 생략 가능 */
export const SCHEDULE_DISPLAY_CACHE_FRESH_MS = 90_000

/** 캐시 최대 보관 시간 — 초과 시 무효 */
export const SCHEDULE_DISPLAY_CACHE_MAX_AGE_MS = 5 * 60_000

type CacheEntry = {
  data: ScheduleDisplayDataPayload
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

export function getScheduleDisplayCacheKey(operatorId: string, displayDayCount: number): string {
  return `${operatorId}:${Math.max(displayDayCount, 1)}`
}

export function readScheduleDisplayCache(key: string): ScheduleDisplayDataPayload | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > SCHEDULE_DISPLAY_CACHE_MAX_AGE_MS) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function isScheduleDisplayCacheFresh(key: string): boolean {
  const entry = cache.get(key)
  if (!entry) return false
  if (Date.now() - entry.fetchedAt > SCHEDULE_DISPLAY_CACHE_MAX_AGE_MS) {
    cache.delete(key)
    return false
  }
  return Date.now() - entry.fetchedAt <= SCHEDULE_DISPLAY_CACHE_FRESH_MS
}

export function writeScheduleDisplayCache(key: string, data: ScheduleDisplayDataPayload): void {
  cache.set(key, { data, fetchedAt: Date.now() })
}

export function invalidateScheduleDisplayCache(key?: string): void {
  if (key) {
    cache.delete(key)
    return
  }
  cache.clear()
}
