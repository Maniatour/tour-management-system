import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { officeScheduleSlotKey } from '@/lib/officeScheduleMonthDays'
import {
  getHourlyRateForEmployeeOnDate,
  type EmployeeRatePeriod,
} from '@/lib/employeeHourlyRates'

dayjs.extend(isoWeek)

/** hour_slot 0 = 0:00~9:00 (9h), 9~23 = 1h each */
export function hoursPerSlot(hourSlot: number): number {
  return hourSlot === 0 ? 9 : 1
}

export type StaffHoursSummary = {
  email: string
  weekHours: number
  twoWeekHours: number
  monthHours: number
}

function parseSlotKey(key: string): { email: string; date: string; hourSlot: number } | null {
  const parts = key.split('|')
  if (parts.length !== 3) return null
  const hourSlot = Number(parts[2])
  if (!Number.isFinite(hourSlot)) return null
  return { email: parts[0], date: parts[1], hourSlot }
}

export function computeStaffHoursSummaries(
  slotKeys: Iterable<string>,
  emails: string[],
  monthYmd: string
): StaffHoursSummary[] {
  const today = dayjs()
  const weekStart = today.startOf('isoWeek').format('YYYY-MM-DD')
  const weekEnd = today.endOf('isoWeek').format('YYYY-MM-DD')
  const twoWeekStart = today.subtract(13, 'day').format('YYYY-MM-DD')
  const twoWeekEnd = today.format('YYYY-MM-DD')
  const monthStart = dayjs(`${monthYmd}-01`).startOf('month').format('YYYY-MM-DD')
  const monthEnd = dayjs(`${monthYmd}-01`).endOf('month').format('YYYY-MM-DD')

  const weekByEmail = new Map<string, number>()
  const twoWeekByEmail = new Map<string, number>()
  const monthByEmail = new Map<string, number>()

  for (const email of emails) {
    const norm = email.trim().toLowerCase()
    weekByEmail.set(norm, 0)
    twoWeekByEmail.set(norm, 0)
    monthByEmail.set(norm, 0)
  }

  for (const key of slotKeys) {
    const parsed = parseSlotKey(key)
    if (!parsed) continue
    const norm = parsed.email.trim().toLowerCase()
    if (!weekByEmail.has(norm)) continue
    const h = hoursPerSlot(parsed.hourSlot)
    const { date } = parsed
    if (date >= weekStart && date <= weekEnd) {
      weekByEmail.set(norm, (weekByEmail.get(norm) ?? 0) + h)
    }
    if (date >= twoWeekStart && date <= twoWeekEnd) {
      twoWeekByEmail.set(norm, (twoWeekByEmail.get(norm) ?? 0) + h)
    }
    if (date >= monthStart && date <= monthEnd) {
      monthByEmail.set(norm, (monthByEmail.get(norm) ?? 0) + h)
    }
  }

  return emails.map((email) => {
    const norm = email.trim().toLowerCase()
    return {
      email,
      weekHours: weekByEmail.get(norm) ?? 0,
      twoWeekHours: twoWeekByEmail.get(norm) ?? 0,
      monthHours: monthByEmail.get(norm) ?? 0,
    }
  })
}

export function sumStaffHoursSummaries(rows: StaffHoursSummary[]): StaffHoursSummary {
  return rows.reduce(
    (acc, row) => ({
      email: '',
      weekHours: acc.weekHours + row.weekHours,
      twoWeekHours: acc.twoWeekHours + row.twoWeekHours,
      monthHours: acc.monthHours + row.monthHours,
    }),
    { email: '', weekHours: 0, twoWeekHours: 0, monthHours: 0 }
  )
}

export type StaffPaySummary = {
  email: string
  weekPay: number
  twoWeekPay: number
  monthPay: number
}

export function computeStaffPaySummaries(
  slotKeys: Iterable<string>,
  emails: string[],
  monthYmd: string,
  ratePeriods: EmployeeRatePeriod[],
  hiddenEmails?: ReadonlySet<string>
): StaffPaySummary[] {
  const today = dayjs()
  const weekStart = today.startOf('isoWeek').format('YYYY-MM-DD')
  const weekEnd = today.endOf('isoWeek').format('YYYY-MM-DD')
  const twoWeekStart = today.subtract(13, 'day').format('YYYY-MM-DD')
  const twoWeekEnd = today.format('YYYY-MM-DD')
  const monthStart = dayjs(`${monthYmd}-01`).startOf('month').format('YYYY-MM-DD')
  const monthEnd = dayjs(`${monthYmd}-01`).endOf('month').format('YYYY-MM-DD')

  const hide =
    hiddenEmails && hiddenEmails.size > 0
      ? new Set([...hiddenEmails].map((e) => e.trim().toLowerCase()))
      : null

  const weekByEmail = new Map<string, number>()
  const twoWeekByEmail = new Map<string, number>()
  const monthByEmail = new Map<string, number>()

  for (const email of emails) {
    const norm = email.trim().toLowerCase()
    if (hide?.has(norm)) continue
    weekByEmail.set(norm, 0)
    twoWeekByEmail.set(norm, 0)
    monthByEmail.set(norm, 0)
  }

  for (const key of slotKeys) {
    const parsed = parseSlotKey(key)
    if (!parsed) continue
    const norm = parsed.email.trim().toLowerCase()
    if (!weekByEmail.has(norm)) continue

    const pay = hoursPerSlot(parsed.hourSlot) * getHourlyRateForEmployeeOnDate(
      ratePeriods,
      parsed.email,
      parsed.date
    )
    const { date } = parsed
    if (date >= weekStart && date <= weekEnd) {
      weekByEmail.set(norm, (weekByEmail.get(norm) ?? 0) + pay)
    }
    if (date >= twoWeekStart && date <= twoWeekEnd) {
      twoWeekByEmail.set(norm, (twoWeekByEmail.get(norm) ?? 0) + pay)
    }
    if (date >= monthStart && date <= monthEnd) {
      monthByEmail.set(norm, (monthByEmail.get(norm) ?? 0) + pay)
    }
  }

  return emails
    .filter((email) => !hide?.has(email.trim().toLowerCase()))
    .map((email) => {
      const norm = email.trim().toLowerCase()
      return {
        email,
        weekPay: weekByEmail.get(norm) ?? 0,
        twoWeekPay: twoWeekByEmail.get(norm) ?? 0,
        monthPay: monthByEmail.get(norm) ?? 0,
      }
    })
}

export function sumStaffPaySummaries(rows: StaffPaySummary[]): StaffPaySummary {
  return rows.reduce(
    (acc, row) => ({
      email: '',
      weekPay: acc.weekPay + row.weekPay,
      twoWeekPay: acc.twoWeekPay + row.twoWeekPay,
      monthPay: acc.monthPay + row.monthPay,
    }),
    { email: '', weekPay: 0, twoWeekPay: 0, monthPay: 0 }
  )
}

/** date → sum of scheduled hours that day (optional hidden-staff filter) */
export function computeDailyHoursTotals(
  slotKeys: Iterable<string>,
  teamEmails: string[],
  dates: string[],
  hiddenEmails?: ReadonlySet<string>
): Map<string, number> {
  const allowed = new Set(teamEmails.map((e) => e.trim().toLowerCase()))
  const hide =
    hiddenEmails && hiddenEmails.size > 0
      ? new Set([...hiddenEmails].map((e) => e.trim().toLowerCase()))
      : null
  const totals = new Map<string, number>()
  for (const d of dates) totals.set(d, 0)

  for (const key of slotKeys) {
    const parsed = parseSlotKey(key)
    if (!parsed) continue
    const norm = parsed.email.trim().toLowerCase()
    if (!allowed.has(norm)) continue
    if (hide?.has(norm)) continue
    if (!totals.has(parsed.date)) continue
    totals.set(parsed.date, (totals.get(parsed.date) ?? 0) + hoursPerSlot(parsed.hourSlot))
  }

  return totals
}

/** date → sum of (scheduled hours × hourly rate) for visible staff */
export function computeDailyPayTotals(
  slotKeys: Iterable<string>,
  teamEmails: string[],
  dates: string[],
  ratePeriods: EmployeeRatePeriod[],
  hiddenEmails?: ReadonlySet<string>
): Map<string, number> {
  const allowed = new Set(teamEmails.map((e) => e.trim().toLowerCase()))
  const hide =
    hiddenEmails && hiddenEmails.size > 0
      ? new Set([...hiddenEmails].map((e) => e.trim().toLowerCase()))
      : null
  const totals = new Map<string, number>()
  for (const d of dates) totals.set(d, 0)

  for (const key of slotKeys) {
    const parsed = parseSlotKey(key)
    if (!parsed) continue
    const norm = parsed.email.trim().toLowerCase()
    if (!allowed.has(norm)) continue
    if (hide?.has(norm)) continue
    if (!totals.has(parsed.date)) continue

    const hours = hoursPerSlot(parsed.hourSlot)
    const rate = getHourlyRateForEmployeeOnDate(ratePeriods, parsed.email, parsed.date)
    totals.set(parsed.date, (totals.get(parsed.date) ?? 0) + hours * rate)
  }

  return totals
}

export function formatDailyPayAmount(amount: number): string {
  if (amount <= 0) return '—'
  const rounded = Math.round(amount * 100) / 100
  return rounded % 1 === 0 ? `$${rounded}` : `$${rounded.toFixed(2)}`
}

export function slotMapToKeySet(map: Map<string, unknown>): Set<string> {
  return new Set(map.keys())
}

export function slotMapsEqual(
  a: Map<string, { note: string | null }>,
  b: Map<string, { note: string | null }>
): boolean {
  if (a.size !== b.size) return false
  for (const key of a.keys()) {
    if (!b.has(key)) return false
  }
  return true
}

export function getScheduleLoadRange(monthDays: { dateString: string }[]): {
  from: string
  to: string
} {
  const today = dayjs()
  const candidatesFrom = [
    monthDays[0]?.dateString,
    today.startOf('isoWeek').format('YYYY-MM-DD'),
    today.subtract(13, 'day').format('YYYY-MM-DD'),
  ].filter(Boolean) as string[]
  const candidatesTo = [
    monthDays[monthDays.length - 1]?.dateString,
    today.endOf('isoWeek').format('YYYY-MM-DD'),
    today.format('YYYY-MM-DD'),
  ].filter(Boolean) as string[]
  return {
    from: candidatesFrom.reduce((a, b) => (a < b ? a : b)),
    to: candidatesTo.reduce((a, b) => (a > b ? a : b)),
  }
}

export function parseSlotKeyForSave(key: string): {
  employee_email: string
  schedule_date: string
  hour_slot: number
} | null {
  const parsed = parseSlotKey(key)
  if (!parsed) return null
  return {
    employee_email: parsed.email,
    schedule_date: parsed.date,
    hour_slot: parsed.hourSlot,
  }
}

export { officeScheduleSlotKey }
