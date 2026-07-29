import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const TOUR_HOTEL_MANAGEMENT_PANEL = {
  titleKo: '투어 호텔 관리',
  titleEn: 'Tour hotel management',
} as const

export function tourHotelManagementPanelTitle(locale: string): string {
  return locale === 'ko' ? TOUR_HOTEL_MANAGEMENT_PANEL.titleKo : TOUR_HOTEL_MANAGEMENT_PANEL.titleEn
}

export function tourHotelManagementCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

export function tourHotelManagementDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(90, 'day').format('YYYY-MM-DD')
  return { start, end }
}

export function shouldHideTodoChipForTourHotelManagementPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === TOUR_HOTEL_MANAGEMENT_PANEL.titleKo) return true
  if (normalized.toLowerCase() === TOUR_HOTEL_MANAGEMENT_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function tourHotelManagementCompletionStorageKey(
  dateKey = tourHotelManagementCompletionDateKey()
): string {
  return `tour-hotel-management.completed.${dateKey}`
}

export function readTourHotelManagementLocalCompleted(
  dateKey = tourHotelManagementCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(tourHotelManagementCompletionStorageKey(dateKey)) === '1'
}

export function writeTourHotelManagementLocalCompleted(
  completed: boolean,
  dateKey = tourHotelManagementCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = tourHotelManagementCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type TourHotelManagementLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findTourHotelManagementLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForTourHotelManagementPanel(todo)) ?? null
}

export function tourHotelManagementTodoFormSeed(locale: string) {
  return {
    title: tourHotelManagementPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
