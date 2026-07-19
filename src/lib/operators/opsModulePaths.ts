/**
 * Admin paths that belong to Operations Suite (Phase 6a/6a.1).
 * Derived from ADMIN_SIDEBAR_REGISTRY.requiresOperationsModule.
 */
import { ADMIN_SIDEBAR_REGISTRY } from '@/lib/admin-site-registry'

let cachedPaths: string[] | null = null

/** Relative admin paths (no locale / admin prefix), longest first for matching. */
export function getOperationsModuleAdminPaths(): string[] {
  if (cachedPaths) return cachedPaths
  cachedPaths = ADMIN_SIDEBAR_REGISTRY.filter((e) => e.requiresOperationsModule)
    .map((e) => e.path)
    .sort((a, b) => b.length - a.length)
  return cachedPaths
}

/**
 * True when pathname is an Ops Suite admin page for the given locale.
 * Examples: /ko/admin/vehicles, /en/admin/suppliers/settlement
 */
export function isOperationsModuleAdminPath(
  pathname: string,
  locale: string
): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const prefix = `/${locale}/admin/`
  if (!normalized.startsWith(prefix)) return false
  const relative = normalized.slice(prefix.length)
  if (!relative) return false

  return getOperationsModuleAdminPaths().some(
    (path) => relative === path || relative.startsWith(`${path}/`)
  )
}
