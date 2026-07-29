import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const GUIDE_SCHEDULE_CONFIRM_PANEL = {
  titleKo: '가이드와 스케줄 컨펌',
  titleEn: 'Guide & schedule confirm',
} as const

export function guideScheduleConfirmPanelTitle(locale: string): string {
  return locale === 'ko' ? GUIDE_SCHEDULE_CONFIRM_PANEL.titleKo : GUIDE_SCHEDULE_CONFIRM_PANEL.titleEn
}

export function guideScheduleConfirmCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

export function guideScheduleConfirmTargetDates(): [string, string] {
  const base = dayjs().tz(LV_TZ)
  return [base.add(1, 'day').format('YYYY-MM-DD'), base.add(2, 'day').format('YYYY-MM-DD')]
}

export function shouldHideTodoChipForGuideScheduleConfirmPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === GUIDE_SCHEDULE_CONFIRM_PANEL.titleKo) return true
  if (normalized.toLowerCase() === GUIDE_SCHEDULE_CONFIRM_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function guideScheduleConfirmCompletionStorageKey(dateKey = guideScheduleConfirmCompletionDateKey()): string {
  return `guide-schedule-confirm.completed.${dateKey}`
}

export function readGuideScheduleConfirmLocalCompleted(dateKey = guideScheduleConfirmCompletionDateKey()): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(guideScheduleConfirmCompletionStorageKey(dateKey)) === '1'
}

export function writeGuideScheduleConfirmLocalCompleted(
  completed: boolean,
  dateKey = guideScheduleConfirmCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = guideScheduleConfirmCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type GuideScheduleConfirmLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findGuideScheduleConfirmLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForGuideScheduleConfirmPanel(todo)) ?? null
}

export function guideScheduleConfirmTodoFormSeed(locale: string) {
  return {
    title: guideScheduleConfirmPanelTitle(locale),
    category: 'daily' as const,
    department: 'guide' as const,
  }
}
