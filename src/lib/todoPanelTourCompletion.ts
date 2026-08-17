export type TodoPanelTourCompletionNamespace =
  | 'guide-schedule-confirm'
  | 'tour-envelope-print'
  | 'pickup-notification'
  | 'tour-hotel-price-check'
  | 'tour-hotel-management'
  | 'tour-settlement'
  | 'bento-check'
  | 'antelope-canyon-booking'
  | 'rental-car-pickup-dropoff'

export type TodoPanelTourItemStatus = 'completed' | 'on_hold'
export type TodoPanelTourItemState = 'pending' | TodoPanelTourItemStatus

export type TodoPanelTourState = Record<string, TodoPanelTourItemStatus>

const STORAGE_VERSION = 'v2'
const LEGACY_STORAGE_VERSION = 'v1'

function itemsStorageKey(namespace: TodoPanelTourCompletionNamespace, dateKey: string): string {
  return `${namespace}.tours.${STORAGE_VERSION}.${dateKey}`
}

function legacyItemsStorageKey(namespace: TodoPanelTourCompletionNamespace, dateKey: string): string {
  return `${namespace}.tours.${LEGACY_STORAGE_VERSION}.${dateKey}`
}

function normalizeTodoPanelTourState(raw: unknown): TodoPanelTourState {
  if (!raw || typeof raw !== 'object') return {}
  const result: TodoPanelTourState = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === true || value === 'completed') result[id] = 'completed'
    else if (value === 'on_hold') result[id] = 'on_hold'
  }
  return result
}

export function readTodoPanelTourCompletion(
  namespace: TodoPanelTourCompletionNamespace,
  dateKey: string
): TodoPanelTourState {
  if (typeof window === 'undefined') return {}
  try {
    const rawV2 = window.localStorage.getItem(itemsStorageKey(namespace, dateKey))
    if (rawV2) {
      return normalizeTodoPanelTourState(JSON.parse(rawV2))
    }
    const rawV1 = window.localStorage.getItem(legacyItemsStorageKey(namespace, dateKey))
    if (!rawV1) return {}
    return normalizeTodoPanelTourState(JSON.parse(rawV1))
  } catch {
    return {}
  }
}

function writeTodoPanelTourCompletion(
  namespace: TodoPanelTourCompletionNamespace,
  dateKey: string,
  state: TodoPanelTourState
): void {
  if (typeof window === 'undefined') return
  const key = itemsStorageKey(namespace, dateKey)
  if (Object.keys(state).length === 0) {
    window.localStorage.removeItem(key)
    return
  }
  window.localStorage.setItem(key, JSON.stringify(state))
}

export function getTodoPanelTourStatus(
  tourId: string,
  state: TodoPanelTourState
): TodoPanelTourItemState {
  return state[tourId] ?? 'pending'
}

/** @deprecated use getTodoPanelTourStatus === 'completed' */
export function isTodoPanelTourDone(tourId: string, state: TodoPanelTourState): boolean {
  return state[tourId] === 'completed'
}

export function isTodoPanelTourOnHold(tourId: string, state: TodoPanelTourState): boolean {
  return state[tourId] === 'on_hold'
}

export function lookbackDateKeys(dateKey: string, lookbackDays: number): string[] {
  const days = Math.max(1, Math.floor(lookbackDays))
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return [dateKey]
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const keys: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start - i * 24 * 60 * 60 * 1000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    keys.push(`${y}-${m}-${day}`)
  }
  return keys
}

export function readTodoPanelTourCompletionLookback(
  namespace: TodoPanelTourCompletionNamespace,
  dateKey: string,
  lookbackDays: number
): TodoPanelTourState {
  if (lookbackDays <= 1) return readTodoPanelTourCompletion(namespace, dateKey)
  const keys = lookbackDateKeys(dateKey, lookbackDays)
  const merged: TodoPanelTourState = {}
  for (let i = keys.length - 1; i >= 0; i--) {
    Object.assign(merged, readTodoPanelTourCompletion(namespace, keys[i]))
  }
  return merged
}

export function setTodoPanelTourStatus(
  namespace: TodoPanelTourCompletionNamespace,
  tourId: string,
  status: TodoPanelTourItemState,
  dateKey: string,
  lookbackDays = 1
): TodoPanelTourState {
  if (status === 'pending' && lookbackDays > 1) {
    for (const key of lookbackDateKeys(dateKey, lookbackDays)) {
      const prev = readTodoPanelTourCompletion(namespace, key)
      if (!(tourId in prev)) continue
      const next = { ...prev }
      delete next[tourId]
      writeTodoPanelTourCompletion(namespace, key, next)
    }
    return readTodoPanelTourCompletionLookback(namespace, dateKey, lookbackDays)
  }
  const prev = readTodoPanelTourCompletion(namespace, dateKey)
  const next = { ...prev }
  if (status === 'pending') delete next[tourId]
  else next[tourId] = status
  writeTodoPanelTourCompletion(namespace, dateKey, next)
  return lookbackDays > 1
    ? readTodoPanelTourCompletionLookback(namespace, dateKey, lookbackDays)
    : next
}

/** @deprecated use setTodoPanelTourStatus */
export function setTodoPanelTourDone(
  namespace: TodoPanelTourCompletionNamespace,
  tourId: string,
  completed: boolean,
  dateKey: string
): TodoPanelTourState {
  return setTodoPanelTourStatus(namespace, tourId, completed ? 'completed' : 'pending', dateKey)
}

export function countTodoPanelTourProgress(
  tourIds: string[],
  state: TodoPanelTourState
): { done: number; onHold: number; total: number } {
  const total = tourIds.length
  const done = tourIds.filter((id) => state[id] === 'completed').length
  const onHold = tourIds.filter((id) => state[id] === 'on_hold').length
  return { done, onHold, total }
}

export function todoPanelTourRowClassName(
  status: TodoPanelTourItemState,
  variant: 'list' | 'panel' = 'list'
): string {
  if (status === 'completed') {
    return variant === 'list'
      ? 'border-emerald-200 bg-emerald-50/50'
      : 'border-emerald-200'
  }
  if (status === 'on_hold') {
    return variant === 'list'
      ? 'border-amber-200 bg-amber-50/50'
      : 'border-amber-200'
  }
  return variant === 'list' ? 'border-gray-200/80 bg-white/80' : 'border-gray-200'
}

export function todoPanelTourTitleClassName(status: TodoPanelTourItemState): string {
  if (status === 'completed') return 'text-gray-500 line-through'
  if (status === 'on_hold') return 'text-amber-900'
  return 'text-gray-900'
}
