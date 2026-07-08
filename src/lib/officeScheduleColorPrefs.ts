const STORAGE_KEY = 'office-schedule-staff-colors-v1'

export type StaffColorOverride = {
  bg: string
  border: string
  text: string
}

export type StaffColorOverrides = Record<string, StaffColorOverride>

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function readStaffColorOverrides(): StaffColorOverrides {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StaffColorOverrides
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function writeStaffColorOverrides(overrides: StaffColorOverrides): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    /* quota / private mode */
  }
}

export function setStaffColorOverride(
  email: string,
  bg: string,
  overrides: StaffColorOverrides
): StaffColorOverrides {
  const key = normalizeEmail(email)
  const next = { ...overrides, [key]: { bg, border: darkenHex(bg, 0.22), text: darkenHex(bg, 0.55) } }
  writeStaffColorOverrides(next)
  return next
}

export function clearStaffColorOverride(
  email: string,
  overrides: StaffColorOverrides
): StaffColorOverrides {
  const key = normalizeEmail(email)
  const next = { ...overrides }
  delete next[key]
  writeStaffColorOverrides(next)
  return next
}

function darkenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
