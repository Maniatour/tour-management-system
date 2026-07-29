export type RegCancelRollupFilterArgs = {
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
}

/** 롤업 fast path — 필터·검색 없을 때만 (DB RPC와 동일 조건) */
export function isRegCancelRollupFastPathEligible(args: RegCancelRollupFilterArgs): boolean {
  return (
    !args.customerIdFromUrl &&
    (args.selectedStatus || 'all') === 'all' &&
    (args.selectedChannel || 'all') === 'all' &&
    !args.dateRange.start &&
    !args.dateRange.end &&
    !args.debouncedSearchTerm.trim()
  )
}

export function regCancelRollupCacheScopeKey(
  prefix: string,
  operatorId: string | null | undefined,
  extra: string
): string {
  return `${prefix}\u001f${operatorId ?? ''}\u001f${extra}`
}

const CACHE_TTL_MS = 5 * 60 * 1000

export function readRegCancelRollupSessionCache<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: T }
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function writeRegCancelRollupSessionCache<T>(key: string, data: T): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota */
  }
}
