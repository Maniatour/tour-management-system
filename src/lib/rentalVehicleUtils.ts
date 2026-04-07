/** YYYY-MM-DD 문자열을 달력 기준 로컬 자정 Date 로 파싱 (UTC 시프트 방지) */
function parseCalendarDate(ymd?: string | null): Date | null {
  if (!ymd?.trim()) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(y, mo, d)
}

/** 렌탈 시작일·종료일 포함 일수. 날짜가 없거나 종료가 시작보다 이르면 0 */
export function rentalInclusiveDayCount(start?: string | null, end?: string | null): number {
  const s = parseCalendarDate(start)
  const e = parseCalendarDate(end)
  if (!s || !e) return 0
  if (e < s) return 0
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
}

/**
 * 일일 환산·daily_rate 저장 시 나누는 일수.
 * 포함 일수에서 1일을 뺀 값(최소 1일) — 같은 날짜는 1일로 계산.
 */
export function rentalBillingDayCountForDailyRate(start?: string | null, end?: string | null): number {
  const inclusive = rentalInclusiveDayCount(start, end)
  if (inclusive <= 0) return 0
  return Math.max(1, inclusive - 1)
}

/** 예약 가격을 청구 일수(포함 일수 − 1, 최소 1)로 나눈 1일 환산 금액 */
export function rentalImpliedDailyUsd(
  bookingPrice: number,
  start?: string | null,
  end?: string | null
): { perDay: number; days: number } | null {
  const days = rentalBillingDayCountForDailyRate(start, end)
  if (days <= 0 || bookingPrice <= 0 || !Number.isFinite(bookingPrice)) return null
  return { perDay: Math.round((bookingPrice / days) * 100) / 100, days }
}
