/** 명세 대조 검색 — M/D 등 입력 시 거래일 ±일 */
export const STATEMENT_SEARCH_DATE_WINDOW_DAYS = 3

export type StatementSearchDateRange = {
  centerYmd: string
  startYmd: string
  endYmd: string
}

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const core = ymd.trim().slice(0, 10)
  const parts = core.split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return core
  const [yy, mm, dd] = parts
  const d = new Date(yy, mm - 1, dd)
  if (Number.isNaN(d.getTime())) return core
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatYmd(year: number, month: number, day: number): string | null {
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return null
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  const m = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${m}-${dd}`
}

function rangeFromCenter(centerYmd: string, windowDays: number): StatementSearchDateRange {
  return {
    centerYmd,
    startYmd: addCalendarDaysYmd(centerYmd, -windowDays),
    endYmd: addCalendarDaysYmd(centerYmd, windowDays),
  }
}

/**
 * 명세 대조 검색어가 날짜(6/14, 2025-06-14 등)이면 거래일 ±windowDays 구간을 반환합니다.
 * 연도가 없으면 referenceYear(기본: 올해)를 사용합니다.
 */
export function parseStatementSearchDateQuery(
  raw: string,
  opts?: { referenceYear?: number; windowDays?: number }
): StatementSearchDateRange | null {
  const q = String(raw ?? '').trim()
  if (!q) return null
  const windowDays = opts?.windowDays ?? STATEMENT_SEARCH_DATE_WINDOW_DAYS
  const refYear = opts?.referenceYear ?? new Date().getFullYear()

  const withYear = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(q)
  if (withYear) {
    const ymd = formatYmd(Number(withYear[1]), Number(withYear[2]), Number(withYear[3]))
    if (ymd) return rangeFromCenter(ymd, windowDays)
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q)
  if (iso) {
    const ymd = formatYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    if (ymd) return rangeFromCenter(ymd, windowDays)
  }

  const monthDay = /^(\d{1,2})[/.-](\d{1,2})$/.exec(q)
  if (monthDay) {
    const month = Number(monthDay[1])
    const day = Number(monthDay[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const ymd = formatYmd(refYear, month, day)
      if (ymd) return rangeFromCenter(ymd, windowDays)
    }
  }

  return null
}

export function isYmdWithinInclusiveRange(ymd: string, startYmd: string, endYmd: string): boolean {
  const core = String(ymd ?? '').trim().slice(0, 10)
  if (core.length < 10) return false
  return core >= startYmd && core <= endYmd
}

export function statementSearchReferenceYearFromMonthFilter(selectedMonth: string): number | undefined {
  const m = /^(\d{4})-\d{2}$/.exec(String(selectedMonth ?? '').trim())
  if (!m) return undefined
  const y = Number(m[1])
  return Number.isFinite(y) ? y : undefined
}
