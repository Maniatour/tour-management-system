import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

export const RENTAL_CAR_PICKUP_DROPOFF_PANEL = {
  titleKo: '렌트카 픽드랍 안내',
  titleEn: 'Rental pickup / return notice',
} as const

export function rentalCarPickupDropoffPanelTitle(locale: string): string {
  return locale === 'ko' ? RENTAL_CAR_PICKUP_DROPOFF_PANEL.titleKo : RENTAL_CAR_PICKUP_DROPOFF_PANEL.titleEn
}

export function rentalCarPickupDropoffCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

export function shouldHideTodoChipForRentalCarPickupDropoffPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === RENTAL_CAR_PICKUP_DROPOFF_PANEL.titleKo) return true
  if (normalized.toLowerCase() === RENTAL_CAR_PICKUP_DROPOFF_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function rentalCarPickupDropoffCompletionStorageKey(
  dateKey = rentalCarPickupDropoffCompletionDateKey()
): string {
  return `rental-car-pickup-dropoff.completed.${dateKey}`
}

export function readRentalCarPickupDropoffLocalCompleted(
  dateKey = rentalCarPickupDropoffCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(rentalCarPickupDropoffCompletionStorageKey(dateKey)) === '1'
}

export function writeRentalCarPickupDropoffLocalCompleted(
  completed: boolean,
  dateKey = rentalCarPickupDropoffCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = rentalCarPickupDropoffCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type RentalCarPickupDropoffLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findRentalCarPickupDropoffLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForRentalCarPickupDropoffPanel(todo)) ?? null
}

export function rentalCarPickupDropoffTodoFormSeed(locale: string) {
  return {
    title: rentalCarPickupDropoffPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
