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

export function getUserRole(email: string, teamData?: any): UserRole {
  console.log('getUserRole called with:', { email, teamData })

  // 슈퍼관리자 이메일은 team 데이터와 무관하게 무조건 관리자
  const normalizedEmail = (email || '').toLowerCase()
  if (normalizedEmail && SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
    return 'admin'
  }
  
  // 팀 데이터가 있고 이메일이 팀 테이블에 있는 경우
  if (teamData && teamData.is_active) {
    const position = teamData.position?.toLowerCase() || ''
    
    console.log('Team data found, position:', position)
    
    // position 기반으로 역할 결정
    if (position === 'super') {
      return 'admin'  // Super는 최고 관리자
    }
    if (position === 'office manager') {
      return 'manager'  // Office Manager는 매니저
    }
    if (position === 'tour guide' || position === 'op' || position === 'driver') {
      return 'team_member'  // Tour Guide, OP, Driver는 팀원
    }
    
    // position이 있지만 특정 키워드가 없는 경우 팀원으로 처리
    if (position) {
      return 'team_member'
    }
  }
  
  console.log('No team data or inactive user, returning customer')
  // 기본적으로 일반 고객으로 처리
  return 'customer'
}

export function hasPermission(userRole: UserRole, permission: keyof UserPermissions): boolean {
  return ROLE_PERMISSIONS[userRole][permission]
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
