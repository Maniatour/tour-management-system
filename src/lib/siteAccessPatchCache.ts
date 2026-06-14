import type { SiteAccessMatrixOverrideRow } from '@/lib/site-access-matrix-overrides'

const SITE_ACCESS_PATCH_CACHE_KEY = 'tms-site-access-matrix-patches'
const DEFAULT_TTL_MS = 300_000

type SiteAccessPatchCache = {
  rows: SiteAccessMatrixOverrideRow[]
  expiresAt: number
}

export function readSiteAccessPatchCache(): SiteAccessMatrixOverrideRow[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SITE_ACCESS_PATCH_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SiteAccessPatchCache
    if (!Array.isArray(parsed.rows) || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SITE_ACCESS_PATCH_CACHE_KEY)
      return null
    }
    return parsed.rows
  } catch {
    return null
  }
}

export function writeSiteAccessPatchCache(rows: SiteAccessMatrixOverrideRow[], ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === 'undefined') return
  try {
    const payload: SiteAccessPatchCache = {
      rows,
      expiresAt: Date.now() + ttlMs,
    }
    sessionStorage.setItem(SITE_ACCESS_PATCH_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}
