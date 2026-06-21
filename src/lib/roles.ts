// 사용자 역할 및 권한 관리

export type UserRole = 'customer' | 'team_member' | 'admin' | 'manager'

// 슈퍼관리자 화이트리스트 (항상 관리자 권한 부여)
const SUPER_ADMIN_EMAILS: string[] = [
  'info@maniatour.com',
  'wooyong.shim09@gmail.com',
]

export interface UserPermissions {
  canViewAdmin: boolean
  canManageProducts: boolean
  canManageCustomers: boolean
  canManageReservations: boolean
  canManageTours: boolean
  canManageTeam: boolean
  canViewSchedule: boolean
  canManageBookings: boolean
  canViewAuditLogs: boolean
  canManageChannels: boolean
  canManageOptions: boolean
  canViewFinance: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  customer: {
    canViewAdmin: false,
    canManageProducts: false,
    canManageCustomers: false,
    canManageReservations: false,
    canManageTours: false,
    canManageTeam: false,
    canViewSchedule: false,
    canManageBookings: false,
    canViewAuditLogs: false,
    canManageChannels: false,
    canManageOptions: false,
    canViewFinance: false,
  },
  team_member: {
    canViewAdmin: true,
    canManageProducts: false,
    canManageCustomers: true,
    canManageReservations: true,
    canManageTours: true,
    canManageTeam: false,
    canViewSchedule: true,
    canManageBookings: true,
    canViewAuditLogs: false,
    canManageChannels: false,
    canManageOptions: false,
    canViewFinance: false,
  },
  manager: {
    canViewAdmin: true,
    canManageProducts: true,
    canManageCustomers: true,
    canManageReservations: true,
    canManageTours: true,
    canManageTeam: true,
    canViewSchedule: true,
    canManageBookings: true,
    canViewAuditLogs: true,
    canManageChannels: true,
    canManageOptions: true,
    canViewFinance: true,
  },
  admin: {
    canViewAdmin: true,
    canManageProducts: true,
    canManageCustomers: true,
    canManageReservations: true,
    canManageTours: true,
    canManageTeam: true,
    canViewSchedule: true,
    canManageBookings: true,
    canViewAuditLogs: true,
    canManageChannels: true,
    canManageOptions: true,
    canViewFinance: true,
  },
}

/** DB·RLS helpers 와 동일한 사무/예약 직책 문자열 */
const OFFICE_STAFF_POSITIONS = new Set([
  'office',
  'office staff',
  'office_staff',
  '사무',
  '사무실',
  '예약',
  '예약실',
  'reservation',
  'cs',
  'counter',
  'desk',
  'reception',
  'admin',
])

export function getUserRole(
  email: string,
  teamData?: { position?: string; is_active?: boolean | null }
): UserRole {
  // 슈퍼관리자 이메일은 team 데이터와 무관하게 무조건 관리자
  const normalizedEmail = (email || '').toLowerCase()

  if (normalizedEmail && SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
    return 'admin'
  }

  // 팀 데이터가 있고 비활성(is_active === false)이 아닌 경우
  // DB RLS·is_staff()는 coalesce(is_active, true)와 동일하게 null 을 활성으로 본다.
  if (teamData && teamData.is_active !== false) {
    const position = teamData.position?.toLowerCase().trim() || ''

    // position 기반으로 역할 결정 (대소문자 구별 없음)
    if (position === 'super') {
      return 'admin'
    }
    if (position === 'office manager' || position === 'office_manager' || position === 'manager' || position === '매니저') {
      return 'manager'
    }
    if (position === 'op') {
      return 'admin'
    }
    if (position === 'tour guide' || position === 'tourguide' || position === 'guide' || position === 'driver') {
      return 'team_member'
    }
    if (OFFICE_STAFF_POSITIONS.has(position)) {
      return 'admin'
    }

    // position이 있지만 특정 키워드가 없는 경우 관리자 권한으로 처리
    if (position) {
      return 'admin'
    }
  }

  // 기본적으로 일반 고객으로 처리
  return 'customer'
}

export function hasPermission(userRole: UserRole, permission: keyof UserPermissions): boolean {
  return ROLE_PERMISSIONS[userRole][permission]
}

/**
 * 출석관리 — 직원별 시급 이력(민감): Office Manager, Super, Admin(OP 제외)만 UI 표시.
 * - team.position `office manager` / `super`
 * - `getUserRole`상 Office Manager → `manager`
 * - `admin` 역할은 OP만 제외 (OP는 admin 권한이나 시급 이력은 비표시)
 */
/** team.position — DB에는 `office manager`·`매니저` 등으로 저장되는 경우가 있음 */
export function isManagerTeamPosition(rawPosition: string | null | undefined): boolean {
  const p = String(rawPosition ?? '').toLowerCase().trim()
  return (
    p === 'manager' ||
    p === 'office manager' ||
    p === 'office_manager' ||
    p === '매니저'
  )
}

export function canViewEmployeeHourlyRatesHistory(
  userRole: UserRole | null,
  userPosition: string | null
): boolean {
  const pos = (userPosition || '').toLowerCase().trim()
  if (pos === 'office manager' || pos === 'office_manager' || pos === '매니저') return true
  if (pos === 'super') return true
  if (userRole === 'manager') return true
  if (userRole === 'admin' && pos !== 'op') return true
  return false
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames = {
    customer: '고객',
    team_member: '팀원',
    manager: '매니저',
    admin: '관리자',
  }
  return roleNames[role]
}
