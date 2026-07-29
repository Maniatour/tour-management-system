import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { tourDateFromOffset } from '@/lib/opTodoAction'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

/** Todo List에 항상 표시되는 고정 패널 (DB Todo와 무관) */
export const TOUR_ENVELOPE_PRINT_PANEL = {
  titleKo: '투어 봉투 프린트',
  titleEn: 'Tour envelope print',
  /** 내일 출발 투어 (Las Vegas 기준 D+1) */
  dateOffsetDays: 1,
} as const

export function tourEnvelopePrintPanelTitle(locale: string): string {
  return locale === 'ko' ? TOUR_ENVELOPE_PRINT_PANEL.titleKo : TOUR_ENVELOPE_PRINT_PANEL.titleEn
}

export function tourEnvelopePrintTargetDate(): string {
  const fromOffset = tourDateFromOffset(TOUR_ENVELOPE_PRINT_PANEL.dateOffsetDays)
  if (fromOffset) return fromOffset
  return dayjs().tz(LV_TZ).add(TOUR_ENVELOPE_PRINT_PANEL.dateOffsetDays, 'day').format('YYYY-MM-DD')
}

export function tourEnvelopePrintDateLabel(date: string, locale: string): string {
  const isKo = locale === 'ko'
  const d = dayjs.tz(date, LV_TZ)
  if (!d.isValid()) return date
  if (isKo) return d.format('M월 D일 (ddd)')
  return d.format('MMM D (ddd)')
}

/** DB에 동일 제목 Todo가 있으면 칩 목록에서 숨김 (고정 패널과 중복 방지) */
export function shouldHideTodoChipForEnvelopePrintPanel(todo: {
  title?: string | null
  action_type?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === TOUR_ENVELOPE_PRINT_PANEL.titleKo) return true
  if (normalized.toLowerCase() === TOUR_ENVELOPE_PRINT_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function tourEnvelopePrintCompletionStorageKey(targetDate: string): string {
  return `tour-envelope-print.completed.${targetDate}`
}

export function readTourEnvelopePrintLocalCompleted(targetDate: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(tourEnvelopePrintCompletionStorageKey(targetDate)) === '1'
}

export function writeTourEnvelopePrintLocalCompleted(targetDate: string, completed: boolean): void {
  if (typeof window === 'undefined') return
  const key = tourEnvelopePrintCompletionStorageKey(targetDate)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type TourEnvelopePrintLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
}

export function findTourEnvelopePrintLinkedTodo<T extends { title?: string | null; id: string; completed: boolean }>(
  todos: T[]
): T | null {
  return todos.find((todo) => shouldHideTodoChipForEnvelopePrintPanel(todo)) ?? null
}

/** DB Todo가 없을 때 생성 모달에 채울 기본값 */
export function tourEnvelopePrintTodoFormSeed(locale: string) {
  return {
    title: tourEnvelopePrintPanelTitle(locale),
    category: 'daily' as const,
    department: 'common' as const,
  }
}
