import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { OtaSaleStatus } from '@/lib/otaPriceInventory'
import {
  needsOtaRemainingSiteUpdate,
  requiresOtaPlatformClosure,
  resolveVehicleRemaining,
  type ChannelVariantListing,
  type OtaChannelInventoryRow,
} from '@/lib/otaPriceInventory'
import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const OTA_CLOSURE_PANEL = {
  titleKo: 'OTA 마감 처리',
  titleEn: 'OTA closure',
} as const

export function otaClosurePanelTitle(locale: string): string {
  return locale === 'ko' ? OTA_CLOSURE_PANEL.titleKo : OTA_CLOSURE_PANEL.titleEn
}

export function otaClosureCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

/** 오늘 포함 앞으로 7일 (LA 기준) */
export function otaClosureTargetDates(): string[] {
  const base = dayjs().tz(LV_TZ)
  return Array.from({ length: 7 }, (_, i) => base.add(i, 'day').format('YYYY-MM-DD'))
}

export function otaClosureDateRange(): { start: string; end: string } {
  const dates = otaClosureTargetDates()
  return { start: dates[0]!, end: dates[dates.length - 1]! }
}

export function shouldHideTodoChipForOtaClosurePanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === OTA_CLOSURE_PANEL.titleKo) return true
  if (normalized.toLowerCase() === OTA_CLOSURE_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function otaClosureCompletionStorageKey(dateKey = otaClosureCompletionDateKey()): string {
  return `ota-closure.completed.${dateKey}`
}

export function readOtaClosureLocalCompleted(dateKey = otaClosureCompletionDateKey()): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(otaClosureCompletionStorageKey(dateKey)) === '1'
}

export function writeOtaClosureLocalCompleted(
  completed: boolean,
  dateKey = otaClosureCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = otaClosureCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type OtaClosureLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findOtaClosureLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForOtaClosurePanel(todo)) ?? null
}

export function otaClosureTodoFormSeed(locale: string) {
  return {
    title: otaClosurePanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}

export function getOtaClosureListingsForDate(
  date: string,
  status: OtaSaleStatus,
  closureTargetListings: ChannelVariantListing[],
  inventoryByListingAndDate: Record<string, Record<string, OtaChannelInventoryRow>>,
  internalSpotsLeft?: number | null
): ChannelVariantListing[] {
  if (!requiresOtaPlatformClosure(status)) return []
  return closureTargetListings.filter((listing) => {
    const row = inventoryByListingAndDate[listing.id]?.[date]
    const currentRemaining = resolveVehicleRemaining(row, internalSpotsLeft)
    return needsOtaRemainingSiteUpdate(row, currentRemaining)
  })
}
