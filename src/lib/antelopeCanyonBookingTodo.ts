import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const ANTELOPE_CANYON_BOOKING_PANEL = {
  titleKo: '앤텔롭캐년 부킹 관리',
  titleEn: 'Antelope Canyon booking management',
} as const

/** 추가·변경 섹션: 오늘부터 며칠 이내 투어 */
export const ANTELOPE_MISMATCH_LOOKAHEAD_DAYS = 3

/** Due Date 섹션: 체크인 D+N (2일 후 투어) */
export const ANTELOPE_CANCEL_DUE_CHECKIN_OFFSET_DAYS = 2

export function antelopeCanyonBookingPanelTitle(locale: string): string {
  return locale === 'ko'
    ? ANTELOPE_CANYON_BOOKING_PANEL.titleKo
    : ANTELOPE_CANYON_BOOKING_PANEL.titleEn
}

export function antelopeCanyonBookingCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

export function antelopeCanyonBookingMismatchDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(ANTELOPE_MISMATCH_LOOKAHEAD_DAYS, 'day').format('YYYY-MM-DD')
  return { start, end }
}

export function antelopeCanyonBookingCancelDueCheckInYmd(): string {
  return dayjs()
    .tz(LV_TZ)
    .add(ANTELOPE_CANCEL_DUE_CHECKIN_OFFSET_DAYS, 'day')
    .format('YYYY-MM-DD')
}

export function shouldHideTodoChipForAntelopeCanyonBookingPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === ANTELOPE_CANYON_BOOKING_PANEL.titleKo) return true
  if (normalized.toLowerCase() === ANTELOPE_CANYON_BOOKING_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function antelopeCanyonBookingCompletionStorageKey(
  dateKey = antelopeCanyonBookingCompletionDateKey()
): string {
  return `antelope-canyon-booking.completed.${dateKey}`
}

export function readAntelopeCanyonBookingLocalCompleted(
  dateKey = antelopeCanyonBookingCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(antelopeCanyonBookingCompletionStorageKey(dateKey)) === '1'
}

export function writeAntelopeCanyonBookingLocalCompleted(
  completed: boolean,
  dateKey = antelopeCanyonBookingCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = antelopeCanyonBookingCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type AntelopeCanyonBookingLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findAntelopeCanyonBookingLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForAntelopeCanyonBookingPanel(todo)) ?? null
}

export function antelopeCanyonBookingTodoFormSeed(locale: string) {
  return {
    title: antelopeCanyonBookingPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
