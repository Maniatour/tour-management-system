import type { UserRole } from '@/lib/roles'
import { isSuperAdminEmail } from '@/lib/superAdmin'

/** 사이트 구조 CRUD 표·DB 오버라이드 공통 페르소나 축 */
export type SiteAccessPersona = 'customer' | 'guide' | 'op' | 'office_manager' | 'super'

/** 표 열 순서: 고객 → Guide → OP → Office Manager → Super */
export const SITE_ACCESS_PERSONAS: readonly SiteAccessPersona[] = [
  'customer',
  'guide',
  'op',
  'office_manager',
  'super',
] as const

export type SiteAccessPersonaContext = {
  userRole: UserRole | null
  userPosition: string | null
  isSuper: boolean
  authUserEmail: string | null | undefined
}

/**
 * 관리자 레이아웃 사용자의 페르소나(매트릭스 열).
 * 고객 전용 경로는 별도 클러스터이므로 여기서는 주로 staff 축만 사용.
 */
export function resolveSiteAccessPersona(ctx: SiteAccessPersonaContext): SiteAccessPersona | null {
  const { userRole, userPosition, isSuper, authUserEmail } = ctx
  if (userRole === 'customer' || !userRole) return 'customer'

  const pos = (userPosition || '').toLowerCase().trim()
  const email = (authUserEmail || '').trim().toLowerCase()

  if (isSuper || pos === 'super' || isSuperAdminEmail(email)) return 'super'
  if (userRole === 'manager' || pos === 'office manager' || pos === '매니저') return 'office_manager'
  if (userRole === 'admin' && pos === 'op') return 'op'
  if (userRole === 'team_member' || pos === 'tour guide' || pos === 'tourguide' || pos === 'guide' || pos === 'driver')
    return 'guide'
  if (userRole === 'admin') return 'op'
  return 'guide'
}

/** DB·RLS와 동일한 편집 가능 여부(클라이언트 힌트) */
export function canEditSiteAccessMatrixClient(ctx: SiteAccessPersonaContext): boolean {
  if (!ctx.authUserEmail) return false
  const pos = (ctx.userPosition || '').toLowerCase().trim()
  if (ctx.isSuper || pos === 'super' || isSuperAdminEmail(ctx.authUserEmail)) return true
  if (pos === 'office manager' || pos === '매니저' || ctx.userRole === 'manager') return true
  return false
}
