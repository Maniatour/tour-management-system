import dayjs from 'dayjs'
import { FULL_TIME_DAILY_HOURS, normalizeRestDays } from '@/lib/officeScheduleEmployeeSettings'
import { officeScheduleSlotKey } from '@/lib/officeScheduleMonthDays'

export type OfficeBatchShift = 'first_half' | 'second_half'

/** First half: from 12:00. Second half: from 16:00. Each fills 8 hour slots. */
export const BATCH_SHIFT_FIRST_HALF_START_HOUR = 12
export const BATCH_SHIFT_SECOND_HALF_START_HOUR = 16

export function hourSlotsForBatchShift(shift: OfficeBatchShift): number[] {
  const start =
    shift === 'first_half'
      ? BATCH_SHIFT_FIRST_HALF_START_HOUR
      : BATCH_SHIFT_SECOND_HALF_START_HOUR
  const slots: number[] = []
  for (let i = 0; i < FULL_TIME_DAILY_HOURS; i++) {
    const hour = start + i
    if (hour >= 9 && hour <= 23) slots.push(hour)
  }
  return slots
}

export function batchShiftTimeLabel(shift: OfficeBatchShift): string {
  return shift === 'first_half' ? '12:00 PM' : '4:00 PM'
}

export function workDatesInMonth(monthYmd: string, restDays: number[]): string[] {
  const monthStart = dayjs(`${monthYmd}-01`)
  const daysInMonth = monthStart.daysInMonth()
  const rest = new Set(normalizeRestDays(restDays))
  const dates: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = monthStart.date(d)
    if (!rest.has(date.day())) {
      dates.push(date.format('YYYY-MM-DD'))
    }
  }
  return dates
}

export function buildBatchShiftSlotKeys(
  email: string,
  monthYmd: string,
  restDays: number[],
  shift: OfficeBatchShift
): string[] {
  const dates = workDatesInMonth(monthYmd, restDays)
  const hourSlots = hourSlotsForBatchShift(shift)
  const keys: string[] = []
  for (const date of dates) {
    for (const hourSlot of hourSlots) {
      keys.push(officeScheduleSlotKey(email, date, hourSlot))
    }
  }
  return keys
}

export function countNewBatchShiftSlots(
  draftSlotMap: Map<string, { note: string | null }>,
  email: string,
  monthYmd: string,
  restDays: number[],
  shift: OfficeBatchShift
): number {
  const keys = buildBatchShiftSlotKeys(email, monthYmd, restDays, shift)
  return keys.filter((key) => !draftSlotMap.has(key)).length
}
