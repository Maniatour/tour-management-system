const STORAGE_PREFIX = 'kovegas:admin-sidebar-favorites:'

export const ADMIN_SIDEBAR_FAVORITES_MAX = 8

function storageKey(email: string): string {
  const id = email.trim().toLowerCase() || 'local'
  return `${STORAGE_PREFIX}${id}`
}

export function readAdminSidebarFavorites(email: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(email))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function writeAdminSidebarFavorites(email: string, ids: string[]): void {
  if (typeof window === 'undefined') return
  const unique = Array.from(new Set(ids)).slice(0, ADMIN_SIDEBAR_FAVORITES_MAX)
  window.localStorage.setItem(storageKey(email), JSON.stringify(unique))
}

export function toggleAdminSidebarFavorite(
  email: string,
  id: string
): { ids: string[]; added: boolean; atLimit: boolean } {
  const current = readAdminSidebarFavorites(email)
  if (current.includes(id)) {
    const ids = current.filter((item) => item !== id)
    writeAdminSidebarFavorites(email, ids)
    return { ids, added: false, atLimit: false }
  }
  if (current.length >= ADMIN_SIDEBAR_FAVORITES_MAX) {
    return { ids: current, added: false, atLimit: true }
  }
  const ids = [...current, id]
  writeAdminSidebarFavorites(email, ids)
  return { ids, added: true, atLimit: false }
}

export function reorderAdminSidebarFavorites(email: string, fromId: string, toId: string): string[] {
  const current = readAdminSidebarFavorites(email)
  const from = current.indexOf(fromId)
  const to = current.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return current
  const next = [...current]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  writeAdminSidebarFavorites(email, next)
  return next
}
