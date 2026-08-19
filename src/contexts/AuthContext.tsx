'use client'

import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import {
  canAttemptProactiveRefresh,
  canUseAuthenticatedRest,
  clearStoredAuthTokens,
  coordinatedRefreshSession,
  getAuthRefreshCooldownRemainingMs,
  getAccessTokenForApi,
  getStoredAccessTokenIfValid,
  isAuthInvalidRefreshError,
  isAuthRateLimitError,
  isAuthRefreshDiscardedError,
  isAuthRefreshRateLimited,
  markProactiveRefreshAttempted,
  resetSupabaseTokenSyncCache,
  supabase,
  syncCustomTokensFromGoTrueStorage,
  updateSupabaseToken,
} from '@/lib/supabase'
import { persistSupabaseSessionToStorage } from '@/lib/authStorage'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission, ROLE_PERMISSIONS } from '@/lib/roles'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'
import { fetchAuthTeamMemberRow } from '@/lib/authTeamRoleLookup'
import { syncAuthSessionCookieFromStorage } from '@/lib/authSessionCookie'
import { isStaffTeamRole, readTeamClaimsFromAccessToken } from '@/lib/authJwtRoleClaims'
import { upgradeSessionForTeamRoleClaims, accessTokenNeedsTeamRoleUpgrade } from '@/lib/authJwtTeamRoleUpgrade'
import {
  clearSimulationActiveStorage,
  clearSimulationBrowserStorage,
  getPublicSupabaseUrl,
  isSimulationRecentlyEnded,
  markSimulationEnded,
  readSimulationBackendMeta,
  stripSimulationBackendMeta,
  syncSimulationStorageWithCurrentBackend,
  withSimulationBackendMeta,
} from '@/lib/simulationBackend'

function authUserFromSupabaseSessionUser(sessionUser: User): AuthUser {
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name:
      sessionUser.user_metadata?.name ||
      sessionUser.user_metadata?.full_name ||
      (sessionUser.email ? sessionUser.email.split('@')[0] : 'User'),
    ...(sessionUser.user_metadata?.avatar_url
      ? { avatar_url: sessionUser.user_metadata.avatar_url }
      : {}),
    created_at: sessionUser.created_at,
    ...(sessionUser.user_metadata != null ? { user_metadata: sessionUser.user_metadata } : {}),
  }
}

/** GoTrue SIGNED_OUT·429 후에도 저장된 access JWT로 UI 복구용 */
function authUserFromStoredAccessToken(minTtlSec = 60): AuthUser | null {
  const accessToken = getStoredAccessTokenIfValid(minTtlSec)
  if (!accessToken) return null
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1])) as {
      sub?: string
      email?: string
      user_metadata?: Record<string, unknown>
      iat?: number
    }
    const email = typeof payload.email === 'string' ? payload.email.trim() : ''
    if (!email) return null
    const meta = payload.user_metadata ?? {}
    const authUser: AuthUser = {
      id: payload.sub || email,
      email,
      name:
        (typeof meta.name === 'string' && meta.name) ||
        (typeof meta.full_name === 'string' && meta.full_name) ||
        email.split('@')[0] ||
        'User',
      created_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
      ...(Object.keys(meta).length > 0
        ? { user_metadata: meta as NonNullable<AuthUser['user_metadata']> }
        : {}),
    }
    if (typeof meta.avatar_url === 'string' && meta.avatar_url) {
      authUser.avatar_url = meta.avatar_url
    }
    return authUser
  } catch {
    return null
  }
}

/** 모바일에서 GoTrue getSession이 무한 대기하는 경우 방지 */
const AUTH_SESSION_BUDGET_MS = 8_000
const AUTH_SESSION_RETRY_MS = 6_000
const AUTH_BOOTSTRAP_FAILSAFE_MS = 30_000
const ROLE_CHECK_DEDUPE_WAIT_MS = 12_000
const INITIAL_AUTH_DELAY_MS = 300

type CheckUserRoleOptions = {
  /** 캐시 복원 후 UI를 막지 않고 역할만 재검증 */
  background?: boolean
  /** JWT fast-path 건너뛰고 team RPC로 강제 재검증 */
  forceRpc?: boolean
}

function permissionsForRole(role: UserRole): UserPermissions {
  return ROLE_PERMISSIONS[role]
}

function readJwtTeamClaimsForEmail(normalizedEmail: string) {
  const token = getStoredAccessTokenIfValid(0)
  if (!token) return null
  const claims = readTeamClaimsFromAccessToken(token)
  if (!claims || claims.email !== normalizedEmail) return null
  return claims
}

async function getSupabaseSessionBounded(budgetMs: number): Promise<Session | null> {
  if (!supabase) return null
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data, error }) => (error ? null : data.session)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
    ])
  } catch {
    return null
  }
}

async function refreshSupabaseSessionBounded(
  refreshToken: string,
  budgetMs: number
): Promise<Session | null> {
  if (!supabase || isAuthRefreshRateLimited()) return null
  try {
    return await Promise.race([
      coordinatedRefreshSession(supabase, { refresh_token: refreshToken }).then(
        ({ session, error }) => (error || !session ? null : session)
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
    ])
  } catch {
    return null
  }
}

interface AuthContextType {
  user: AuthUser | null
  authUser: AuthUser | null
  userRole: UserRole | null
  userPosition: string | null
  permissions: UserPermissions | null
  loading: boolean
  isInitialized: boolean
  /** 가이드 등 SPA 이동 후 세션·컨텍스트 불일치 시 복구 (모바일) */
  recoverAuthSession: () => Promise<void>
  signOut: () => Promise<void>
  hasPermission: (permission: keyof UserPermissions) => boolean
  teamChatUnreadCount: number
  refreshTeamChatUnreadCount: () => Promise<void>
  // 시뮬레이션 관련
  simulatedUser: SimulatedUser | null
  startSimulation: (user: SimulatedUser) => void
  stopSimulation: () => void
  isSimulating: boolean
}

interface SimulatedUser {
  id: string
  email: string
  name_ko: string
  name_en?: string
  phone: string | null
  language: string | null
  created_at: string
  position: string
  role: UserRole
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_SNAPSHOT_KEY = 'tms-auth-snapshot-v1'
const AUTH_ROLE_CACHE_KEY = 'tms-auth-role-cache-v1'
const AUTH_ROLE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function hasPersistedAuthSession(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    getStoredAccessTokenIfValid(0) ||
    localStorage.getItem('sb-refresh-token')?.trim()
  )
}

type AuthSnapshot = {
  user: AuthUser | null
  authUser: AuthUser | null
  userRole: UserRole | null
  userPosition: string | null
  permissions: UserPermissions | null
  isInitialized: boolean
  isSimulating: boolean
  simulatedUser: SimulatedUser | null
}

function clearAuthSnapshot() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(AUTH_SNAPSHOT_KEY)
    localStorage.removeItem(AUTH_ROLE_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

function stripSimulationFromAuthSnapshot() {
  if (typeof window === 'undefined') return
  try {
    const raw = sessionStorage.getItem(AUTH_SNAPSHOT_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as AuthSnapshot
    if (!parsed.isSimulating && !parsed.simulatedUser) return
    sessionStorage.removeItem(AUTH_SNAPSHOT_KEY)
  } catch {
    sessionStorage.removeItem(AUTH_SNAPSHOT_KEY)
  }
}

type AuthRoleCache = {
  email: string
  userRole: UserRole
  userPosition: string | null
  permissions: UserPermissions | null
  updatedAt: number
}

function readAuthRoleCache(normalizedEmail: string): AuthRoleCache | null {
  if (typeof window === 'undefined' || !normalizedEmail) return null
  try {
    const raw = localStorage.getItem(AUTH_ROLE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthRoleCache
    if (!parsed?.email || parsed.userRole == null) return null
    if (parsed.email.trim().toLowerCase() !== normalizedEmail) return null
    if (Date.now() - parsed.updatedAt > AUTH_ROLE_CACHE_MAX_AGE_MS) return null
    if (parsed.userRole === 'customer') return null
    return parsed
  } catch {
    return null
  }
}

function writeAuthRoleCache(snapshot: AuthSnapshot) {
  if (typeof window === 'undefined') return
  const email = snapshot.user?.email?.trim()
  if (!email || snapshot.userRole == null || snapshot.userRole === 'customer') return
  try {
    const cache: AuthRoleCache = {
      email: email.toLowerCase(),
      userRole: snapshot.userRole,
      userPosition: snapshot.userPosition,
      permissions: snapshot.permissions,
      updatedAt: Date.now(),
    }
    localStorage.setItem(AUTH_ROLE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

function readAuthSnapshot(): AuthSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(AUTH_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSnapshot
    if (!parsed?.isInitialized) return null

    if (parsed.isSimulating && parsed.simulatedUser?.email) {
      if (isSimulationRecentlyEnded()) {
        clearAuthSnapshot()
        return null
      }
      return parsed
    }

    if (!hasPersistedAuthSession()) {
      clearAuthSnapshot()
      return null
    }

    const snapshotEmail = parsed.user?.email?.trim().toLowerCase()
    if (!snapshotEmail) {
      clearAuthSnapshot()
      return null
    }

    const hydrated = authUserFromStoredAccessToken(0)
    const hydratedEmail = hydrated?.email?.trim().toLowerCase()
    const emailMatches = !!hydratedEmail && hydratedEmail === snapshotEmail
    const hasRefreshToken = !!localStorage.getItem('sb-refresh-token')?.trim()

    if (!emailMatches) {
      if (!hasRefreshToken) {
        clearAuthSnapshot()
        return null
      }
      const roleCache = readAuthRoleCache(snapshotEmail)
      if (!roleCache) {
        clearAuthSnapshot()
        return null
      }
      if (parsed.userRole == null) return null
      return {
        ...parsed,
        user: parsed.user,
        authUser: parsed.authUser ?? parsed.user,
        userRole: parsed.userRole ?? roleCache.userRole,
        userPosition: parsed.userPosition ?? roleCache.userPosition,
        permissions: parsed.permissions ?? roleCache.permissions,
      }
    }

    if (parsed.userRole == null) {
      const roleCache = readAuthRoleCache(snapshotEmail)
      if (!roleCache) return null
      return {
        ...parsed,
        user: hydrated ?? parsed.user,
        authUser: hydrated ?? parsed.authUser ?? parsed.user,
        userRole: roleCache.userRole,
        userPosition: roleCache.userPosition,
        permissions: roleCache.permissions,
      }
    }

    return {
      ...parsed,
      user: hydrated ?? parsed.user,
      authUser: hydrated ?? parsed.authUser ?? parsed.user,
    }
  } catch {
    clearAuthSnapshot()
    return null
  }
}

function readAuthFromRoleCacheOnly(): AuthSnapshot | null {
  if (typeof window === 'undefined' || !hasPersistedAuthSession()) return null

  const hydrated = authUserFromStoredAccessToken(0)
  const cachedEmail = hydrated?.email?.trim().toLowerCase()

  let roleCache = cachedEmail ? readAuthRoleCache(cachedEmail) : null
  if (!roleCache) {
    try {
      const raw = localStorage.getItem(AUTH_ROLE_CACHE_KEY)
      if (!raw || !localStorage.getItem('sb-refresh-token')?.trim()) return null
      const parsed = JSON.parse(raw) as AuthRoleCache
      if (!parsed?.email || parsed.userRole == null || parsed.userRole === 'customer') return null
      if (Date.now() - parsed.updatedAt > AUTH_ROLE_CACHE_MAX_AGE_MS) return null
      roleCache = parsed
    } catch {
      return null
    }
  }

  const email = (hydrated?.email ?? roleCache.email).trim().toLowerCase()
  if (!email || roleCache.email.trim().toLowerCase() !== email) return null

  const restoredUser: AuthUser =
    hydrated ??
    ({
      id: email,
      email,
      name: email.split('@')[0] || 'User',
      created_at: new Date(roleCache.updatedAt).toISOString(),
    } satisfies AuthUser)

  return {
    user: restoredUser,
    authUser: restoredUser,
    userRole: roleCache.userRole,
    userPosition: roleCache.userPosition,
    permissions: roleCache.permissions,
    isInitialized: true,
    isSimulating: false,
    simulatedUser: null,
  }
}

function writeAuthSnapshot(snapshot: AuthSnapshot) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot))
    writeAuthRoleCache(snapshot)
  } catch {
    /* ignore */
  }
}

function getInitialAuthState(): {
  user: AuthUser | null
  authUser: AuthUser | null
  userRole: UserRole | null
  userPosition: string | null
  permissions: UserPermissions | null
  loading: boolean
  isInitialized: boolean
  simulatedUser: SimulatedUser | null
  isSimulating: boolean
  restoredFromSnapshot: boolean
} {
  // SSR·클라이언트 첫 렌더를 동일하게 유지 (sessionStorage는 useLayoutEffect에서 복원)
  return {
    user: null,
    authUser: null,
    userRole: null,
    userPosition: null,
    permissions: null,
    loading: true,
    isInitialized: false,
    simulatedUser: null,
    isSimulating: false,
    restoredFromSnapshot: false,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialAuth = getInitialAuthState()
  const [user, setUser] = useState<AuthUser | null>(initialAuth.user)
  const [authUser, setAuthUser] = useState<AuthUser | null>(initialAuth.authUser)
  const [userRole, setUserRole] = useState<UserRole | null>(initialAuth.userRole)
  const [userPosition, setUserPosition] = useState<string | null>(initialAuth.userPosition)
  const [permissions, setPermissions] = useState<UserPermissions | null>(initialAuth.permissions)
  const [loading, setLoading] = useState(initialAuth.loading)
  const [isInitialized, setIsInitialized] = useState(initialAuth.isInitialized)
  const [teamChatUnreadCount, setTeamChatUnreadCount] = useState(0)
  
  // 시뮬레이션 상태 (SSR 호환성을 위해 초기값은 null/false로 설정)
  const [simulatedUser, setSimulatedUser] = useState<SimulatedUser | null>(initialAuth.simulatedUser)
  const [isSimulating, setIsSimulating] = useState(initialAuth.isSimulating)
  const restoredFromSnapshotRef = useRef(initialAuth.restoredFromSnapshot)

  // hydration 직후·첫 페인트 전에 스냅샷 복원 (서버 HTML과 클라이언트 첫 렌더 일치)
  useLayoutEffect(() => {
    syncAuthSessionCookieFromStorage()
    const snapshot = readAuthSnapshot() ?? readAuthFromRoleCacheOnly()
    if (!snapshot) return

    setUser(snapshot.user)
    setAuthUser(snapshot.authUser ?? snapshot.user)
    setUserRole(snapshot.userRole)
    setUserPosition(snapshot.userPosition)
    setPermissions(snapshot.permissions)
    setSimulatedUser(snapshot.simulatedUser)
    setIsSimulating(snapshot.isSimulating)
    setLoading(false)
    setIsInitialized(true)
    restoredFromSnapshotRef.current = true
  }, [])

  const userRef = useRef<AuthUser | null>(null)
  userRef.current = user
  const userRoleRef = useRef<UserRole | null>(null)
  userRoleRef.current = userRole

  const isInitializedRef = useRef(false)
  useEffect(() => {
    isInitializedRef.current = isInitialized
  }, [isInitialized])

  /** 동일 이메일에 대한 동시 `checkUserRole` 호출을 하나의 team 쿼리로 합침 */
  const roleCheckInflightRef = useRef<Map<string, Promise<void>>>(new Map())
  const signedOutRecoveryInFlightRef = useRef(false)

  // 토큰 자동 갱신 함수
  const refreshTokenIfNeeded = useCallback(async () => {
    try {
      if (isAuthRefreshRateLimited()) {
        return true
      }

      const accessToken = localStorage.getItem('sb-access-token')
      const refreshToken = localStorage.getItem('sb-refresh-token')
      const expiresAt = localStorage.getItem('sb-expires-at')
      
      if (!accessToken || !refreshToken || !expiresAt) {
        return false
      }
      
      const now = Math.floor(Date.now() / 1000)
      const tokenExpiry = parseInt(expiresAt)
      
      // 만료 5분 전에만 갱신 (1시간 전 갱신은 refresh_token 429 유발)
      if (tokenExpiry <= now + 300 && canAttemptProactiveRefresh()) {
        console.log('AuthContext: Token expires soon, attempting refresh')
        markProactiveRefreshAttempted()

        if (supabase) {
          const { session, error } = await coordinatedRefreshSession(supabase, {
            refresh_token: refreshToken,
          })
          
          if (session && !error) {
            console.log('AuthContext: Token refreshed successfully')
            localStorage.setItem('sb-access-token', session.access_token)
            localStorage.setItem('sb-refresh-token', session.refresh_token)
            const newExpiry = session.expires_at || Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
            localStorage.setItem('sb-expires-at', newExpiry.toString())
            updateSupabaseToken(session.access_token, {
              refreshToken: session.refresh_token,
            })
            return true
          } else {
            if (isAuthRateLimitError(error)) {
              console.warn('AuthContext: Token refresh rate limited, keeping current session')
              return true
            }
            if (isAuthRefreshDiscardedError(error)) {
              return true
            }
            console.warn('AuthContext: Token refresh failed:', error)
            return false
          }
        }
      }
      
      return true
    } catch (error) {
      if (isAuthRateLimitError(error) || isAuthRefreshDiscardedError(error)) {
        return true
      }
      console.warn('AuthContext: Token refresh error:', error)
      return false
    }
  }, [])

  // 사용자 역할 및 권한 확인
  const checkUserRole = useCallback(async (email: string, options?: CheckUserRoleOptions): Promise<void> => {
    const background = options?.background === true
    const forceRpc = options?.forceRpc === true
    if (!email) {
      console.log('AuthContext: No email provided, setting customer role')
      setUserRole('customer')
      setUserPosition(null)
      setPermissions(null)
      setLoading(false)
      setIsInitialized(true)
      return
    }

    const dedupeKey = email.trim().toLowerCase()
    const existing = roleCheckInflightRef.current.get(dedupeKey)
    if (existing) {
      await Promise.race([
        existing,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('role_check_dedupe_timeout')), ROLE_CHECK_DEDUPE_WAIT_MS)
        ),
      ]).catch(() => {
        console.warn('AuthContext: role check dedupe wait timed out, continuing')
      })
      return
    }

    let runPromise: Promise<void>
    runPromise = new Promise<void>((resolve, reject) => {
      void (async () => {
        try {
          console.log('AuthContext: Checking user role for:', email)

          if (!supabase) {
            console.error('AuthContext: Supabase client not available')
            setUserRole('customer')
            setUserPosition(null)
            setPermissions(null)
            setLoading(false)
            setIsInitialized(true)
            resolve()
            return
          }

          if (!canUseAuthenticatedRest()) {
            if (isAuthRefreshRateLimited()) {
              const prevRole = userRoleRef.current
              if (prevRole && prevRole !== 'customer') {
                console.warn(
                  'AuthContext: Skipping team query during refresh cooldown — keeping prior role'
                )
                setLoading(false)
                setIsInitialized(true)
                resolve()
                const retryMs = getAuthRefreshCooldownRemainingMs() + 800
                setTimeout(() => {
                  void checkUserRole(email).catch(() => {})
                }, retryMs)
                return
              }
            }
          }

          console.log('AuthContext: Querying team table for email:', email)

          const normalizedEmail = email.toLowerCase()

          if (!forceRpc) {
            const jwtClaims = readJwtTeamClaimsForEmail(normalizedEmail)
            if (jwtClaims?.teamRole) {
              const role = jwtClaims.teamRole
              const position = jwtClaims.teamPosition

              setUserPosition(position)
              setUserRole(role)
              setPermissions(permissionsForRole(role))

              if (jwtClaims.teamNameKo) {
                setAuthUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        name: jwtClaims.teamNameKo as string,
                      }
                    : null
                )
              }

              setLoading(false)
              setIsInitialized(true)

              console.log('AuthContext: Role applied from JWT claims:', role, 'for:', email)

              if (!background) {
                scheduleDeferredWork(() => {
                  void checkUserRole(email, { background: true, forceRpc: true }).catch(() => {})
                })
              }

              resolve()
              return
            }
          }

          if (isSuperAdminEmail(normalizedEmail)) {
            console.log('AuthContext: Super admin detected, setting admin role')
            setUserRole('admin')
            setUserPosition(null)
            setPermissions(permissionsForRole('admin'))
            setLoading(false)
            setIsInitialized(true)
            resolve()
            return
          }

          try {
            const teamData = await fetchAuthTeamMemberRow(normalizedEmail)

            console.log('AuthContext: Team role lookup result:', {
              hasData: !!teamData,
              teamData: teamData
                ? {
                    name_ko: teamData.name_ko,
                    position: teamData.position,
                    is_active: teamData.is_active,
                  }
                : null,
              email,
              background,
            })

            if (!teamData) {
              if (background && userRoleRef.current && userRoleRef.current !== 'customer') {
                console.warn(
                  'AuthContext: Background role revalidation empty — keeping cached role for:',
                  email
                )
                resolve()
                return
              }
            }

            const role = getUserRole(email, teamData ?? undefined)
            const position = teamData?.position ?? null

            setUserPosition(position)

            const userPermissions = permissionsForRole(role)

            if (teamData?.name_ko) {
              setAuthUser((prev) =>
                prev
                  ? {
                      ...prev,
                      name: teamData.name_ko as string,
                    }
                  : null
              )
            }

            setUserRole(role)
            setPermissions(userPermissions)
            setLoading(false)
            setIsInitialized(true)

            console.log('AuthContext: User role set successfully:', role, 'for user:', email)
          } catch (teamErr) {
            if (background && userRoleRef.current && userRoleRef.current !== 'customer') {
              console.warn('AuthContext: Background role revalidation failed, keeping cached role:', teamErr)
              resolve()
              return
            }
            console.warn('AuthContext: Team query failed, using customer role:', teamErr)
            setUserRole('customer')
            setUserPosition(null)
            setPermissions(null)
            setLoading(false)
            setIsInitialized(true)
          }
          resolve()
        } catch (error) {
          console.error('AuthContext: Error checking user role:', error)
          setUserRole('customer')
          setUserPosition(null)
          setPermissions(null)
          setLoading(false)
          setIsInitialized(true)
          reject(error instanceof Error ? error : new Error(String(error)))
        } finally {
          if (roleCheckInflightRef.current.get(dedupeKey) === runPromise) {
            roleCheckInflightRef.current.delete(dedupeKey)
          }
        }
      })()
    })

    roleCheckInflightRef.current.set(dedupeKey, runPromise)
    try {
      await runPromise
    } catch {
      // reject는 이미 catch에서 customer 상태로 정규화됨
    }
  }, [])

  /** JWT + 역할 캐시(또는 슈퍼관리자)로 UI를 즉시 열고, 역할은 백그라운드 재검증 */
  const bootstrapFromCachedRole = useCallback(
    (authUserData: AuthUser): boolean => {
      const email = authUserData.email.trim().toLowerCase()
      if (!email) return false

      const applyStaffBootstrap = (role: UserRole, position: string | null, nameKo?: string | null) => {
        setUser(authUserData)
        setAuthUser(
          nameKo
            ? {
                ...authUserData,
                name: nameKo,
              }
            : authUserData
        )
        setUserRole(role)
        setUserPosition(position)
        setPermissions(permissionsForRole(role))
        setLoading(false)
        setIsInitialized(true)
        const token = getStoredAccessTokenIfValid(0)
        if (token) {
          updateSupabaseToken(token)
        }
        void refreshTokenIfNeeded()
        scheduleDeferredWork(() => {
          void checkUserRole(authUserData.email, { background: true, forceRpc: true }).catch((error) => {
            console.warn('AuthContext: Background role revalidation after cache bootstrap failed:', error)
          })
        })
      }

      const jwtClaims = readJwtTeamClaimsForEmail(email)
      if (jwtClaims && isStaffTeamRole(jwtClaims.teamRole)) {
        applyStaffBootstrap(jwtClaims.teamRole, jwtClaims.teamPosition, jwtClaims.teamNameKo)
        return true
      }

      if (isSuperAdminEmail(email)) {
        applyStaffBootstrap('admin', null)
        return true
      }

      const roleCache = readAuthRoleCache(email)
      if (!roleCache) return false

      applyStaffBootstrap(roleCache.userRole, roleCache.userPosition)
      return true
    },
    [checkUserRole, refreshTokenIfNeeded]
  )

  const hydrateAuthFromStoredAccessToken = useCallback(
    (reason: string): boolean => {
      const accessToken = getStoredAccessTokenIfValid(30)
      if (!accessToken) return false
      const hydrated = authUserFromStoredAccessToken()
      if (!hydrated?.email) return false
      updateSupabaseToken(accessToken)
      if (
        userRef.current?.email?.toLowerCase() === hydrated.email.toLowerCase() &&
        userRoleRef.current != null
      ) {
        return true
      }
      console.log(`AuthContext: Hydrated user from stored JWT (${reason}):`, hydrated.email)
      setUser(hydrated)
      setAuthUser(hydrated)
      if (!canUseAuthenticatedRest() && isAuthRefreshRateLimited()) {
        setLoading(false)
        setIsInitialized(true)
        return true
      }
      if (bootstrapFromCachedRole(hydrated)) {
        return true
      }
      void checkUserRole(hydrated.email).catch((error) => {
        console.error('AuthContext: Team membership check failed after JWT hydrate:', error)
        setUserRole('customer')
        setUserPosition(null)
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
      })
      return true
    },
    [checkUserRole, bootstrapFromCachedRole]
  )

  const recoverAuthSession = useCallback(async () => {
    if (typeof window === 'undefined' || !supabase) return
    if (isSimulating && simulatedUser) return

    const nowSec = Math.floor(Date.now() / 1000)
    const expRaw = typeof window !== 'undefined' ? localStorage.getItem('sb-expires-at') : null
    const expSec = expRaw ? parseInt(expRaw, 10) : NaN
    if (
      userRef.current?.email &&
      isInitializedRef.current &&
      userRoleRef.current !== null &&
      localStorage.getItem('sb-access-token') &&
      Number.isFinite(expSec) &&
      expSec > nowSec + 120
    ) {
      return
    }

    const hasStoredAuth = !!(
      localStorage.getItem('sb-refresh-token') || localStorage.getItem('sb-access-token')
    )
    if (!userRef.current?.email && hasStoredAuth && !isInitializedRef.current) {
      setLoading(true)
    }

    try {
      let session = await getSupabaseSessionBounded(AUTH_SESSION_BUDGET_MS)

      if (!session?.user?.email) {
        const storedAccess = getStoredAccessTokenIfValid(30)
        if (storedAccess) {
          updateSupabaseToken(storedAccess)
        } else {
          const rt = localStorage.getItem('sb-refresh-token')
          if (rt && canAttemptProactiveRefresh()) {
            markProactiveRefreshAttempted()
            session = await refreshSupabaseSessionBounded(rt, AUTH_SESSION_RETRY_MS)
          }
        }
      }

      if (!session?.user?.email) {
        if (hydrateAuthFromStoredAccessToken('recoverAuthSession')) {
          if (!userRef.current?.email && hasStoredAuth) {
            setLoading(false)
          }
          return
        }
        if (!userRef.current?.email && hasStoredAuth) {
          setLoading(false)
        }
        return
      }

      persistSupabaseSessionToStorage(session)
      updateSupabaseToken(session.access_token)

      const email = session.user.email
      if (userRef.current?.email === email) return

      if (!isInitializedRef.current || userRoleRef.current === null) {
        setLoading(true)
      }
      const authUserData = authUserFromSupabaseSessionUser(session.user)
      if (bootstrapFromCachedRole(authUserData)) {
        return
      }
      setUser(authUserData)
      setAuthUser(authUserData)
      await checkUserRole(email)
    } catch (e) {
      console.warn('AuthContext: recoverAuthSession:', e)
      if (!userRef.current?.email && hasStoredAuth) {
        setLoading(false)
      }
    }
  }, [hydrateAuthFromStoredAccessToken, isSimulating, simulatedUser, checkUserRole, bootstrapFromCachedRole])

  // 시뮬레이션 정보 복원 (클라이언트에서만 실행, SSR 호환성)
  useEffect(() => {
    // 클라이언트에서만 실행
    if (typeof window === 'undefined') {
      return
    }

    syncSimulationStorageWithCurrentBackend()
    
    // 이미 시뮬레이션 상태가 설정되어 있으면 로딩 상태만 업데이트
    if (simulatedUser && isSimulating) {
      console.log('AuthContext: Simulation already initialized from initial state, updating loading status')
      setLoading(false)
      setIsInitialized(true)
      return
    }
    
    // 언어 전환 시 시뮬레이션 상태가 일시적으로 초기화될 수 있으므로 
    // 저장된 시뮬레이션 데이터가 있는지 먼저 확인
    console.log('AuthContext: Checking for saved simulation data...', {
      currentSimulatedUser: simulatedUser?.email,
      currentIsSimulating: isSimulating,
      timestamp: new Date().toISOString()
    })
    
    // 시뮬레이션 종료 시점이 있으면 복원하지 않음
    if (isSimulationRecentlyEnded()) {
      console.log('AuthContext: Simulation was ended recently, not restoring')
      return
    }
    
    // localStorage에서 시뮬레이션 정보 확인
    let simulationData = null
    const savedSimulation = localStorage.getItem('positionSimulation')
    
    if (savedSimulation) {
      try {
        simulationData = JSON.parse(savedSimulation)
        console.log('AuthContext: Found saved simulation data in localStorage:', simulationData)
      } catch (error) {
        console.error('AuthContext: Error parsing localStorage simulation:', error)
        localStorage.removeItem('positionSimulation')
      }
    }
    
    // localStorage에 없으면 sessionStorage에서 확인
    if (!simulationData) {
      const sessionSimulation = sessionStorage.getItem('positionSimulation')
      
      if (sessionSimulation) {
        try {
          simulationData = JSON.parse(sessionSimulation)
          console.log('AuthContext: Found saved simulation data in sessionStorage:', simulationData)
          
          // sessionStorage에서 복원한 데이터를 localStorage에도 저장
          localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        } catch (error) {
          console.error('AuthContext: Error parsing sessionStorage simulation:', error)
          sessionStorage.removeItem('positionSimulation')
        }
      }
    }
    
    // sessionStorage에도 없으면 쿠키에서 확인
    if (!simulationData) {
      const cookies = document.cookie.split(';')
      const simulationActiveCookie = cookies.find(cookie => cookie.trim().startsWith('simulation_active='))
      const simulationUserCookie = cookies.find(cookie => cookie.trim().startsWith('simulation_user='))
      
      if (simulationActiveCookie && simulationUserCookie) {
        try {
          const userCookieValue = simulationUserCookie.split('=')[1]
          simulationData = JSON.parse(decodeURIComponent(userCookieValue))
          console.log('AuthContext: Found saved simulation data in cookies:', simulationData)
          
          // 쿠키에서 복원한 데이터를 localStorage와 sessionStorage에도 저장
          localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
          sessionStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        } catch (error) {
          console.error('AuthContext: Error parsing cookie simulation:', error)
        }
      }
    }
    
    if (simulationData) {
      const rawRecord = simulationData as Record<string, unknown>
      const currentUrl = getPublicSupabaseUrl()
      const storedBackend = readSimulationBackendMeta(rawRecord)
      if (currentUrl && storedBackend && storedBackend !== currentUrl) {
        console.warn('AuthContext: Simulation snapshot belongs to another Supabase project, discarding')
        clearSimulationBrowserStorage()
        simulationData = null
      }
    }

    if (simulationData) {
      const cleaned = stripSimulationBackendMeta(simulationData as Record<string, unknown>) as unknown as SimulatedUser
      // 시뮬레이션 데이터 유효성 검사
      if (cleaned.email && cleaned.role) {
        console.log('AuthContext: Valid simulation data found, restoring...', cleaned)
        
        // 상태 설정 (동기적으로 즉시 설정)
        setSimulatedUser(cleaned)
        setIsSimulating(true)
        setLoading(false) // 시뮬레이션 복원 시 즉시 로딩 완료
        setIsInitialized(true) // 시뮬레이션 복원 시 초기화 완료
        
        console.log('AuthContext: Simulation restored successfully:', cleaned)
        
        // 언어 전환 시 시뮬레이션 상태가 보존되었음을 확인
        console.log('AuthContext: Simulation state preserved during language switch')
        
        const persist = withSimulationBackendMeta(cleaned)
        const persistStr = JSON.stringify(persist)
        // 추가 안전장치: 시뮬레이션 상태를 다시 한 번 저장하여 지속성 보장
        localStorage.setItem('positionSimulation', persistStr)
        sessionStorage.setItem('positionSimulation', persistStr)
        document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
        document.cookie = `simulation_user=${encodeURIComponent(persistStr)}; path=/; max-age=3600; SameSite=Lax`
        
        // 시뮬레이션 상태가 복원되었음을 전역적으로 알림
        window.dispatchEvent(new CustomEvent('simulationRestored', { detail: cleaned }))
        
        return // 시뮬레이션 복원 시 다른 초기화 건너뛰기
      } else {
        console.warn('AuthContext: Invalid simulation data, removing:', simulationData)
        localStorage.removeItem('positionSimulation')
        sessionStorage.removeItem('positionSimulation')
        // 쿠키도 정리
        document.cookie = 'simulation_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        document.cookie = 'simulation_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
    } else {
      console.log('AuthContext: No saved simulation data found')
    }
  }, [isSimulating, simulatedUser]) // 시뮬레이션 상태 변화 감지

  // 시뮬레이션 상태 지속성 확인 (언어 전환 시 안정성 보장)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // 시뮬레이션 중일 때만 실행
    if (!isSimulating || !simulatedUser) return
    
    console.log('AuthContext: Setting up simulation persistence check for:', simulatedUser.email)
    
    // 주기적으로 시뮬레이션 상태 확인 (3초마다 - 더 자주 체크)
    const interval = setInterval(() => {
      const savedSimulation = localStorage.getItem('positionSimulation')
      if (!savedSimulation) {
        // 시뮬레이션 데이터가 사라진 경우 조용히 복원 (로그 레벨을 낮춤)
        console.debug('AuthContext: Simulation data lost from localStorage, restoring...')
        // 시뮬레이션 데이터가 사라진 경우 다시 저장
        const lostPayload = JSON.stringify(withSimulationBackendMeta(simulatedUser))
        localStorage.setItem('positionSimulation', lostPayload)
        sessionStorage.setItem('positionSimulation', lostPayload)
        document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
        document.cookie = `simulation_user=${encodeURIComponent(lostPayload)}; path=/; max-age=3600; SameSite=Lax`
      } else {
        // 저장된 데이터가 현재 상태와 다른지 확인
        try {
          const parsedSaved = JSON.parse(savedSimulation)
          if (parsedSaved.email !== simulatedUser.email) {
            // 시뮬레이션 데이터 불일치 시 조용히 업데이트 (로그 레벨을 낮춤)
            console.debug('AuthContext: Simulation data mismatch, updating...')
            const mismatchPayload = JSON.stringify(withSimulationBackendMeta(simulatedUser))
            localStorage.setItem('positionSimulation', mismatchPayload)
            sessionStorage.setItem('positionSimulation', mismatchPayload)
            document.cookie = `simulation_user=${encodeURIComponent(mismatchPayload)}; path=/; max-age=3600; SameSite=Lax`
          }
        } catch (error) {
          console.error('AuthContext: Error parsing saved simulation data:', error)
        }
      }
    }, 3000) // 3초마다 체크
    
    return () => {
      clearInterval(interval)
    }
  }, [isSimulating, simulatedUser])

  // 인증 상태 관리 (시뮬레이션이 복원되지 않은 경우에만 실행)
  useEffect(() => {
    // 시뮬레이션이 이미 복원된 경우 완전히 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('AuthContext: Simulation active, completely skipping authentication initialization', {
        simulatedUser: simulatedUser.email,
        isSimulating
      })
      return
    }
    
    // 시뮬레이션 중이지만 simulatedUser가 없는 경우 잠시 기다림
    if (isSimulating && !simulatedUser) {
      console.log('AuthContext: Simulation in progress but no simulatedUser yet, waiting...')
      return
    }

    const skipHeavyBootstrap = restoredFromSnapshotRef.current

    if (skipHeavyBootstrap) {
      restoredFromSnapshotRef.current = false
      setLoading(false)
      console.log('AuthContext: Restored from snapshot, skipping heavy bootstrap')
      void (async () => {
        const upgraded = await upgradeSessionForTeamRoleClaims()
        void refreshTokenIfNeeded()
        const emailForRevalidate = userRef.current?.email?.trim()
        if (!emailForRevalidate) return
        if (upgraded) {
          void checkUserRole(emailForRevalidate).catch((error) => {
            console.warn('AuthContext: Role sync after JWT upgrade failed:', error)
          })
          return
        }
        scheduleDeferredWork(() => {
          void checkUserRole(emailForRevalidate, { background: true, forceRpc: true }).catch((error) => {
            console.warn('AuthContext: Background role revalidation failed:', error)
          })
        })
      })()
    } else {
      console.log('AuthContext: Initializing authentication...')
    }

    let delayedAuthTimer: ReturnType<typeof setTimeout> | undefined
    let bootstrapFailsafe: ReturnType<typeof setTimeout> | undefined

    if (!skipHeavyBootstrap) {
      bootstrapFailsafe = setTimeout(() => {
        if (isInitializedRef.current) return

        const storedEmail =
          userRef.current?.email?.trim() || authUserFromStoredAccessToken()?.email?.trim()
        const hasValidToken = !!getStoredAccessTokenIfValid(0)

        if (hasValidToken && storedEmail) {
          console.warn(
            'AuthContext: bootstrap failsafe — slow network, retrying team role check for:',
            storedEmail
          )
          void checkUserRole(storedEmail).catch((error) => {
            console.error('AuthContext: Role check retry failed on bootstrap failsafe:', error)
          })
          return
        }

        console.warn('AuthContext: bootstrap failsafe — forcing guest init (no valid session)')
        setUserRole((role) => role ?? 'customer')
        setUserPosition((pos) => pos ?? null)
        setPermissions((perms) => perms ?? null)
        setLoading(false)
        setIsInitialized(true)
      }, AUTH_BOOTSTRAP_FAILSAFE_MS)
    }

    // localStorage에서 토큰 확인
    const checkStoredTokens = async () => {
      try {
        syncCustomTokensFromGoTrueStorage()
        await upgradeSessionForTeamRoleClaims()

        const coldCacheUser = readAuthFromRoleCacheOnly()?.user
        if (coldCacheUser && bootstrapFromCachedRole(coldCacheUser)) {
          return
        }

        const hydratedEarly = authUserFromStoredAccessToken(0)
        if (hydratedEarly?.email && hasPersistedAuthSession()) {
          if (bootstrapFromCachedRole(hydratedEarly)) {
            return
          }
        }

        const accessToken = localStorage.getItem('sb-access-token')
        const expiresAt = localStorage.getItem('sb-expires-at')
        
        console.log('AuthContext: Checking stored tokens:', {
          hasAccessToken: !!accessToken,
          hasExpiresAt: !!expiresAt,
          expiresAt: expiresAt ? new Date(parseInt(expiresAt) * 1000).toISOString() : 'N/A'
        })
        
        const validAccessToken = getStoredAccessTokenIfValid(0)
        if (validAccessToken && expiresAt) {
          const now = Math.floor(Date.now() / 1000)
          const tokenExpiry = parseInt(expiresAt)
          
          if (tokenExpiry > now) {
            console.log('AuthContext: Found valid stored token, creating mock session')
            
            // JWT 토큰에서 사용자 정보 추출 (간단한 방법)
            try {
              const tokenPayload = JSON.parse(atob(validAccessToken.split('.')[1]))
              console.log('AuthContext: Token payload:', tokenPayload)
              
              if (tokenPayload.email) {
                // Mock 사용자 객체 생성
                const mockUser = {
                  id: tokenPayload.sub,
                  email: tokenPayload.email,
                  user_metadata: {
                    name: tokenPayload.user_metadata?.name || tokenPayload.user_metadata?.full_name || 'User',
                    avatar_url: tokenPayload.user_metadata?.avatar_url,
                    ...tokenPayload.user_metadata
                  },
                  created_at: tokenPayload.iat ? new Date(tokenPayload.iat * 1000).toISOString() : new Date().toISOString()
                } as User
                
                console.log('AuthContext: Mock user created:', mockUser.email)
                
                const authUserData: AuthUser = {
                  id: mockUser.id,
                  email: mockUser.email || '',
                  name: mockUser.user_metadata?.name || 
                        mockUser.user_metadata?.full_name || 
                        mockUser.email?.split('@')[0] || 'User',
                  avatar_url: mockUser.user_metadata?.avatar_url,
                  created_at: mockUser.created_at,
                  user_metadata: mockUser.user_metadata
                }
                
                setUser(authUserData)
                setAuthUser(authUserData)
                
                console.log('AuthContext: Mock session created, updating Supabase token')
                
                updateSupabaseToken(validAccessToken)

                if (bootstrapFromCachedRole(authUserData)) {
                  return
                }

                // 갱신은 네트워크 지연·504에 막히지 않도록 백그라운드만 수행 — 역할 확인·UI는 바로 진행
                if (tokenExpiry <= now + 300 && canAttemptProactiveRefresh()) {
                  const refreshToken = localStorage.getItem('sb-refresh-token')
                  if (refreshToken && supabase) {
                    void (async () => {
                      if (!supabase || !canAttemptProactiveRefresh()) return
                      markProactiveRefreshAttempted()
                      try {
                        const { session, error } = await coordinatedRefreshSession(supabase, {
                          refresh_token: refreshToken,
                        })
                        if (session && !error) {
                          localStorage.setItem('sb-access-token', session.access_token)
                          localStorage.setItem('sb-refresh-token', session.refresh_token)
                          const newExpiry =
                            session.expires_at || Math.floor(Date.now() / 1000) + 7 * 24 * 3600
                          localStorage.setItem('sb-expires-at', newExpiry.toString())
                          updateSupabaseToken(session.access_token, {
                            refreshToken: session.refresh_token,
                          })
                        }
                      } catch (e) {
                        if (!isAuthRateLimitError(e) && !isAuthRefreshDiscardedError(e)) {
                          console.warn('AuthContext: background refreshSession error:', e)
                        }
                      }
                    })()
                  }
                }

                checkUserRole(mockUser.email || '').catch(error => {
                  console.error('AuthContext: Team membership check failed:', error)
                  setUserRole('customer')
                  setUserPosition(null)
                  setPermissions(null)
                  setLoading(false)
                  setIsInitialized(true)
                })
                
                // setLoading(false) 제거 - checkUserRole에서 처리
                return
              }
            } catch (tokenError) {
              console.error('AuthContext: Error parsing token:', tokenError)
            }
          } else {
            console.log('AuthContext: Stored token expired, removing')
            localStorage.removeItem('sb-access-token')
            localStorage.removeItem('sb-refresh-token')
            localStorage.removeItem('sb-expires-at')
          }
        }
      } catch (error) {
        console.error('AuthContext: Error checking stored tokens:', error)
      }
      
      // 토큰이 없거나 만료된 경우 - Supabase 세션 확인
      console.log('AuthContext: No valid token found, checking Supabase session...')
      
      // Supabase에서 현재 세션 확인
      if (supabase) {
        try {
          let session = await getSupabaseSessionBounded(AUTH_SESSION_BUDGET_MS)
          if (!session?.user?.email && typeof window !== 'undefined') {
            const rt = localStorage.getItem('sb-refresh-token')
            if (rt) {
              console.warn('AuthContext: getSession slow/empty, trying refresh token (mobile)')
              session = await refreshSupabaseSessionBounded(rt, AUTH_SESSION_RETRY_MS)
            } else {
              session = await getSupabaseSessionBounded(AUTH_SESSION_RETRY_MS)
            }
          }

          if (session?.user?.email) {
            console.log('AuthContext: Found Supabase session:', session.user.email)
            
            // 세션에서 사용자 정보 설정
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 
                    session.user.user_metadata?.full_name || 
                    (session.user.email ? session.user.email.split('@')[0] : 'User'),
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
              user_metadata: session.user.user_metadata
            }
            
            setUser(authUserData)
            setAuthUser(authUserData)
            
            localStorage.setItem('sb-access-token', session.access_token)
            localStorage.setItem('sb-refresh-token', session.refresh_token)
            const tokenExpiry = session.expires_at || Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
            localStorage.setItem('sb-expires-at', tokenExpiry.toString())
            
            updateSupabaseToken(session.access_token)
            
            if (session.user.email) {
              if (bootstrapFromCachedRole(authUserData)) {
                return
              }
              checkUserRole(session.user.email).catch(error => {
                console.error('AuthContext: Team membership check failed:', error)
                setUserRole('customer')
                setUserPosition(null)
                setPermissions(null)
                setLoading(false)
                setIsInitialized(true)
              })
            } else {
              console.error('AuthContext: No email in session user')
              setUserRole('customer')
              setUserPosition(null)
              setPermissions(null)
              setLoading(false)
              setIsInitialized(true)
            }
            return
          } else {
            console.log('AuthContext: No Supabase session found after bounded checks')
          }
        } catch (sessionError) {
          console.error('AuthContext: Error getting Supabase session:', sessionError)
        }
      }
      
      // 짧은 지연 후 다시 한 번 확인 (토큰 복원 시간 제공)
      delayedAuthTimer = setTimeout(() => {
        if (isInitializedRef.current) {
          return
        }

        const accessToken = localStorage.getItem('sb-access-token')
        const expiresAt = localStorage.getItem('sb-expires-at')
        
        if (accessToken && expiresAt) {
          const now = Math.floor(Date.now() / 1000)
          const tokenExpiry = parseInt(expiresAt)
          
          if (tokenExpiry > now) {
            console.log('AuthContext: Token found after delay, creating mock session...')
            try {
              const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]))
              
              if (tokenPayload.email) {
                const mockUser = {
                  id: tokenPayload.sub,
                  email: tokenPayload.email,
                  user_metadata: {
                    name: tokenPayload.user_metadata?.name || tokenPayload.user_metadata?.full_name || 'User',
                    avatar_url: tokenPayload.user_metadata?.avatar_url,
                    ...tokenPayload.user_metadata
                  },
                  created_at: tokenPayload.iat ? new Date(tokenPayload.iat * 1000).toISOString() : new Date().toISOString()
                } as User
                
                const authUserData: AuthUser = {
                  id: mockUser.id,
                  email: mockUser.email || '',
                  name: mockUser.user_metadata?.name || 
                        mockUser.user_metadata?.full_name || 
                        mockUser.email?.split('@')[0] || 'User',
                  avatar_url: mockUser.user_metadata?.avatar_url,
                  created_at: mockUser.created_at,
                  user_metadata: mockUser.user_metadata
                }
                
                setUser(authUserData)
                setAuthUser(authUserData)
                updateSupabaseToken(accessToken)

                if (bootstrapFromCachedRole(authUserData)) {
                  return
                }
                
                checkUserRole(mockUser.email || '').catch(error => {
                  console.error('AuthContext: Team membership check failed:', error)
                  setUserRole('customer')
                  setUserPosition(null)
                  setPermissions(null)
                  setLoading(false)
                  setIsInitialized(true)
                })
                return
              }
            } catch (tokenError) {
              console.error('AuthContext: Error parsing delayed token:', tokenError)
            }
          }
        }

        if (isInitializedRef.current) {
          return
        }
        
        // 여전히 토큰이 없으면 customer로 설정
        console.log('AuthContext: No token found after delay, setting customer role')
        setUserRole('customer')
        setUserPosition(null)
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
      }, INITIAL_AUTH_DELAY_MS)
    }
    
    if (!skipHeavyBootstrap) {
      checkStoredTokens().catch(error => {
        console.error('AuthContext: Error in checkStoredTokens:', error)
      })
    } else if (initialAuth.userRole === 'customer' && initialAuth.user?.email) {
      console.log(
        'AuthContext: Snapshot had customer role — revalidating team membership for:',
        initialAuth.user.email
      )
      void checkUserRole(initialAuth.user.email).catch((error) => {
        console.error('AuthContext: Team membership revalidation failed after snapshot:', error)
      })
    }
    
    console.log('AuthContext: Initialization complete, setting up auth listener')

    // 인증 상태 변경 리스너만 설정
    if (!supabase) {
      console.error('AuthContext: Supabase client not available')
      return () => {
        if (bootstrapFailsafe) clearTimeout(bootstrapFailsafe)
        if (delayedAuthTimer) clearTimeout(delayedAuthTimer)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('AuthContext: Auth state change:', { 
          event, 
          session: !!session, 
          user: !!session?.user,
          userEmail: session?.user?.email 
        })
        
        if (event === 'SIGNED_OUT') {
          // 모바일에서 카메라 등 다른 앱 후 복귀 시 일시적 SIGNED_OUT·빈 getSession이 올 수 있음.
          // 짧은 지연·재시도 후에도 세션이 없을 때만 로그아웃 처리한다.
          if (signedOutRecoveryInFlightRef.current) {
            return
          }
          signedOutRecoveryInFlightRef.current = true
          console.log('AuthContext: SIGNED_OUT received, verifying session (mobile resume guard)')
          void (async () => {
            const clearSignedOutState = () => {
              clearAuthSnapshot()
              setUser(null)
              setAuthUser(null)
              setUserRole('customer')
              setUserPosition(null)
              setPermissions(null)
              setLoading(false)
            }
            const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
            const initialDelayMs = isMobile ? 700 : 220
            let refreshAttempted = false
            let keepUserDespiteSignedOut = false

            const tryRestoreFromStorage = async (): Promise<Session | null> => {
              if (!supabase || isAuthRefreshRateLimited() || refreshAttempted) return null
              const rt = localStorage.getItem('sb-refresh-token')
              if (!rt) return null
              refreshAttempted = true
              const { session, error } = await coordinatedRefreshSession(supabase, {
                refresh_token: rt,
              })
              if (error && isAuthRateLimitError(error)) {
                console.warn('AuthContext: SIGNED_OUT recovery skipped refresh (rate limited)')
              }
              if (error && isAuthInvalidRefreshError(error)) {
                console.warn('AuthContext: SIGNED_OUT recovery — refresh token invalid, clearing storage')
                clearStoredAuthTokens()
                return null
              }
              if (error || !session?.user?.email) return null
              return session
            }

            try {
              await new Promise((r) => setTimeout(r, initialDelayMs))
              if (!supabase) {
                clearSignedOutState()
                return
              }

              for (let attempt = 0; attempt < 2; attempt++) {
                if (attempt > 0) {
                  await new Promise((r) => setTimeout(r, isAuthRefreshRateLimited() ? 1200 : 500))
                }
                const verifySession = await getSupabaseSessionBounded(AUTH_SESSION_RETRY_MS)
                if (verifySession?.user?.email) {
                  console.log('AuthContext: Session still valid after SIGNED_OUT, keeping user')
                  const authUserData = authUserFromSupabaseSessionUser(verifySession.user)
                  setUser(authUserData)
                  setAuthUser(authUserData)
                  persistSupabaseSessionToStorage(verifySession)
                  updateSupabaseToken(verifySession.access_token)
                  return
                }
                if (isAuthRefreshRateLimited()) {
                  continue
                }
                const refreshed = await tryRestoreFromStorage()
                if (refreshed?.user?.email) {
                  console.log('AuthContext: Session recovered via refresh after SIGNED_OUT')
                  const authUserData = authUserFromSupabaseSessionUser(refreshed.user)
                  setUser(authUserData)
                  setAuthUser(authUserData)
                  persistSupabaseSessionToStorage(refreshed)
                  updateSupabaseToken(refreshed.access_token, {
                    refreshToken: refreshed.refresh_token,
                  })
                  return
                }
              }

              if (isAuthRefreshRateLimited() && localStorage.getItem('sb-access-token')) {
                console.warn(
                  'AuthContext: SIGNED_OUT during auth rate limit — keeping stored session, not clearing user'
                )
                keepUserDespiteSignedOut = true
              }
            } catch (e) {
              if (!isAuthRateLimitError(e) && !isAuthRefreshDiscardedError(e)) {
                console.warn('AuthContext: SIGNED_OUT verification failed:', e)
              }
            } finally {
              signedOutRecoveryInFlightRef.current = false
            }
            if (keepUserDespiteSignedOut) {
              hydrateAuthFromStoredAccessToken('SIGNED_OUT_RATE_LIMIT')
              return
            }
            console.log('AuthContext: User signed out (confirmed)')
            clearSignedOutState()
          })()
          return
        }

        if (event === 'SIGNED_IN' && session?.user?.email) {
          console.log('AuthContext: User signed in, setting user data')

          persistSupabaseSessionToStorage(session)
          // GoTrue가 이미 세션을 갖고 있음 — setSession 재호출은 refresh_token 연쇄(429)를 유발할 수 있음
          
          // Supabase User를 AuthUser로 변환
          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
            user_metadata: session.user.user_metadata
          }
          
          setUser(authUserData)
          setAuthUser(authUserData)
          
          // team 확인 (비동기로 처리하여 로딩을 차단하지 않음)
          checkUserRole(session.user.email).catch(error => {
            console.error('AuthContext: Team membership check failed:', error)
            setUserRole('customer')
            setUserPosition(null)
            setPermissions(null)
            setLoading(false)
            setIsInitialized(true)
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.email) {
          console.log('AuthContext: Token refreshed')
          
          persistSupabaseSessionToStorage(session)

          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
            user_metadata: session.user.user_metadata
          }
          
          setUser(authUserData)
          setAuthUser(authUserData)

          const jwtClaims = readTeamClaimsFromAccessToken(session.access_token)
          if (jwtClaims && jwtClaims.email === session.user.email.trim().toLowerCase()) {
            setUserRole(jwtClaims.teamRole)
            setUserPosition(jwtClaims.teamPosition)
            setPermissions(permissionsForRole(jwtClaims.teamRole))
            if (jwtClaims.teamNameKo) {
              setAuthUser((prev) =>
                prev ? { ...prev, name: jwtClaims.teamNameKo as string } : prev
              )
            }
            setLoading(false)
            setIsInitialized(true)
          }
        } else if (event === 'INITIAL_SESSION') {
          // 초기 세션 처리
          console.log('AuthContext: INITIAL_SESSION event received')
          if (session?.user?.email) {
            const initEmail = session.user.email
            console.log('AuthContext: Initial session found for:', initEmail)

            const alreadyBootstrapped =
              userRef.current?.email?.toLowerCase() === initEmail.toLowerCase() &&
              userRoleRef.current !== null &&
              isInitializedRef.current

            if (alreadyBootstrapped) {
              persistSupabaseSessionToStorage(session)
              const synced = authUserFromSupabaseSessionUser(session.user)
              setUser(synced)
              setAuthUser(synced)
              if (accessTokenNeedsTeamRoleUpgrade(session.access_token)) {
                void upgradeSessionForTeamRoleClaims().then((upgraded) => {
                  if (upgraded) void checkUserRole(initEmail).catch(() => {})
                })
              }
              return
            }

            // Supabase User를 AuthUser로 변환
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || 
                    session.user.user_metadata?.full_name || 
                    session.user.email.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
              user_metadata: session.user.user_metadata
            }
            
            setUser(authUserData)
            setAuthUser(authUserData)
            
            checkUserRole(session.user.email).catch(error => {
              console.error('AuthContext: Team membership check failed:', error)
              setUserRole('customer')
              setUserPosition(null)
              setPermissions(null)
              setLoading(false)
              setIsInitialized(true)
            })
          } else {
            console.log('AuthContext: No initial session in INITIAL_SESSION event')
            hydrateAuthFromStoredAccessToken('INITIAL_SESSION_EMPTY')
          }
        }
      }
    )

    return () => {
      if (bootstrapFailsafe) clearTimeout(bootstrapFailsafe)
      if (delayedAuthTimer) clearTimeout(delayedAuthTimer)
      subscription.unsubscribe()
    }
  }, [checkUserRole, hydrateAuthFromStoredAccessToken, isSimulating, simulatedUser, refreshTokenIfNeeded, bootstrapFromCachedRole])

  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized) return

    if (isSimulating && simulatedUser) {
      writeAuthSnapshot({
        user: null,
        authUser: null,
        userRole: simulatedUser.role,
        userPosition: simulatedUser.position,
        permissions: null,
        isInitialized: true,
        isSimulating: true,
        simulatedUser,
      })
      return
    }

    if (user?.email && userRole !== null) {
      // 로그인 토큰이 있는데 team 조회 지연으로 customer 가 된 경우 스냅샷에 저장하지 않음
      if (userRole === 'customer' && getStoredAccessTokenIfValid(0)) {
        return
      }
      writeAuthSnapshot({
        user,
        authUser: authUser ?? user,
        userRole,
        userPosition,
        permissions,
        isInitialized: true,
        isSimulating: false,
        simulatedUser: null,
      })
    }
  }, [
    isInitialized,
    user,
    authUser,
    userRole,
    userPosition,
    permissions,
    isSimulating,
    simulatedUser,
  ])

  // 모바일: 다른 앱 후 복귀 시(bfcache·visibility) React 상태와 Supabase 세션이 어긋나면 가이드 레이아웃이 auth로 보내는 문제 방지
  useEffect(() => {
    if (typeof window === 'undefined' || !supabase) return

    let lastResumeSync = 0
    const THROTTLE_MS = 800

    const resumeSync = async () => {
      if (document.visibilityState !== 'visible') return
      if (isSimulating && simulatedUser) return

      const now = Date.now()
      if (now - lastResumeSync < THROTTLE_MS) return
      lastResumeSync = now

      const nowSec = Math.floor(Date.now() / 1000)
      const expRaw = localStorage.getItem('sb-expires-at')
      const expSec = expRaw ? parseInt(expRaw, 10) : NaN
      if (
        userRef.current?.email &&
        isInitializedRef.current &&
        userRoleRef.current !== null &&
        localStorage.getItem('sb-access-token') &&
        Number.isFinite(expSec) &&
        expSec > nowSec + 120
      ) {
        scheduleDeferredWork(() => {
          const email = userRef.current?.email?.trim()
          if (email && userRoleRef.current && userRoleRef.current !== 'customer') {
            void checkUserRole(email, { background: true, forceRpc: true }).catch(() => {})
          }
        })
        return
      }

      try {
        let session = await getSupabaseSessionBounded(AUTH_SESSION_BUDGET_MS)
        // 카메라 앱 복귀 직후 in-memory 세션이 비어 있어도 localStorage 리프레시로 복구되는 경우가 많음
        if (!session?.user?.email && typeof window !== 'undefined') {
          const storedAccess = getStoredAccessTokenIfValid(30)
          if (storedAccess) {
            updateSupabaseToken(storedAccess)
          } else {
            const rt = localStorage.getItem('sb-refresh-token')
            if (rt && canAttemptProactiveRefresh()) {
              markProactiveRefreshAttempted()
              session = await refreshSupabaseSessionBounded(rt, AUTH_SESSION_RETRY_MS)
            }
          }
        }
        if (!session?.user?.email) {
          const storedAccess = getStoredAccessTokenIfValid(30)
          if (storedAccess) {
            const hydrated = authUserFromStoredAccessToken()
            if (hydrated?.email) {
              updateSupabaseToken(storedAccess)
              if (userRef.current?.email !== hydrated.email) {
                setUser(hydrated)
                setAuthUser(hydrated)
              }
              if (userRoleRef.current == null) {
                void checkUserRole(hydrated.email)
              }
            }
          }
          return
        }

        const nowSec = Math.floor(Date.now() / 1000)
        const exp = session.expires_at ?? 0
        const skewSec = 300
        let activeSession = session

        if (
          canAttemptProactiveRefresh() &&
          session.refresh_token &&
          (!session.expires_at || exp <= nowSec + skewSec)
        ) {
          markProactiveRefreshAttempted()
          const { session: refreshed, error: refErr } = await coordinatedRefreshSession(supabase, {
            refresh_token: session.refresh_token,
          })
          if (!refErr && refreshed?.user?.email) {
            activeSession = refreshed
          }
        }

        persistSupabaseSessionToStorage(activeSession)
        updateSupabaseToken(activeSession.access_token, {
          refreshToken: activeSession.refresh_token,
        })

        const resumedEmail = activeSession.user.email
        if (!resumedEmail) return

        const prev = userRef.current
        if (prev?.email === resumedEmail) return

        const authUserData = authUserFromSupabaseSessionUser(activeSession.user)
        setUser(authUserData)
        setAuthUser(authUserData)
        void checkUserRole(resumedEmail).catch((err) => {
          console.error('AuthContext: Team check failed on resume:', err)
          const prevRole = userRoleRef.current
          if (prevRole === 'team_member' || prevRole === 'admin' || prevRole === 'manager') {
            // 모바일 복귀 직후 team 조회 타임아웃 등으로 customer로 떨어지면 가이드가 로그인 풀린 것처럼 보임
            setLoading(false)
            setIsInitialized(true)
            return
          }
          setUserRole('customer')
          setUserPosition(null)
          setPermissions(null)
          setLoading(false)
          setIsInitialized(true)
        })
      } catch (e) {
        console.warn('AuthContext: resume session sync failed:', e)
      }
    }

    const onVisibility = () => {
      void resumeSync()
    }
    const onPageShow = (_e: PageTransitionEvent) => {
      // bfcache뿐 아니라 카메라 앱 복귀 등에서도 세션 재동기화 (내부 스로틀 있음)
      void resumeSync()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onVisibility)
    }
  }, [isSimulating, simulatedUser, checkUserRole])

  // 로그아웃 함수
  const signOut = async () => {
    try {
      if (!supabase) {
        console.error('AuthContext: Supabase client not available')
        return
      }
      
      // 시뮬레이션 상태도 함께 초기화
      stopSimulation()
      
      await supabase.auth.signOut()

      roleCheckInflightRef.current.clear()
      clearStoredAuthTokens()
      clearAuthSnapshot()
      resetSupabaseTokenSyncCache()
      
      setUser(null)
      setAuthUser(null)
      setUserRole('customer')
      setUserPosition(null)
      setPermissions(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // 권한 확인 함수
  const hasPermissionCheck = (permission: keyof UserPermissions): boolean => {
    if (!permissions) return false
    return permissions[permission] || false
  }

  // 시뮬레이션 함수들
  const startSimulation = (simulatedUserData: SimulatedUser) => {
    try {
      setSimulatedUser(simulatedUserData)
      setIsSimulating(true)

      localStorage.removeItem('simulationEndTime')
      sessionStorage.removeItem('simulationEndTime')
      document.cookie = 'simulation_end_time=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'

      const persisted = withSimulationBackendMeta(simulatedUserData)
      const persistedStr = JSON.stringify(persisted)
      localStorage.setItem('positionSimulation', persistedStr)
      sessionStorage.setItem('positionSimulation', persistedStr)
      
      // 쿠키에도 시뮬레이션 정보 저장
      document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
      document.cookie = `simulation_user=${encodeURIComponent(persistedStr)}; path=/; max-age=3600; SameSite=Lax`
      
      console.log('Simulation started:', simulatedUserData)
      setLoading(false)
    } catch (error) {
      console.error('시뮬레이션 시작 중 오류:', error)
      setSimulatedUser(null)
      setIsSimulating(false)
    }
  }

  const stopSimulation = () => {
    try {
      console.log('시뮬레이션 중지 시작')
      
      // 상태 초기화
      setSimulatedUser(null)
      setIsSimulating(false)
      
      markSimulationEnded()
      clearSimulationActiveStorage()
      stripSimulationFromAuthSnapshot()
      
      // 전역 이벤트 발생하여 다른 컴포넌트에 알림
      window.dispatchEvent(new CustomEvent('simulationStopped'))
      
      console.log('시뮬레이션 중지 완료')
      setLoading(false)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 강제로 상태 초기화
      setSimulatedUser(null)
      setIsSimulating(false)
      markSimulationEnded()
      clearSimulationActiveStorage()
      stripSimulationFromAuthSnapshot()
      setLoading(false)
    }
  }

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const effectiveUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
  const effectivePermissions = isSimulating && simulatedUser ? {
    canViewAdmin: hasPermission(simulatedUser.role, 'canViewAdmin'),
    canManageProducts: hasPermission(simulatedUser.role, 'canManageProducts'),
    canManageCustomers: hasPermission(simulatedUser.role, 'canManageCustomers'),
    canManageReservations: hasPermission(simulatedUser.role, 'canManageReservations'),
    canManageTours: hasPermission(simulatedUser.role, 'canManageTours'),
    canManageTeam: hasPermission(simulatedUser.role, 'canManageTeam'),
    canViewSchedule: hasPermission(simulatedUser.role, 'canViewSchedule'),
    canManageBookings: hasPermission(simulatedUser.role, 'canManageBookings'),
    canViewAuditLogs: hasPermission(simulatedUser.role, 'canViewAuditLogs'),
    canManageChannels: hasPermission(simulatedUser.role, 'canManageChannels'),
    canManageOptions: hasPermission(simulatedUser.role, 'canManageOptions'),
    canViewFinance: hasPermission(simulatedUser.role, 'canViewFinance'),
  } : permissions

  // getRedirectPath 함수 제거 - 사용자가 직접 메뉴에서 선택하도록 함

  // 팀 채팅 안읽은 메시지 수 가져오기
  const refreshTeamChatUnreadCount = useCallback(async () => {
    if (!user?.email) {
      setTeamChatUnreadCount(0)
      return
    }

    try {
      if (!supabase) {
        console.error('AuthContext: Supabase client not available')
        return
      }
      
      const accessToken = await getAccessTokenForApi(30)
      if (!accessToken) {
        return
      }

      const response = await fetch('/api/team-chat/unread-count', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setTeamChatUnreadCount(result.unreadCount || 0)
      } else {
        if (response.status === 404 && process.env.NODE_ENV === 'development') {
          return
        }
        if (response.status !== 500) {
          console.warn('팀 채팅 안읽은 메시지 수 조회 실패:', response.status, response.statusText)
        }
        // 실패 시에도 0으로 설정하여 UI가 깨지지 않도록
        setTeamChatUnreadCount(0)
      }
    } catch (error) {
      // 네트워크 오류 (ERR_CONNECTION_REFUSED 등)는 조용히 처리
      // 개발 환경에서만 상세 로그 출력
      if (process.env.NODE_ENV === 'development') {
        console.debug('팀 채팅 안읽은 메시지 수 조회 오류 (네트워크 오류일 수 있음):', error)
      }
      // 네트워크 오류 시에도 0으로 설정하여 UI가 깨지지 않도록
      setTeamChatUnreadCount(0)
    }
  }, [user?.email])

  // 사용자가 로그인되어 있을 때만 안읽은 메시지 수 조회 (초기 fetch는 idle 시점으로 지연)
  useEffect(() => {
    if (!(user?.email && userRole && userRole !== 'customer' && isInitialized)) {
      setTeamChatUnreadCount(0)
      return
    }

    const cancelDeferred = scheduleDeferredWork(() => {
      void refreshTeamChatUnreadCount()
    }, 2000)

    if (supabase) {
      const subscription = supabase
        .channel('team-chat-unread')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'team_chat_messages',
          },
          () => {
            void refreshTeamChatUnreadCount()
          }
        )
        .subscribe()

      const interval = setInterval(() => {
        void refreshTeamChatUnreadCount()
      }, 300000)

      return () => {
        cancelDeferred()
        subscription.unsubscribe()
        clearInterval(interval)
      }
    }

    return () => {
      cancelDeferred()
    }
  }, [user?.email, userRole, isInitialized, refreshTeamChatUnreadCount])

  // 토큰 자동 갱신 (30분마다 체크)
  useEffect(() => {
    if (user && !isSimulating) {
      const interval = setInterval(() => {
        void refreshTokenIfNeeded()
      }, 10 * 60 * 1000) // 10분마다 체크 (모바일 백그라운드에서 만료 방지)

      return () => clearInterval(interval)
    }
    
    // 모든 경우에 cleanup 함수 반환 (빈 함수라도)
    return () => {}
  }, [user, isSimulating, refreshTokenIfNeeded])

  const value: AuthContextType = {
    user,
    authUser,
    userRole: effectiveUserRole,
    userPosition: isSimulating && simulatedUser ? simulatedUser.position : userPosition,
    permissions: effectivePermissions,
    loading,
    isInitialized,
    recoverAuthSession,
    signOut,
    hasPermission: hasPermissionCheck,
    teamChatUnreadCount,
    refreshTeamChatUnreadCount,
    simulatedUser,
    startSimulation,
    stopSimulation,
    isSimulating,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Provider 밖이면 `undefined` (가드·경계 컴포넌트용) */
export function useAuthOptional() {
  return useContext(AuthContext)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}