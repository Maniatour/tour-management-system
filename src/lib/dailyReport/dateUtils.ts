import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

export const LV_TZ = 'America/Los_Angeles'

export function todayInLasVegas(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** ISO 타임스탬프·YYYY-MM-DD → 라스베가스 기준 날짜 키 */
export function toLasVegasDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = dayjs(trimmed)
  if (!parsed.isValid()) return trimmed.length >= 10 ? trimmed.slice(0, 10) : null
  return parsed.tz(LV_TZ).format('YYYY-MM-DD')
}

export function formatLasVegasDate(
  value: string | null | undefined,
  locale: string
): string | null {
  const key = toLasVegasDateKey(value)
  if (!key) return null
  return new Date(`${key}T12:00:00`).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')
}

export function formatLasVegasDateTime(
  value: string | null | undefined,
  locale: string
): string | null {
  if (!value) return null
  const parsed = dayjs(value)
  if (!parsed.isValid()) return null
  return parsed.tz(LV_TZ).format(locale === 'ko' ? 'YYYY-MM-DD HH:mm' : 'MMM D, YYYY h:mm A')
}

export function tomorrowInLasVegas(fromDate?: string): string {
  const base = fromDate ? dayjs.tz(fromDate, LV_TZ) : dayjs().tz(LV_TZ)
  return base.add(1, 'day').format('YYYY-MM-DD')
}

export function lasVegasDayBounds(dateYmd: string): { start: string; end: string } {
  return lasVegasDateRangeBounds(dateYmd, dateYmd)
}

export function lasVegasDateRangeBounds(startYmd: string, endYmd: string): { start: string; end: string } {
  const start = dayjs.tz(startYmd, LV_TZ).startOf('day').toISOString()
  const end = dayjs.tz(endYmd, LV_TZ).endOf('day').toISOString()
  return { start, end }
}

export function isSingleDayReport(startYmd: string, endYmd: string): boolean {
  return startYmd === endYmd
}

export type DailyReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'

export function getDailyReportDatePreset(preset: DailyReportDatePreset): { start: string; end: string } {
  const now = dayjs().tz(LV_TZ)

  switch (preset) {
    case 'today':
      return { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') }
    case 'yesterday': {
      const yesterday = now.subtract(1, 'day')
      return { start: yesterday.format('YYYY-MM-DD'), end: yesterday.format('YYYY-MM-DD') }
    }
    case 'this_week':
      return {
        start: now.startOf('isoWeek').format('YYYY-MM-DD'),
        end: now.format('YYYY-MM-DD'),
      }
    case 'last_week': {
      const lastWeekEnd = now.startOf('isoWeek').subtract(1, 'day')
      return {
        start: lastWeekEnd.startOf('isoWeek').format('YYYY-MM-DD'),
        end: lastWeekEnd.format('YYYY-MM-DD'),
      }
    }
    case 'this_month':
      return {
        start: now.startOf('month').format('YYYY-MM-DD'),
        end: now.format('YYYY-MM-DD'),
      }
    case 'last_month': {
      const lastMonth = now.subtract(1, 'month')
      return {
        start: lastMonth.startOf('month').format('YYYY-MM-DD'),
        end: lastMonth.endOf('month').format('YYYY-MM-DD'),
      }
    }
  }
}

export const DAILY_REPORT_DATE_PRESET_LABELS: Record<
  DailyReportDatePreset,
  { ko: string; en: string }
> = {
  today: { ko: '오늘', en: 'Today' },
  yesterday: { ko: '어제', en: 'Yesterday' },
  this_week: { ko: '이번 주', en: 'This week' },
  last_week: { ko: '지난 주', en: 'Last week' },
  this_month: { ko: '이번 달', en: 'This month' },
  last_month: { ko: '지난 달', en: 'Last month' },
}

export function formatReportDateRangeLabel(startYmd: string, endYmd: string, locale = 'ko'): string {
  if (isSingleDayReport(startYmd, endYmd)) {
    return formatReportDateLabel(startYmd, locale)
  }

  const start = dayjs.tz(startYmd, LV_TZ)
  const end = dayjs.tz(endYmd, LV_TZ)

  if (locale.startsWith('ko')) {
    if (start.year() === end.year() && start.month() === end.month()) {
      return `${start.format('YYYY년 M월 D일')} ~ ${end.format('D일')}`
    }
    if (start.year() === end.year()) {
      return `${start.format('YYYY년 M월 D일')} ~ ${end.format('M월 D일')}`
    }
    return `${start.format('YYYY년 M월 D일')} ~ ${end.format('YYYY년 M월 D일')}`
  }

  if (start.year() === end.year()) {
    return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`
  }
  return `${start.format('MMM D, YYYY')} – ${end.format('MMM D, YYYY')}`
}

export function formatReportDateLabel(dateYmd: string, locale = 'ko'): string {
  const d = dayjs.tz(dateYmd, LV_TZ)
  if (locale.startsWith('ko')) {
    return d.format('YYYY년 M월 D일 (ddd)')
  }
  return d.format('dddd, MMM D, YYYY')
}
