import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const LV_TZ = 'America/Los_Angeles'

export type LvWeekRange = {
  /** 구간 시작일 (포함), YYYY-MM-DD, LV 달력 */
  startYmd: string
  /** 구간 말일 (포함), YYYY-MM-DD, LV 달력 — 기본(0)은 LV 기준 어제 */
  endYmd: string
  rangeStartIso: string
  rangeEndIso: string
}

/**
 * 예약 관리 "최근 7일" 주간: LV 달력 기준 어제를 말일로 두고 7일(말일 포함 6일 전~말일).
 * weekOffset 0 = 어제까지 7일, -1 = 그보다 7일 더 과거 (←), +1 = 말일이 어제에 가까워짐 (→).
 */
export function lvWeekRangeFromOffset(weekOffset: number): LvWeekRange {
  const yesterday = dayjs().tz(LV_TZ).subtract(1, 'day').startOf('day')
  const periodEnd = yesterday.add(weekOffset * 7, 'day')
  const periodStart = periodEnd.subtract(6, 'day')
  return {
    startYmd: periodStart.format('YYYY-MM-DD'),
    endYmd: periodEnd.format('YYYY-MM-DD'),
    rangeStartIso: periodStart.startOf('day').toISOString(),
    rangeEndIso: periodEnd.endOf('day').toISOString(),
  }
}

/** LV 달력 기준 YYYY-MM-DD 구간을 화면에 표시 (주간 네비 라벨) */
export function formatLvYmdRangeDisplay(startYmd: string, endYmd: string, localeTag: string): string {
  const opts = { timeZone: LV_TZ, month: 'short' as const, day: 'numeric' as const }
  const a = dayjs.tz(startYmd, LV_TZ).startOf('day').toDate()
  const b = dayjs.tz(endYmd, LV_TZ).startOf('day').toDate()
  return `${a.toLocaleDateString(localeTag, opts)} - ${b.toLocaleDateString(localeTag, opts)}`
}

/** LV 달력 기준 startYmd~endYmd(포함) 날짜 키 목록 */
/** YYYY-MM-DD를 LV 달력 그날로 해석해 긴 형식(요일·월·일·년)으로 표시 */
export function formatLvYmdLong(ymd: string, localeTag: string): string {
  return dayjs
    .tz(ymd, LV_TZ)
    .startOf('day')
    .toDate()
    .toLocaleDateString(localeTag, {
      timeZone: LV_TZ,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
}

export function lvInclusiveDateKeys(startYmd: string, endYmd: string): string[] {
  const keys: string[] = []
  let cur = dayjs.tz(startYmd, LV_TZ).startOf('day')
  const end = dayjs.tz(endYmd, LV_TZ).startOf('day')
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    keys.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return keys
}
