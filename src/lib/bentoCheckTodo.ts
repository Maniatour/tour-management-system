import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const BENTO_CHECK_PANEL = {
  titleKo: '도시락 체크',
  titleEn: 'Bento check',
} as const

/** 도시락 주문 대상: 투어일 D+N (오늘 기준 2일 후) */
export const BENTO_CHECK_TOUR_OFFSET_DAYS = 2

export function bentoCheckPanelTitle(locale: string): string {
  return locale === 'ko' ? BENTO_CHECK_PANEL.titleKo : BENTO_CHECK_PANEL.titleEn
}

export function bentoCheckCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

export function bentoCheckTargetTourDate(): string {
  return dayjs().tz(LV_TZ).add(BENTO_CHECK_TOUR_OFFSET_DAYS, 'day').format('YYYY-MM-DD')
}

export function shouldHideTodoChipForBentoCheckPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === BENTO_CHECK_PANEL.titleKo) return true
  if (normalized.toLowerCase() === BENTO_CHECK_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function bentoCheckCompletionStorageKey(dateKey = bentoCheckCompletionDateKey()): string {
  return `bento-check.completed.${dateKey}`
}

export function readBentoCheckLocalCompleted(dateKey = bentoCheckCompletionDateKey()): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(bentoCheckCompletionStorageKey(dateKey)) === '1'
}

export function writeBentoCheckLocalCompleted(
  completed: boolean,
  dateKey = bentoCheckCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = bentoCheckCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type BentoCheckLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findBentoCheckLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForBentoCheckPanel(todo)) ?? null
}

export function bentoCheckTodoFormSeed(locale: string) {
  return {
    title: bentoCheckPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
