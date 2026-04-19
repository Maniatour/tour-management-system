import type { SupabaseClient } from '@supabase/supabase-js'

export type EmployeeRatePeriod = {
  id?: string
  employee_email: string
  hourly_rate: number
  effective_from: string
  effective_to: string | null
  notes?: string | null
}

const DEFAULT_HOURLY_FALLBACK = 15

/** 출퇴근 check_in_time → 라스베가스 기준 YYYY-MM-DD */
export function lasVegasDateFromCheckIn(checkInTime: string | null): string | null {
  if (!checkInTime) return null
  const utcDate = new Date(checkInTime)
  const lasVegasTime = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const y = lasVegasTime.getFullYear()
  const m = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
  const d = String(lasVegasTime.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD에 일 수를 더한 달력일 (DB `date` 조회 범위를 넓힐 때 사용) */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 현재 순간의 라스베가스 달력일 YYYY-MM-DD */
export function lasVegasTodayYmd(): string {
  return lasVegasDateFromCheckIn(new Date().toISOString()) || new Date().toISOString().slice(0, 10)
}

/**
 * 근무가 귀속되는 달력일: LV 출근일 우선, 없으면 attendance_records.date
 * (월별 통계·Office Tips 기간 합계와 동일 기준)
 */
export function workCalendarDateYmd(record: { check_in_time: string | null; date: string }): string {
  return lasVegasDateFromCheckIn(record.check_in_time) || record.date.slice(0, 10)
}

/**
 * 해당 직원·일자에 유효한 시급 (구간: effective_from <= date <= effective_to 또는 effective_to IS NULL)
 */
export function getHourlyRateForEmployeeOnDate(
  periods: EmployeeRatePeriod[],
  employeeEmail: string,
  dateStr: string,
  fallback: number = DEFAULT_HOURLY_FALLBACK
): number {
  const email = employeeEmail.trim().toLowerCase()
  const applicable = periods
    .filter((r) => r.employee_email.trim().toLowerCase() === email)
    .filter(
      (r) =>
        r.effective_from <= dateStr &&
        (r.effective_to == null || r.effective_to === '' || r.effective_to >= dateStr)
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  if (applicable.length > 0) return Number(applicable[0].hourly_rate)
  return fallback
}

/** 직원에게 등록된 시급 구간이 하나라도 있으면 true (DB 기준 출퇴근 급여 계산) */
export function employeeHasHourlyPeriods(periods: EmployeeRatePeriod[], employeeEmail: string): boolean {
  const email = employeeEmail.trim().toLowerCase()
  return periods.some((r) => r.employee_email.trim().toLowerCase() === email)
}

export async function fetchEmployeeHourlyRatePeriods(client: SupabaseClient): Promise<EmployeeRatePeriod[]> {
  const { data, error } = await client
    .from('employee_hourly_rate_periods')
    .select('id, employee_email, hourly_rate, effective_from, effective_to, notes')
    .order('effective_from', { ascending: true })

  if (error) {
    console.error('employee_hourly_rate_periods 조회 오류:', error)
    return []
  }
  return (data || []) as EmployeeRatePeriod[]
}

/** 이전 구간의 종료일: 새 effective_from 하루 전 */
export function dayBefore(dateYmd: string): string {
  const d = new Date(dateYmd + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
