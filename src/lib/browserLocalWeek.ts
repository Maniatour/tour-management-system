/**
 * 예약 관리 "최근 7일" — 브라우저(운영 PC) 로컬 달력 기준.
 * 등록일/수정일 그룹(isoToLocalCalendarDateKey)과 주간 조회 구간을 동일 타임존으로 맞춤.
 * 말일은 오늘(포함) — 오늘 등록분이 조회·그룹 모두에서 같은 날짜로 잡힘.
 */

export type BrowserLocalWeekRange = {
  startYmd: string
  endYmd: string
  rangeStartIso: string
  rangeEndIso: string
}

/**
 * 오늘을 말일로 하는 7일 구간(말일 포함 7일). weekOffset 0 = 오늘까지 7일, -1 = 7일 더 과거.
 */
export function browserLocalWeekRangeFromOffset(weekOffset: number): BrowserLocalWeekRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const periodEndDay = new Date(today)
  periodEndDay.setDate(today.getDate() + weekOffset * 7)

  const periodStartDay = new Date(periodEndDay)
  periodStartDay.setDate(periodEndDay.getDate() - 6)
  periodStartDay.setHours(0, 0, 0, 0)

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const startYmd = ymd(periodStartDay)
  const endYmd = ymd(periodEndDay)

  const rangeStartIso = new Date(
    periodStartDay.getFullYear(),
    periodStartDay.getMonth(),
    periodStartDay.getDate(),
    0,
    0,
    0,
    0
  ).toISOString()
  const rangeEndIso = new Date(
    periodEndDay.getFullYear(),
    periodEndDay.getMonth(),
    periodEndDay.getDate(),
    23,
    59,
    59,
    999
  ).toISOString()

  return { startYmd, endYmd, rangeStartIso, rangeEndIso }
}

/** 브라우저 로컬 달력 기준 오늘 YYYY-MM-DD */
export function browserLocalTodayYmd(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 브라우저 로컬 달력 기준 어제 YYYY-MM-DD */
export function browserLocalYesterdayYmd(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 브라우저 로컬 달력 기준, 오늘을 말일로 한 `days`일(오늘 포함) 구간의 시작 시각 ISO.
 * 예: days=7 → 오늘 포함 7일의 첫날 00:00:00.000 (created_at >= 이 값이면 “최근 7일 등록”).
 */
export function browserLocalCreatedAtGteIsoForRecentCalendarDays(days: number): string {
  const n = Number.isFinite(days) && days >= 1 ? Math.floor(days) : 7
  const endDay = new Date()
  endDay.setHours(0, 0, 0, 0)
  const startDay = new Date(endDay)
  startDay.setDate(endDay.getDate() - (n - 1))
  startDay.setHours(0, 0, 0, 0)
  return new Date(
    startDay.getFullYear(),
    startDay.getMonth(),
    startDay.getDate(),
    0,
    0,
    0,
    0
  ).toISOString()
}

export function browserLocalInclusiveDateKeys(startYmd: string, endYmd: string): string[] {
  const [ys, ms, ds] = startYmd.split('-').map(Number)
  const [ye, me, de] = endYmd.split('-').map(Number)
  const keys: string[] = []
  const cur = new Date(ys, ms - 1, ds, 12, 0, 0, 0)
  const end = new Date(ye, me - 1, de, 12, 0, 0, 0)
  while (cur.getTime() <= end.getTime()) {
    keys.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    )
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

export function formatBrowserLocalYmdRangeDisplay(startYmd: string, endYmd: string, localeTag: string): string {
  const [ys, ms, ds] = startYmd.split('-').map(Number)
  const [ye, me, de] = endYmd.split('-').map(Number)
  const a = new Date(ys, ms - 1, ds)
  const b = new Date(ye, me - 1, de)
  const opts = { month: 'short' as const, day: 'numeric' as const }
  return `${a.toLocaleDateString(localeTag, opts)} - ${b.toLocaleDateString(localeTag, opts)}`
}

const ymdFromDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 달력 한 달(1일~말일). monthOffset 0 = 이번 달, -1 = 지난 달.
 */
export function browserLocalCalendarMonthWindow(monthOffset: number): BrowserLocalWeekRange {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const anchor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const startMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  lastDay.setHours(23, 59, 59, 999)
  startMonth.setHours(0, 0, 0, 0)
  const startYmd = ymdFromDate(startMonth)
  const endYmd = ymdFromDate(lastDay)
  const rangeStartIso = new Date(
    startMonth.getFullYear(),
    startMonth.getMonth(),
    startMonth.getDate(),
    0,
    0,
    0,
    0
  ).toISOString()
  const rangeEndIso = lastDay.toISOString()
  return { startYmd, endYmd, rangeStartIso, rangeEndIso }
}

/**
 * 달력 한 연도(1/1~12/31). yearOffset 0 = 올해, -1 = 작년.
 */
export function browserLocalCalendarYearWindow(yearOffset: number): BrowserLocalWeekRange {
  const y = new Date().getFullYear() + yearOffset
  const startYmd = `${y}-01-01`
  const endYmd = `${y}-12-31`
  const rangeStartIso = new Date(y, 0, 1, 0, 0, 0, 0).toISOString()
  const rangeEndIso = new Date(y, 11, 31, 23, 59, 59, 999).toISOString()
  return { startYmd, endYmd, rangeStartIso, rangeEndIso }
}

/** 해당 연도의 1~12월 키 `YYYY-MM` (시간순) */
export function browserLocalCalendarYearMonthKeys(yearOffset: number): string[] {
  const y = new Date().getFullYear() + yearOffset
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
}
