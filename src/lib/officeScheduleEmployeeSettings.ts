import dayjs from 'dayjs'
import type { SupabaseClient } from '@supabase/supabase-js'

export type OfficePayType = 'hourly' | 'monthly'
export type OfficeEmploymentType = 'full_time' | 'part_time'

export type OfficeScheduleEmployeeSettings = {
  employee_email: string
  pay_type: OfficePayType
  employment_type: OfficeEmploymentType
  rest_days: number[]
}

export const FULL_TIME_DAILY_HOURS = 8

/** JS Date.getDay(): 0=Sun … 6=Sat */
export const REST_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DEFAULT_OFFICE_EMPLOYEE_SETTINGS: Omit<
  OfficeScheduleEmployeeSettings,
  'employee_email'
> = {
  pay_type: 'hourly',
  employment_type: 'part_time',
  rest_days: [],
}

export function normalizeRestDays(days: number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b
  )
}

export function restDaysLabel(days: number[]): string {
  const norm = normalizeRestDays(days)
  if (norm.length === 0) return '—'
  return norm.map((d) => REST_DAY_LABELS[d]).join(', ')
}

export function computeFullTimeMonthlyMinimum(
  monthYmd: string,
  restDays: number[],
  hoursPerDay = FULL_TIME_DAILY_HOURS
): { minDays: number; minHours: number } {
  const monthStart = dayjs(`${monthYmd}-01`)
  const daysInMonth = monthStart.daysInMonth()
  const rest = new Set(normalizeRestDays(restDays))
  let minDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = monthStart.date(d)
    if (!rest.has(date.day())) minDays++
  }
  return { minDays, minHours: minDays * hoursPerDay }
}

export async function fetchOfficeScheduleEmployeeSettings(
  client: SupabaseClient,
  emails: string[]
): Promise<Map<string, OfficeScheduleEmployeeSettings>> {
  const map = new Map<string, OfficeScheduleEmployeeSettings>()
  if (emails.length === 0) return map

  const { data, error } = await client
    .from('office_schedule_employee_settings')
    .select('employee_email, pay_type, employment_type, rest_days')
    .in('employee_email', emails)

  if (error) {
    console.error('office_schedule_employee_settings fetch error:', error)
    return map
  }

  for (const row of data ?? []) {
    const email = String(row.employee_email ?? '').trim()
    if (!email) continue
    map.set(email.toLowerCase(), {
      employee_email: email,
      pay_type: row.pay_type === 'monthly' ? 'monthly' : 'hourly',
      employment_type: row.employment_type === 'full_time' ? 'full_time' : 'part_time',
      rest_days: normalizeRestDays((row.rest_days ?? []) as number[]),
    })
  }
  return map
}

export function getEmployeeSettings(
  map: Map<string, OfficeScheduleEmployeeSettings>,
  email: string
): OfficeScheduleEmployeeSettings {
  const found = map.get(email.trim().toLowerCase())
  if (found) return found
  return {
    employee_email: email,
    ...DEFAULT_OFFICE_EMPLOYEE_SETTINGS,
  }
}

export async function saveOfficeScheduleEmployeeSettings(
  client: SupabaseClient,
  settings: OfficeScheduleEmployeeSettings
): Promise<void> {
  const restDays =
    settings.employment_type === 'full_time'
      ? normalizeRestDays(settings.rest_days)
      : []

  const { error } = await client.rpc('upsert_office_schedule_employee_settings', {
    p_employee_email: settings.employee_email,
    p_pay_type: settings.pay_type,
    p_employment_type: settings.employment_type,
    p_rest_days: restDays,
  })
  if (error) throw error
}

export function formatMonthlyMinimum(minDays: number, minHours: number): string {
  return `Min ${minDays}d · ${minHours}h`
}
