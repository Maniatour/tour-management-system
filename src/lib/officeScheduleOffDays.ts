export type OffDayMap = Map<string, { note: string | null }>

export type OfficeScheduleOffDayPayload = {
  employee_email: string
  schedule_date: string
  note?: string | null
}

export function officeScheduleOffDayKey(email: string, date: string): string {
  return `${email.trim().toLowerCase()}|${date}`
}

export function parseOffDayKey(
  key: string
): { employee_email: string; schedule_date: string } | null {
  const parts = key.split('|')
  if (parts.length !== 2) return null
  const [employee_email, schedule_date] = parts
  if (!employee_email || !schedule_date) return null
  return { employee_email, schedule_date }
}

export function cloneOffDayMap(map: OffDayMap): OffDayMap {
  return new Map(map)
}

export function offDayMapsEqual(a: OffDayMap, b: OffDayMap): boolean {
  if (a.size !== b.size) return false
  for (const key of a.keys()) {
    if (!b.has(key)) return false
  }
  return true
}

export function buildOffDaysByDate(offDayMap: OffDayMap): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const key of offDayMap.keys()) {
    const parsed = parseOffDayKey(key)
    if (!parsed) continue
    const list = map.get(parsed.schedule_date) ?? []
    list.push(parsed.employee_email)
    map.set(parsed.schedule_date, list)
  }
  return map
}

export function offDatesForEmployee(offDayMap: OffDayMap, email: string): Set<string> {
  const norm = email.trim().toLowerCase()
  const dates = new Set<string>()
  for (const key of offDayMap.keys()) {
    const parsed = parseOffDayKey(key)
    if (parsed && parsed.employee_email === norm) {
      dates.add(parsed.schedule_date)
    }
  }
  return dates
}

export function removeSlotsForEmployeeOnDate(
  slotMap: Map<string, { note: string | null }>,
  email: string,
  date: string
): boolean {
  const norm = email.trim().toLowerCase()
  let changed = false
  for (const key of [...slotMap.keys()]) {
    const [em, d] = key.split('|')
    if (em === norm && d === date) {
      slotMap.delete(key)
      changed = true
    }
  }
  return changed
}

export function offDaysJsonToMap(
  rows: Array<{ employee_email: string; schedule_date: string; note: string | null }>
): OffDayMap {
  const map: OffDayMap = new Map()
  for (const row of rows) {
    const date =
      typeof row.schedule_date === 'string'
        ? row.schedule_date.slice(0, 10)
        : String(row.schedule_date)
    const key = officeScheduleOffDayKey(row.employee_email, date)
    map.set(key, { note: row.note ?? null })
  }
  return map
}

function mayEditOffDay(
  employeeEmail: string,
  canEditAll: boolean,
  currentUserEmail: string
): boolean {
  if (canEditAll) return true
  return employeeEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
}

export function buildOfficeScheduleOffDaySavePayload(
  savedOffDayMap: OffDayMap,
  draftOffDayMap: OffDayMap,
  canEditAll: boolean,
  currentUserEmail: string
): { deletes: OfficeScheduleOffDayPayload[]; upserts: OfficeScheduleOffDayPayload[] } {
  const deletes: OfficeScheduleOffDayPayload[] = []
  const upserts: OfficeScheduleOffDayPayload[] = []

  for (const key of savedOffDayMap.keys()) {
    if (draftOffDayMap.has(key)) continue
    const parsed = parseOffDayKey(key)
    if (!parsed) continue
    if (!mayEditOffDay(parsed.employee_email, canEditAll, currentUserEmail)) continue
    deletes.push({
      employee_email: parsed.employee_email,
      schedule_date: parsed.schedule_date,
    })
  }

  for (const [key, val] of draftOffDayMap) {
    if (savedOffDayMap.has(key)) continue
    const parsed = parseOffDayKey(key)
    if (!parsed) continue
    if (!mayEditOffDay(parsed.employee_email, canEditAll, currentUserEmail)) continue
    upserts.push({
      employee_email: parsed.employee_email,
      schedule_date: parsed.schedule_date,
      note: val.note,
    })
  }

  return { deletes, upserts }
}
