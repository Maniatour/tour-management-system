export const ADMIN_ALERT_INBOX_STORAGE_KEY = 'tms-admin-alert-inbox'
export const ADMIN_ALERT_INBOX_MAX = 60

export type AdminAlertKind =
  | 'customer_payment'
  | 'cash_withdrawal'
  | 'pricing_audit'
  | 'reservation_import'
  | 'google_review_import'
  | 'guest_resident_check'
  | 'guest_waiver_signed'
  | 'tour_chat'
  | 'staff_site_alert'
  | 'op_todo'
  | 'weather_reminder'
  | 'goblin_narration'
  | 'competitor_price'

export type AdminAlertInboxDraft = {
  id: string
  kind: AdminAlertKind
  title: string
  body: string
  href?: string
  createdAt?: string
  pendingChatRoomId?: string
  payload?: unknown
}

export type AdminAlertInboxItem = {
  id: string
  kind: AdminAlertKind
  title: string
  body: string
  href?: string
  createdAt: string
  read: boolean
  pendingChatRoomId?: string
  payload?: unknown
}

export type AdminAlertInboxTab = 'unread' | 'read'

const KINDS = new Set<AdminAlertKind>([
  'customer_payment',
  'cash_withdrawal',
  'pricing_audit',
  'reservation_import',
  'google_review_import',
  'guest_resident_check',
  'guest_waiver_signed',
  'tour_chat',
  'staff_site_alert',
  'op_todo',
  'weather_reminder',
  'goblin_narration',
  'competitor_price',
])

export function adminAlertId(kind: AdminAlertKind, sourceId: string): string {
  return `${kind}:${sourceId}`
}

export function makeAdminAlertDraft(
  kind: AdminAlertKind,
  sourceId: string,
  input: Omit<AdminAlertInboxDraft, 'id' | 'kind'>
): AdminAlertInboxDraft {
  return {
    id: adminAlertId(kind, sourceId),
    kind,
    title: input.title,
    body: input.body,
    ...(input.href ? { href: input.href } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    ...(input.pendingChatRoomId ? { pendingChatRoomId: input.pendingChatRoomId } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  }
}

export function upsertAdminAlertInbox(
  items: AdminAlertInboxItem[],
  draft: AdminAlertInboxDraft
): AdminAlertInboxItem[] {
  const idx = items.findIndex((item) => item.id === draft.id)
  if (idx >= 0) {
    const prev = items[idx]
    const next = [...items]
    next[idx] = {
      ...prev,
      title: draft.title,
      body: draft.body,
      ...(draft.href ? { href: draft.href } : {}),
      ...(draft.pendingChatRoomId ? { pendingChatRoomId: draft.pendingChatRoomId } : {}),
      ...(draft.payload !== undefined ? { payload: draft.payload } : {}),
    }
    return next
  }

  return [
    {
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      createdAt: draft.createdAt || new Date().toISOString(),
      read: false,
      ...(draft.href ? { href: draft.href } : {}),
      ...(draft.pendingChatRoomId ? { pendingChatRoomId: draft.pendingChatRoomId } : {}),
      ...(draft.payload !== undefined ? { payload: draft.payload } : {}),
    },
    ...items,
  ].slice(0, ADMIN_ALERT_INBOX_MAX)
}

export function markAdminAlertRead(
  items: AdminAlertInboxItem[],
  id: string
): AdminAlertInboxItem[] {
  return items.map((item) => (item.id === id ? { ...item, read: true } : item))
}

export function markAllAdminAlertsRead(items: AdminAlertInboxItem[]): AdminAlertInboxItem[] {
  return items.map((item) => (item.read ? item : { ...item, read: true }))
}

export function countUnreadAdminAlerts(items: AdminAlertInboxItem[]): number {
  return items.reduce((sum, item) => sum + (item.read ? 0 : 1), 0)
}

export function countReadAdminAlerts(items: AdminAlertInboxItem[]): number {
  return items.length - countUnreadAdminAlerts(items)
}

export function filterAdminAlertInboxByTab(
  items: AdminAlertInboxItem[],
  tab: AdminAlertInboxTab
): AdminAlertInboxItem[] {
  return items.filter((item) => (tab === 'unread' ? !item.read : item.read))
}

export function sortAdminAlertInbox(items: AdminAlertInboxItem[]): AdminAlertInboxItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

function asItem(raw: unknown): AdminAlertInboxItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const kind = typeof row.kind === 'string' && KINDS.has(row.kind as AdminAlertKind)
    ? (row.kind as AdminAlertKind)
    : null
  const title = typeof row.title === 'string' ? row.title : ''
  const body = typeof row.body === 'string' ? row.body : ''
  const createdAt =
    typeof row.created_at === 'string'
      ? row.created_at
      : typeof row.createdAt === 'string'
        ? row.createdAt
        : ''
  if (!id || !kind || !title || !createdAt) return null
  return {
    id,
    kind,
    title,
    body,
    createdAt,
    read: row.read === true,
    ...(typeof row.href === 'string' ? { href: row.href } : {}),
    ...(typeof row.pendingChatRoomId === 'string' ? { pendingChatRoomId: row.pendingChatRoomId } : {}),
    ...(row.payload !== undefined ? { payload: row.payload } : {}),
  }
}

export function parseAdminAlertInbox(raw: unknown): AdminAlertInboxItem[] {
  if (!Array.isArray(raw)) return []
  const items: AdminAlertInboxItem[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    const item = asItem(row)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
    if (items.length >= ADMIN_ALERT_INBOX_MAX) break
  }
  return items
}

export function readAdminAlertInbox(): AdminAlertInboxItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(ADMIN_ALERT_INBOX_STORAGE_KEY)
    return parseAdminAlertInbox(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

export function writeAdminAlertInbox(items: AdminAlertInboxItem[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ADMIN_ALERT_INBOX_STORAGE_KEY, JSON.stringify(items.slice(0, ADMIN_ALERT_INBOX_MAX)))
  } catch {
    /* quota */
  }
}

export function adminAlertKindLabel(kind: AdminAlertKind, isKo: boolean): string {
  switch (kind) {
    case 'customer_payment':
      return isKo ? '고객 결제' : 'Payment'
    case 'cash_withdrawal':
      return isKo ? '현금 출금' : 'Cash'
    case 'pricing_audit':
      return isKo ? '가격 감사' : 'Pricing'
    case 'reservation_import':
      return isKo ? '예약 메일' : 'Booking email'
    case 'google_review_import':
      return isKo ? '구글 리뷰' : 'Google review'
    case 'guest_resident_check':
      return isKo ? '거주 확인' : 'Resident check'
    case 'guest_waiver_signed':
      return isKo ? '면책 동의' : 'Waiver'
    case 'tour_chat':
      return isKo ? '투어 채팅' : 'Tour chat'
    case 'staff_site_alert':
      return isKo ? '사이트 알림' : 'Site alert'
    case 'op_todo':
      return isKo ? '체크리스트' : 'Checklist'
    case 'weather_reminder':
      return isKo ? '날씨' : 'Weather'
    case 'goblin_narration':
      return isKo ? '나레이션' : 'Narration'
    case 'competitor_price':
      return isKo ? '경쟁사 시세' : 'Competitor price'
  }
}

export function formatAdminAlertTime(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(locale.startsWith('ko') ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ADMIN_ALERT_INBOX_PAGE_SIZE = 8

export function adminAlertInboxPageCount(
  total: number,
  pageSize: number = ADMIN_ALERT_INBOX_PAGE_SIZE
): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}

export function clampAdminAlertInboxPage(
  page: number,
  total: number,
  pageSize: number = ADMIN_ALERT_INBOX_PAGE_SIZE
): number {
  return Math.min(Math.max(1, page), adminAlertInboxPageCount(total, pageSize))
}

export function sliceAdminAlertInboxPage<T>(
  items: T[],
  page: number,
  pageSize: number = ADMIN_ALERT_INBOX_PAGE_SIZE
): T[] {
  const clamped = clampAdminAlertInboxPage(page, items.length, pageSize)
  const start = (clamped - 1) * pageSize
  return items.slice(start, start + pageSize)
}
