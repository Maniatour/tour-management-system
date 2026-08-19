import { persistSupabaseSessionToStorage } from '@/lib/authStorage'
import { syncAuthSessionCookieFromStorage } from '@/lib/authSessionCookie'
import { readTeamClaimsFromAccessToken } from '@/lib/authJwtRoleClaims'
import {
  canAttemptProactiveRefresh,
  coordinatedRefreshSession,
  getStoredAccessTokenIfValid,
  isAuthRefreshRateLimited,
  markProactiveRefreshAttempted,
  supabase,
  updateSupabaseToken,
} from '@/lib/supabase'

const UPGRADE_SESSION_BUDGET_MS = 8_000

/** Auth Hook 활성화 후 구 토큰(team_role 없음) 여부 */
export function accessTokenNeedsTeamRoleUpgrade(token?: string | null): boolean {
  const access = token ?? getStoredAccessTokenIfValid(0)
  if (!access) return false
  return readTeamClaimsFromAccessToken(access) == null
}

/**
 * refresh_token으로 세션을 다시 발급받아 JWT에 team_role 클레임을 채운다.
 * 훅 설정 직후 재로그인 없이 한 번에 반영하기 위함.
 */
export async function upgradeSessionForTeamRoleClaims(): Promise<boolean> {
  if (typeof window === 'undefined' || !supabase) return false
  if (isAuthRefreshRateLimited()) return false
  if (!accessTokenNeedsTeamRoleUpgrade()) return false

  const refreshToken = localStorage.getItem('sb-refresh-token')?.trim()
  if (!refreshToken || !canAttemptProactiveRefresh()) return false

  markProactiveRefreshAttempted()

  try {
    const upgraded = await Promise.race([
      coordinatedRefreshSession(supabase, { refresh_token: refreshToken }).then(
        ({ session, error }) => (error || !session?.access_token ? null : session)
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), UPGRADE_SESSION_BUDGET_MS)),
    ])

    if (!upgraded?.access_token) return false

    persistSupabaseSessionToStorage(upgraded)
    updateSupabaseToken(upgraded.access_token, {
      refreshToken: upgraded.refresh_token,
    })
    syncAuthSessionCookieFromStorage()

    const hasClaims = readTeamClaimsFromAccessToken(upgraded.access_token) != null
    if (process.env.NODE_ENV === 'development' && hasClaims) {
      console.log('AuthContext: JWT upgraded with team_role claims after hook')
    }
    return hasClaims
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('AuthContext: upgradeSessionForTeamRoleClaims failed:', error)
    }
    return false
  }
}
