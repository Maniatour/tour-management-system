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
