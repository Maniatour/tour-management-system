import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { getMultiDayTourDays } from '@/lib/scheduleVehicleOilMaintenance'
import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

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
  return opTodoBusinessDateKey()
}

export function tourHotelManagementDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(90, 'day').format('YYYY-MM-DD')
  return { start, end }
}

/**
 * Multi-day tour overnight stays (Page/Kanab area).
 * N nights = tour days − 1, starting on tour_date.
 */
export function resolveMultiDayHotelSurveyNights(
  tourDate: string,
  productId: string | null | undefined
): Array<{ checkIn: string; checkOut: string; nightIndex: number }> {
  const start = String(tourDate || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return []
  const days = getMultiDayTourDays(String(productId || '').trim())
  const nightCount = Math.max(0, days - 1)
  const nights: Array<{ checkIn: string; checkOut: string; nightIndex: number }> = []
  for (let i = 0; i < nightCount; i++) {
    const checkIn = dayjs(start).add(i, 'day').format('YYYY-MM-DD')
    const checkOut = dayjs(start).add(i + 1, 'day').format('YYYY-MM-DD')
    nights.push({ checkIn, checkOut, nightIndex: i + 1 })
  }
  return nights
}

export function shouldHideTodoChipForTourHotelManagementPanel(todo: {
  title?: string | null
}): boolean {
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
