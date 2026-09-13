export type AdminSidebarOrderState = {
  groupIds: string[]
  childrenByGroup: Record<string, string[]>
}

const STORAGE_PREFIX = 'kovegas:admin-sidebar-order:'

function storageKey(email: string): string {
  const id = email.trim().toLowerCase() || 'local'
  return `${STORAGE_PREFIX}${id}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)
}

export function readAdminSidebarOrder(email: string): AdminSidebarOrderState {
  if (typeof window === 'undefined') return { groupIds: [], childrenByGroup: {} }
  try {
    const raw = window.localStorage.getItem(storageKey(email))
    if (!raw) return { groupIds: [], childrenByGroup: {} }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { groupIds: [], childrenByGroup: {} }
    const record = parsed as { groupIds?: unknown; childrenByGroup?: unknown }
    const groupIds = isStringArray(record.groupIds) ? record.groupIds : []
    const childrenByGroup: Record<string, string[]> = {}
    if (record.childrenByGroup && typeof record.childrenByGroup === 'object') {
      for (const [key, value] of Object.entries(record.childrenByGroup as Record<string, unknown>)) {
        if (isStringArray(value)) childrenByGroup[key] = value
      }
    }
    return { groupIds, childrenByGroup }
  } catch {
    return { groupIds: [], childrenByGroup: {} }
  }
}

export function writeAdminSidebarOrder(email: string, state: AdminSidebarOrderState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(email), JSON.stringify(state))
}

const LOCK_STORAGE_PREFIX = 'kovegas:admin-sidebar-order-locked:'

function lockStorageKey(email: string): string {
  const id = email.trim().toLowerCase() || 'local'
  return `${LOCK_STORAGE_PREFIX}${id}`
}

export function readAdminSidebarOrderLocked(email: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(lockStorageKey(email))
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function writeAdminSidebarOrderLocked(email: string, locked: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(lockStorageKey(email), locked ? '1' : '0')
}

export function applyIdOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const next: T[] = []
  for (const id of order) {
    const item = byId.get(id)
    if (!item) continue
    next.push(item)
    byId.delete(id)
  }
  for (const item of items) {
    if (byId.has(item.id)) next.push(item)
  }
  return next
}

export function moveIdInList(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from < 0 || to < 0) return ids
  const next = [...ids]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
