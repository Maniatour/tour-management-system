/** 사무실 직원(슈퍼·관리자·매니저)이 메뉴에서 가이드를 직접 연 경우에만 세션 동안 유지 */

export const STAFF_OPEN_GUIDE_SESSION_KEY = 'staff-open-guide-page'

export function isOfficeStaffRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

export function canOpenGuidePage(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'team_member'
}

export function isGuideHomePath(pathname: string): boolean {
  return /^\/[^/]+\/guide\/?$/.test(pathname.split('?')[0] ?? '')
}

export function officeStaffHomePath(locale: string): string {
  return `/${locale}/admin`
}

export function markStaffOpenGuidePage(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STAFF_OPEN_GUIDE_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasStaffOpenGuidePage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(STAFF_OPEN_GUIDE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}
