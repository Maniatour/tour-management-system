import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { LV_TZ } from '@/lib/lasVegasCalendar'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Online waiver signing closes at 5:00 PM Las Vegas time the day before the tour. */
export const WAIVER_ONLINE_SIGNING_CUTOFF_HOUR = 17
export const WAIVER_PRINT_REMINDER_MINUTE = 5

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function waiverOnlineSigningClosesAt(tourDate: string): Date | null {
  if (!isYmd(tourDate)) return null
  return dayjs
    .tz(tourDate, LV_TZ)
    .subtract(1, 'day')
    .hour(WAIVER_ONLINE_SIGNING_CUTOFF_HOUR)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toDate()
}

export function isWaiverOnlineSigningClosed(tourDate: string, now: Date = new Date()): boolean {
  const closesAt = waiverOnlineSigningClosesAt(tourDate)
  if (!closesAt) return false
  return now.getTime() >= closesAt.getTime()
}

/** Staff print reminder: 5:05 PM Las Vegas time and later the same calendar day. */
export function isWaiverPrintReminderWindow(now: Date = new Date()): boolean {
  const lv = dayjs(now).tz(LV_TZ)
  const minutes = lv.hour() * 60 + lv.minute()
  return minutes >= WAIVER_ONLINE_SIGNING_CUTOFF_HOUR * 60 + WAIVER_PRINT_REMINDER_MINUTE
}

export function tomorrowTourDateYmd(now: Date = new Date()): string {
  return dayjs(now).tz(LV_TZ).add(1, 'day').format('YYYY-MM-DD')
}

export function todayLasVegasYmd(now: Date = new Date()): string {
  return dayjs(now).tz(LV_TZ).format('YYYY-MM-DD')
}
