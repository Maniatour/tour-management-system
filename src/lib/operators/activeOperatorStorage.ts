import { writeActiveOperatorCookie } from '@/lib/operators/activeOperatorCookie'

const STORAGE_KEY = 'tms_active_operator_id'

export function readStoredActiveOperatorId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value?.trim() || null
  } catch {
    return null
  }
}

export function writeStoredActiveOperatorId(operatorId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, operatorId)
  } catch {
    // ignore quota / private mode
  }
  // Phase 6c.9: mirror to cookie for middleware/API request scope
  writeActiveOperatorCookie(operatorId)
}
