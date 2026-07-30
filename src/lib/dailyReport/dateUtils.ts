import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export const LV_TZ = 'America/Los_Angeles'

export function todayInLasVegas(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

export function tomorrowInLasVegas(fromDate?: string): string {
  const base = fromDate ? dayjs.tz(fromDate, LV_TZ) : dayjs().tz(LV_TZ)
  return base.add(1, 'day').format('YYYY-MM-DD')
}

export function lasVegasDayBounds(dateYmd: string): { start: string; end: string } {
  const start = dayjs.tz(dateYmd, LV_TZ).startOf('day').toISOString()
  const end = dayjs.tz(dateYmd, LV_TZ).endOf('day').toISOString()
  return { start, end }
}

export function formatReportDateLabel(dateYmd: string, locale = 'ko'): string {
  const d = dayjs.tz(dateYmd, LV_TZ)
  if (locale.startsWith('ko')) {
    return d.format('YYYY년 M월 D일 (ddd)')
  }
  return d.format('dddd, MMM D, YYYY')
}
