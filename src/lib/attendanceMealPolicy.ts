import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getHourlyRateForEmployeeOnDate,
  employeeHasHourlyPeriods,
  workCalendarDateYmd,
  type EmployeeRatePeriod,
} from '@/lib/employeeHourlyRates'

/** 신규 정산: 8시간 자동 식사차감 없음 → 사무실 식사 기록으로만 차감 (이 날짜부터 적용, 달력 YYYY-MM-DD) */
export const OFFICE_MEAL_POLICY_START = '2026-04-01'

/** 사무실 식사 화면에서만 선택 가능한 직원(team 이메일, 대소문자 무시 비교) */
export const OFFICE_MEAL_SELECTABLE_EMAILS: readonly string[] = [
  'lmtchad@gmail.com',
  'maniaoffice1@gmail.com',
  'wooyong.shim09@gmail.com',
  'lvmania206@gmail.com',
  'hana.myers1@gmail.com',
] as const

const OFFICE_MEAL_SELECTABLE_LOWER = new Set(
  OFFICE_MEAL_SELECTABLE_EMAILS.map((e) => e.toLowerCase())
)

export function isOfficeMealSelectableEmail(email: string): boolean {
  return OFFICE_MEAL_SELECTABLE_LOWER.has(email.trim().toLowerCase())
}

const MEAL_DEDUCT_HOURS = 0.5

export type AttendanceRecordLike = {
  id: string
  work_hours: number
  check_in_time: string | null
  date: string
  session_number?: number
}

export function calendarDateFromAttendanceRecord(record: AttendanceRecordLike): string | null {
  if (!record.date) return null
  return workCalendarDateYmd({ check_in_time: record.check_in_time ?? null, date: record.date })
}

/** 기존 규칙: 세션당 8시간 초과 시 30분 차감 */
export function applyLegacyEightHourMealDeduction(workHours: number): number {
  const wh = workHours || 0
  return wh > 8 ? wh - MEAL_DEDUCT_HOURS : wh
}

export function sortAttendanceRecordsForMealPolicy<T extends AttendanceRecordLike>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const ta = a.check_in_time ? new Date(a.check_in_time).getTime() : Number.MAX_SAFE_INTEGER
    const tb = b.check_in_time ? new Date(b.check_in_time).getTime() : Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    const da = calendarDateFromAttendanceRecord(a) || ''
    const db = calendarDateFromAttendanceRecord(b) || ''
    if (da !== db) return da.localeCompare(db)
    return (a.session_number ?? 0) - (b.session_number ?? 0)
  })
}

/** 같은 달력일의 첫 출근 세션(정렬된 목록 기준) — 식사 30분은 해당일 1회만 차감 */
export function firstSessionIdByDay(sortedRecords: AttendanceRecordLike[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of sortedRecords) {
    const d = calendarDateFromAttendanceRecord(r)
    if (!d) continue
    if (!map.has(d)) map.set(d, r.id)
  }
  return map
}

/**
 * @param mode applied — 3월말 이전은 8시간 규칙, 4/1~는 식사 기록 시 당일 첫 세션에서만 30분 차감
 * @param mode all_legacy — 비교용: 전 기간 8시간 초과 자동 차감
 */
export function adjustedWorkHoursForPay(
  record: AttendanceRecordLike,
  sortedRecords: AttendanceRecordLike[],
  mealDates: Set<string>,
  mode: 'applied' | 'all_legacy'
): number {
  const wh = record.work_hours || 0
  const d = calendarDateFromAttendanceRecord(record)
  if (!d) return wh

  if (mode === 'all_legacy') {
    return applyLegacyEightHourMealDeduction(wh)
  }

  if (d < OFFICE_MEAL_POLICY_START) {
    return applyLegacyEightHourMealDeduction(wh)
  }

  const firstByDay = firstSessionIdByDay(sortedRecords)
  if (mealDates.has(d) && firstByDay.get(d) === record.id) {
    return Math.max(0, wh - MEAL_DEDUCT_HOURS)
  }
  return wh
}

export function computeBiweeklyAttendancePayDual(
  records: AttendanceRecordLike[],
  employeeEmail: string,
  hourlyRate: string,
  periods: EmployeeRatePeriod[],
  mealDates: Set<string>
): { applied: number; legacyAuto: number } {
  const sorted = sortAttendanceRecordsForMealPolicy(records)

  if (employeeHasHourlyPeriods(periods, employeeEmail)) {
    let applied = 0
    let legacyAuto = 0
    for (const record of sorted) {
      const d = calendarDateFromAttendanceRecord(record)
      if (!d) continue
      const rate = getHourlyRateForEmployeeOnDate(periods, employeeEmail, d, 15)
      applied += adjustedWorkHoursForPay(record, sorted, mealDates, 'applied') * rate
      legacyAuto += adjustedWorkHoursForPay(record, sorted, mealDates, 'all_legacy') * rate
    }
    return { applied, legacyAuto }
  }

  const rateNum = hourlyRate && !isNaN(Number(hourlyRate)) ? Number(hourlyRate) : 0
  const appliedHours = sorted.reduce(
    (sum, record) => sum + adjustedWorkHoursForPay(record, sorted, mealDates, 'applied'),
    0
  )
  const legacyHours = sorted.reduce(
    (sum, record) => sum + adjustedWorkHoursForPay(record, sorted, mealDates, 'all_legacy'),
    0
  )
  return {
    applied: appliedHours * rateNum,
    legacyAuto: legacyHours * rateNum,
  }
}

/** 라스베가스 타임존 기준 오늘 날짜 YYYY-MM-DD */
export function lasVegasTodayYmd(): string {
  const now = new Date()
  const las = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const y = las.getFullYear()
  const m = String(las.getMonth() + 1).padStart(2, '0')
  const d = String(las.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, mo, da] = ymd.split('-').map(Number)
  const dt = new Date(y, mo - 1, da + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export async function fetchOfficeMealCountsInRange(
  client: SupabaseClient,
  startYmd: string,
  endYmd: string
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('office_meal_log')
    .select('employee_email')
    .gte('meal_date', startYmd)
    .lte('meal_date', endYmd)

  if (error) {
    console.error('office_meal_log 집계 조회 오류:', error)
    return {}
  }
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const em = (row as { employee_email: string }).employee_email
    if (!isOfficeMealSelectableEmail(em)) continue
    counts[em] = (counts[em] || 0) + 1
  }
  return counts
}
