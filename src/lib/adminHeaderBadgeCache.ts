const ADMIN_HEADER_BADGE_CACHE_KEY = 'tms-admin-header-badges'
const DEFAULT_TTL_MS = 120_000

type AdminHeaderBadgeCache = {
  email: string
  teamBoardCount: number
  expiringDocumentsCount: number
  expiresAt: number
}

export function readAdminHeaderBadgeCache(email: string): AdminHeaderBadgeCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ADMIN_HEADER_BADGE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminHeaderBadgeCache
    if (parsed.email !== email || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(ADMIN_HEADER_BADGE_CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeAdminHeaderBadgeCache(
  email: string,
  teamBoardCount: number,
  expiringDocumentsCount: number,
  ttlMs = DEFAULT_TTL_MS
) {
  if (typeof window === 'undefined') return
  try {
    const payload: AdminHeaderBadgeCache = {
      email,
      teamBoardCount,
      expiringDocumentsCount,
      expiresAt: Date.now() + ttlMs,
    }
    sessionStorage.setItem(ADMIN_HEADER_BADGE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}
