import {
  BATCH_SHIFT_FIRST_HALF_START_HOUR,
  BATCH_SHIFT_SECOND_HALF_START_HOUR,
  type OfficeBatchShift,
} from '@/lib/officeScheduleBatchShift'
import { officeScheduleOffDayKey } from '@/lib/officeScheduleOffDays'

export const OFFICE_SCHEDULE_STAFF_ORDER = ['judy', 'hana', 'somi', 'mike'] as const

export type OfficeScheduleStaffMember = {
  email: string
  display_name?: string | null
  name_en?: string | null
  nick_name?: string | null
  name_ko?: string | null
}

export type OfficeScheduleSlotRow = {
  employee_email: string
  schedule_date: string
  hour_slot: number
}

export type OfficeScheduleOffDayRow = {
  employee_email: string
  schedule_date: string
}

export type OfficeScheduleDayStaffChip = {
  emoji: '🌞' | '🌙'
  label: string
}

const SHIFT_EMOJI: Record<OfficeBatchShift, '🌞' | '🌙'> = {
  first_half: '🌞',
  second_half: '🌙',
}

function normalizeDateYmd(value: string): string {
  return value.slice(0, 10)
}

function staffSortLabel(member: OfficeScheduleStaffMember): string {
  return (
    member.display_name ||
    member.name_en ||
    member.nick_name ||
    member.name_ko ||
    member.email.split('@')[0] ||
    ''
  )
    .trim()
    .toLowerCase()
}

export function officeStaffOrderIndex(member: OfficeScheduleStaffMember): number {
  const label = staffSortLabel(member)
  const first = label.split(/\s+/)[0] ?? label
  const email = member.email.trim().toLowerCase()
  const idx = OFFICE_SCHEDULE_STAFF_ORDER.findIndex(
    (key) => first === key || label.startsWith(`${key} `) || email.includes(key)
  )
  return idx >= 0 ? idx : OFFICE_SCHEDULE_STAFF_ORDER.length
}

export function filterAndSortOfficeScheduleStaff<T extends OfficeScheduleStaffMember>(
  rows: T[]
): T[] {
  return rows
    .filter((member) => !member.email.trim().toLowerCase().includes('vegasmaniatour'))
    .sort((a, b) => {
      const orderDiff = officeStaffOrderIndex(a) - officeStaffOrderIndex(b)
      if (orderDiff !== 0) return orderDiff
      return staffSortLabel(a).localeCompare(staffSortLabel(b))
    })
}

export function officeStaffDisplayLabel(member: OfficeScheduleStaffMember): string {
  const raw =
    member.display_name ||
    member.name_en ||
    member.nick_name ||
    member.name_ko ||
    member.email.split('@')[0] ||
    ''
  const first = raw.trim().split(/\s+/)[0] ?? raw.trim()
  return first.toUpperCase()
}

export function inferOfficeShiftFromHourSlots(hourSlots: Iterable<number>): OfficeBatchShift | null {
  const workHours = [...hourSlots].filter((hour) => hour >= 9 && hour <= 23)
  if (workHours.length === 0) return null

  if (workHours.includes(BATCH_SHIFT_FIRST_HALF_START_HOUR)) return 'first_half'
  if (workHours.includes(BATCH_SHIFT_SECOND_HALF_START_HOUR)) return 'second_half'

  const earliest = Math.min(...workHours)
  if (earliest < BATCH_SHIFT_SECOND_HALF_START_HOUR) return 'first_half'
  return 'second_half'
}

export function buildOfficeScheduleStaffByDate(
  staff: OfficeScheduleStaffMember[],
  slotRows: OfficeScheduleSlotRow[],
  offDayRows: OfficeScheduleOffDayRow[]
): Record<string, OfficeScheduleDayStaffChip[]> {
  const sortedStaff = filterAndSortOfficeScheduleStaff(staff)
  const staffEmails = new Set(sortedStaff.map((member) => member.email.trim().toLowerCase()))
  const staffByEmail = new Map(
    sortedStaff.map((member) => [member.email.trim().toLowerCase(), member] as const)
  )

  const offDaySet = new Set(
    offDayRows.map((row) =>
      officeScheduleOffDayKey(row.employee_email, normalizeDateYmd(row.schedule_date))
    )
  )

  const hoursByEmailDate = new Map<string, Set<number>>()
  for (const row of slotRows) {
    const email = row.employee_email.trim().toLowerCase()
    if (!staffEmails.has(email)) continue
    const date = normalizeDateYmd(row.schedule_date)
    const key = `${email}|${date}`
    const hours = hoursByEmailDate.get(key) ?? new Set<number>()
    hours.add(row.hour_slot)
    hoursByEmailDate.set(key, hours)
  }

  const result: Record<string, OfficeScheduleDayStaffChip[]> = {}

  for (const [key, hours] of hoursByEmailDate) {
    const [email, date] = key.split('|')
    if (!email || !date) continue
    if (offDaySet.has(officeScheduleOffDayKey(email, date))) continue

    const shift = inferOfficeShiftFromHourSlots(hours)
    if (!shift) continue

    const member = staffByEmail.get(email)
    if (!member) continue

    const chip: OfficeScheduleDayStaffChip = {
      emoji: SHIFT_EMOJI[shift],
      label: officeStaffDisplayLabel(member),
    }

    if (!result[date]) result[date] = []
    result[date].push(chip)
  }

  for (const date of Object.keys(result)) {
    result[date]!.sort((a, b) => {
      const memberA = sortedStaff.find((member) => officeStaffDisplayLabel(member) === a.label)
      const memberB = sortedStaff.find((member) => officeStaffDisplayLabel(member) === b.label)
      return officeStaffOrderIndex(memberA || { email: a.label }) -
        officeStaffOrderIndex(memberB || { email: b.label })
    })
  }

  return result
}

export function formatOfficeScheduleDayStaff(chips: OfficeScheduleDayStaffChip[]): string {
  return chips.map((chip) => `${chip.emoji}${chip.label}`).join(' , ')
}
