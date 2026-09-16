import type { AdminAlertInboxItem, AdminAlertKind } from '@/lib/adminAlertInbox'

export const ADMIN_ALERT_REPLAY_EVENT = 'tms-admin-alert-replay'

export function dispatchAdminAlertReplay(item: AdminAlertInboxItem): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ADMIN_ALERT_REPLAY_EVENT, { detail: item }))
}

export function unshiftUniqueAlert<T>(prev: T[], next: T, isSame: (item: T) => boolean): T[] {
  return [next, ...prev.filter((item) => !isSame(item))]
}

export function asAdminAlertPayload<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== 'object') return null
  return payload as T
}

export function isAdminAlertReplayKind(item: AdminAlertInboxItem, kind: AdminAlertKind): boolean {
  return item.kind === kind
}
