'use client'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const PENDING_CUSTOMER_MANAGEMENT_PANEL = {
  titleKo: 'Pending 고객 관리',
  titleEn: 'Pending customer management',
} as const

export function pendingCustomerManagementPanelTitle(locale: string): string {
  return locale === 'ko'
    ? PENDING_CUSTOMER_MANAGEMENT_PANEL.titleKo
    : PENDING_CUSTOMER_MANAGEMENT_PANEL.titleEn
}

export function pendingCustomerManagementCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** 오늘부터 3일 이내 투어일 pending 예약 */
export function pendingCustomerManagementDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(3, 'day').format('YYYY-MM-DD')
  return { start, end }
}

export function shouldHideTodoChipForPendingCustomerManagementPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === PENDING_CUSTOMER_MANAGEMENT_PANEL.titleKo) return true
  if (normalized.toLowerCase() === PENDING_CUSTOMER_MANAGEMENT_PANEL.titleEn.toLowerCase()) {
    return true
  }
  return false
}

export function pendingCustomerManagementCompletionStorageKey(
  dateKey = pendingCustomerManagementCompletionDateKey()
): string {
  return `pending-customer-management.completed.${dateKey}`
}

export function readPendingCustomerManagementLocalCompleted(
  dateKey = pendingCustomerManagementCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(pendingCustomerManagementCompletionStorageKey(dateKey)) === '1'
}

export function writePendingCustomerManagementLocalCompleted(
  completed: boolean,
  dateKey = pendingCustomerManagementCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = pendingCustomerManagementCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type PendingCustomerManagementLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findPendingCustomerManagementLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForPendingCustomerManagementPanel(todo)) ?? null
}

export function pendingCustomerManagementTodoFormSeed(locale: string) {
  return {
    title: pendingCustomerManagementPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
    action_type: 'reservation_follow_up' as const,
    action_config: { tab: 'status' },
  }
}
