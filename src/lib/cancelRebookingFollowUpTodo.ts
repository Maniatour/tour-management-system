'use client'

import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

export const CANCEL_REBOOKING_FOLLOW_UP_PANEL = {
  titleKo: '취소 고객 재예약 권유',
  titleEn: 'Cancelled customer — rebook outreach',
} as const

/** 이전 Todo 제목(팀보드에 남아 있는 항목과 패널 연결용) */
export const CANCEL_REBOOKING_FOLLOW_UP_PANEL_LEGACY = {
  titleKo: '취소 / 상담중 고객 재예약 권유',
  titleEn: 'Cancelled / consulting — rebook outreach',
} as const

export function cancelRebookingFollowUpPanelTitle(locale: string): string {
  return locale === 'ko'
    ? CANCEL_REBOOKING_FOLLOW_UP_PANEL.titleKo
    : CANCEL_REBOOKING_FOLLOW_UP_PANEL.titleEn
}

export function cancelRebookingFollowUpCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

export function shouldHideTodoChipForCancelRebookingFollowUpPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === CANCEL_REBOOKING_FOLLOW_UP_PANEL.titleKo) return true
  if (normalized === CANCEL_REBOOKING_FOLLOW_UP_PANEL_LEGACY.titleKo) return true
  if (normalized.toLowerCase() === CANCEL_REBOOKING_FOLLOW_UP_PANEL.titleEn.toLowerCase()) {
    return true
  }
  if (
    normalized.toLowerCase() === CANCEL_REBOOKING_FOLLOW_UP_PANEL_LEGACY.titleEn.toLowerCase()
  ) {
    return true
  }
  return false
}

export function cancelRebookingFollowUpCompletionStorageKey(
  dateKey = cancelRebookingFollowUpCompletionDateKey()
): string {
  return `cancel-rebooking-follow-up.completed.${dateKey}`
}

export function readCancelRebookingFollowUpLocalCompleted(
  dateKey = cancelRebookingFollowUpCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(cancelRebookingFollowUpCompletionStorageKey(dateKey)) === '1'
}

export function writeCancelRebookingFollowUpLocalCompleted(
  completed: boolean,
  dateKey = cancelRebookingFollowUpCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = cancelRebookingFollowUpCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type CancelRebookingFollowUpLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findCancelRebookingFollowUpLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForCancelRebookingFollowUpPanel(todo)) ?? null
}

export function cancelRebookingFollowUpTodoFormSeed(locale: string) {
  return {
    title: cancelRebookingFollowUpPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
    action_type: 'reservation_follow_up' as const,
    action_config: { tab: 'cancel' },
  }
}
