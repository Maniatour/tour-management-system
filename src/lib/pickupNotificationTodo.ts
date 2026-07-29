import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

/** Todo List에 항상 표시되는 고정 패널 (DB Todo와 무관) */
export const PICKUP_NOTIFICATION_PANEL = {
  titleKo: 'Pick up Notification',
  titleEn: 'Pick up Notification',
} as const

export function pickupNotificationPanelTitle(_locale: string): string {
  return PICKUP_NOTIFICATION_PANEL.titleEn
}

export function pickupNotificationCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** DB에 동일 제목 Todo가 있으면 칩 목록에서 숨김 (고정 패널과 중복 방지) */
export function shouldHideTodoChipForPickupNotificationPanel(todo: {
  title?: string | null
  action_type?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === PICKUP_NOTIFICATION_PANEL.titleKo) return true
  if (normalized.toLowerCase() === PICKUP_NOTIFICATION_PANEL.titleEn.toLowerCase()) return true
  if (normalized.toLowerCase() === 'pickup notification') return true
  return false
}

export function pickupNotificationCompletionStorageKey(dateKey = pickupNotificationCompletionDateKey()): string {
  return `pickup-notification.completed.${dateKey}`
}

export function readPickupNotificationLocalCompleted(dateKey = pickupNotificationCompletionDateKey()): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(pickupNotificationCompletionStorageKey(dateKey)) === '1'
}

export function writePickupNotificationLocalCompleted(completed: boolean, dateKey = pickupNotificationCompletionDateKey()): void {
  if (typeof window === 'undefined') return
  const key = pickupNotificationCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type PickupNotificationLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
}

export function findPickupNotificationLinkedTodo<T extends { title?: string | null; id: string; completed: boolean }>(
  todos: T[]
): T | null {
  return todos.find((todo) => shouldHideTodoChipForPickupNotificationPanel(todo)) ?? null
}

/** DB Todo가 없을 때 생성 모달에 채울 기본값 */
export function pickupNotificationTodoFormSeed(locale: string) {
  return {
    title: pickupNotificationPanelTitle(locale),
    category: 'daily' as const,
    department: 'common' as const,
  }
}
