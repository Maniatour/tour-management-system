'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, updateSupabaseToken } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission } from '@/lib/roles'

interface AuthContextType {
  user: any | null
  authUser: AuthUser | null
  userRole: UserRole | null
  permissions: UserPermissions | null
  loading: boolean
  isInitialized: boolean
  signOut: () => Promise<void>
  hasPermission: (permission: keyof UserPermissions) => boolean
  getRedirectPath: (locale: string) => string
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
  phone: string | null
  language: string | null
  created_at: string
  position: string
  role: UserRole
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [teamChatUnreadCount, setTeamChatUnreadCount] = useState(0)
  
  // 시뮬레이션 상태
  const [simulatedUser, setSimulatedUser] = useState<SimulatedUser | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // 토큰 자동 갱신 함수
  const refreshTokenIfNeeded = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('sb-access-token')
      const refreshToken = localStorage.getItem('sb-refresh-token')
      const expiresAt = localStorage.getItem('sb-expires-at')
      
      if (!accessToken || !refreshToken || !expiresAt) {
        return false
      }
      
      const now = Math.floor(Date.now() / 1000)
      const tokenExpiry = parseInt(expiresAt)
      
      // 토큰이 1시간 이내에 만료되는 경우 갱신
      if (tokenExpiry <= now + 3600) {
        console.log('AuthContext: Token expires soon, attempting refresh')
        
        if (supabase) {
          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
          })
          
          if (data.session && !error) {
            console.log('AuthContext: Token refreshed successfully')
            localStorage.setItem('sb-access-token', data.session.access_token)
            localStorage.setItem('sb-refresh-token', data.session.refresh_token)
            const newExpiry = data.session.expires_at || Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
            localStorage.setItem('sb-expires-at', newExpiry.toString())
            updateSupabaseToken(data.session.access_token)
            return true
          } else {
            console.warn('AuthContext: Token refresh failed:', error)
            return false
          }
        }
      }
      
      return true
    } catch (error) {
      console.warn('AuthContext: Token refresh error:', error)
      return false
    }
  }, [])

  // 사용자 역할 및 권한 확인
  const checkUserRole = useCallback(async (email: string): Promise<void> => {
    if (!email) {
      console.log('AuthContext: No email provided, setting customer role')
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      setIsInitialized(true)
      return
    }

    try {
      console.log('AuthContext: Checking user role for:', email)
      
      if (!supabase) {
        console.error('AuthContext: Supabase client not available')
        setUserRole('customer')
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
        return
      }

      console.log('AuthContext: Querying team table for email:', email)
      
      // 먼저 슈퍼관리자 체크 (team 데이터 없이도 작동)
      const normalizedEmail = email.toLowerCase()
      const superAdminEmails = ['info@maniatour.com', 'wooyong.shim09@gmail.com']
      
      if (superAdminEmails.includes(normalizedEmail)) {
        console.log('AuthContext: Super admin detected, setting admin role')
        setUserRole('admin')
        setPermissions({
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
        })
        setLoading(false)
        setIsInitialized(true)
        return
      }
      
      // 일반 사용자의 경우 team 쿼리 시도
      try {
        const queryPromise = supabase
          .from('team')
          .select('name_ko, email, position, is_active')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle()
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 3000)
        )
        
        const { data: teamData, error } = await Promise.race([queryPromise, timeoutPromise]) as { 
          data: { name_ko: string | null; email: string; position: string | null; is_active: boolean } | null; 
          error: { message?: string; code?: string } | null 
        }

        console.log('AuthContext: Team query result:', { 
          hasData: !!teamData, 
          error: error?.message, 
          errorCode: error?.code,
          teamData: teamData && !error ? { 
            name_ko: (teamData as Record<string, unknown>).name_ko, 
            position: (teamData as Record<string, unknown>).position,
            is_active: (teamData as Record<string, unknown>).is_active 
          } : null,
          rawTeamData: teamData
        })

        if (error && error.code !== 'PGRST116') {
          console.error('AuthContext: Error fetching team data:', error)
        }

        const role = getUserRole(email, teamData && !error ? teamData as Record<string, unknown> : undefined)
        const userPermissions = {
          canViewAdmin: hasPermission(role, 'canViewAdmin'),
          canManageProducts: hasPermission(role, 'canManageProducts'),
          canManageCustomers: hasPermission(role, 'canManageCustomers'),
          canManageReservations: hasPermission(role, 'canManageReservations'),
          canManageTours: hasPermission(role, 'canManageTours'),
          canManageTeam: hasPermission(role, 'canManageTeam'),
          canViewSchedule: hasPermission(role, 'canViewSchedule'),
          canManageBookings: hasPermission(role, 'canManageBookings'),
          canViewAuditLogs: hasPermission(role, 'canViewAuditLogs'),
          canManageChannels: hasPermission(role, 'canManageChannels'),
          canManageOptions: hasPermission(role, 'canManageOptions'),
          canViewFinance: hasPermission(role, 'canViewFinance'),
        }
        
        // team 테이블에서 사용자 이름 업데이트
        if (teamData && !error && (teamData as Record<string, unknown>).name_ko) {
          setAuthUser(prev => prev ? {
            ...prev,
            name: (teamData as Record<string, unknown>).name_ko as string
          } : null)
        }
        
        setUserRole(role)
        setPermissions(userPermissions)
        setLoading(false)
        setIsInitialized(true)
        
        console.log('AuthContext: User role set successfully:', role, 'for user:', email)
      } catch (error) {
        console.warn('AuthContext: Team query failed, using customer role:', error)
        setUserRole('customer')
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
      }
    } catch (error) {
      console.error('AuthContext: Error checking user role:', error)
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      setIsInitialized(true)
    }
  }, [])

  // 시뮬레이션 정보 복원 (가장 먼저 실행)
  useEffect(() => {
    const savedSimulation = localStorage.getItem('positionSimulation')
    if (savedSimulation) {
      try {
        const simulationData = JSON.parse(savedSimulation)
        setSimulatedUser(simulationData)
        setIsSimulating(true)
        setLoading(false) // 시뮬레이션 복원 시 즉시 로딩 완료
        console.log('AuthContext: Simulation restored from localStorage:', simulationData)
        return // 시뮬레이션 복원 시 다른 초기화 건너뛰기
      } catch (error) {
        console.error('AuthContext: Error parsing saved simulation:', error)
        localStorage.removeItem('positionSimulation')
      }
    }
  }, [])

  // 인증 상태 관리 (시뮬레이션이 복원되지 않은 경우에만 실행)
  useEffect(() => {
    // 시뮬레이션이 이미 복원된 경우 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('AuthContext: Simulation already restored, skipping authentication initialization')
      return
    }
    
    console.log('AuthContext: Initializing authentication...')
    
    // localStorage에서 토큰 확인
    const checkStoredTokens = async () => {
      try {
        const accessToken = localStorage.getItem('sb-access-token')
        const expiresAt = localStorage.getItem('sb-expires-at')
        
        if (accessToken && expiresAt) {
          const now = Math.floor(Date.now() / 1000)
          const tokenExpiry = parseInt(expiresAt)
          
          // 토큰이 유효하거나 만료 시간이 1시간 이내인 경우 갱신 시도
          if (tokenExpiry > now || (tokenExpiry > now - 3600)) {
            console.log('AuthContext: Found valid stored token, creating mock session')
            
            // JWT 토큰에서 사용자 정보 추출 (간단한 방법)
            try {
              const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]))
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
                setUser(mockUser)
                
                const authUserData: AuthUser = {
                  id: mockUser.id,
                  email: mockUser.email || '',
                  name: mockUser.user_metadata?.name || 
                        mockUser.user_metadata?.full_name || 
                        mockUser.email?.split('@')[0] || 'User',
                  avatar_url: mockUser.user_metadata?.avatar_url,
                  created_at: mockUser.created_at,
                }
                setAuthUser(authUserData)
                
                console.log('AuthContext: Mock session created, updating Supabase token')
                
                // Supabase 클라이언트에 토큰 설정
                updateSupabaseToken(accessToken)
                
                // 토큰이 곧 만료되는 경우 갱신 시도
                if (tokenExpiry <= now + 3600) {
                  console.log('AuthContext: Token expires soon, attempting refresh')
                  try {
                    const refreshToken = localStorage.getItem('sb-refresh-token')
                    if (refreshToken && supabase) {
                      const { data, error } = await supabase.auth.refreshSession({
                        refresh_token: refreshToken
                      })
                      
                      if (data.session && !error) {
                        console.log('AuthContext: Token refreshed successfully')
                        localStorage.setItem('sb-access-token', data.session.access_token)
                        localStorage.setItem('sb-refresh-token', data.session.refresh_token)
                        // 토큰 만료 시간을 7일로 설정
                        const newExpiry = data.session.expires_at || Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
                        localStorage.setItem('sb-expires-at', newExpiry.toString())
                        updateSupabaseToken(data.session.access_token)
                      } else {
                        console.warn('AuthContext: Token refresh failed:', error)
                      }
                    }
                  } catch (refreshError) {
                    console.warn('AuthContext: Token refresh error:', refreshError)
                  }
                }
                
                checkUserRole(mockUser.email || '').catch(error => {
                  console.error('AuthContext: Team membership check failed:', error)
                  setUserRole('customer')
                  setPermissions(null)
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
      
      // 토큰이 없거나 만료된 경우
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      setIsInitialized(true)
    }
    
    checkStoredTokens().catch(error => {
      console.error('AuthContext: Error in checkStoredTokens:', error)
    })
    
    console.log('AuthContext: Initialization complete, setting up auth listener')

    // 인증 상태 변경 리스너만 설정
    if (!supabase) {
      console.error('AuthContext: Supabase client not available')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        console.log('AuthContext: Auth state change:', { 
          event, 
          session: !!session, 
          user: !!session?.user,
          userEmail: session?.user?.email 
        })
        
        if (event === 'SIGNED_OUT') {
          console.log('AuthContext: User signed out')
          setUser(null)
          setAuthUser(null)
          setUserRole('customer')
          setPermissions(null)
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN' && session?.user?.email) {
          console.log('AuthContext: User signed in, setting user data')
          
          setUser(session.user)
          
          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
          }
          setAuthUser(authUserData)
          
          // team 확인 (비동기로 처리하여 로딩을 차단하지 않음)
          checkUserRole(session.user.email).catch(error => {
            console.error('AuthContext: Team membership check failed:', error)
            setUserRole('customer')
            setPermissions(null)
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.email) {
          console.log('AuthContext: Token refreshed')
          setUser(session.user)
          
          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.email.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
          }
          setAuthUser(authUserData)
        } else if (event === 'INITIAL_SESSION') {
          // 초기 세션 처리
          console.log('AuthContext: INITIAL_SESSION event received')
          if (session?.user?.email) {
            console.log('AuthContext: Initial session found for:', session.user.email)
            setUser(session.user)
            
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || 
                    session.user.user_metadata?.full_name || 
                    session.user.email.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
            }
            setAuthUser(authUserData)
            
            checkUserRole(session.user.email).catch(error => {
              console.error('AuthContext: Team membership check failed:', error)
              setUserRole('customer')
              setPermissions(null)
            })
          } else {
            console.log('AuthContext: No initial session in INITIAL_SESSION event')
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [checkUserRole, isSimulating, simulatedUser])

  // 로그아웃 함수
  const signOut = async () => {
    try {
      if (!supabase) {
        console.error('AuthContext: Supabase client not available')
        return
      }
      
      await supabase.auth.signOut()
      
      // localStorage에서 토큰 제거
      localStorage.removeItem('sb-access-token')
      localStorage.removeItem('sb-refresh-token')
      localStorage.removeItem('sb-expires-at')
      
      setUser(null)
      setAuthUser(null)
      setUserRole('customer')
      setPermissions(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // 권한 확인 함수
  const hasPermissionCheck = (permission: keyof UserPermissions): boolean => {
    const result = permissions ? permissions[permission] || false : false
    console.log('hasPermissionCheck:', { permission, permissions, result })
    return result
  }

  // 시뮬레이션 함수들
  const startSimulation = (simulatedUserData: SimulatedUser) => {
    try {
      setSimulatedUser(simulatedUserData)
      setIsSimulating(true)
      
      localStorage.setItem('positionSimulation', JSON.stringify(simulatedUserData))
      
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
      setSimulatedUser(null)
      setIsSimulating(false)
      localStorage.removeItem('positionSimulation')
      
      console.log('Simulation stopped')
      setLoading(false)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
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

  // 리다이렉트 경로 가져오기
  const getRedirectPath = (locale: string): string => {
    const currentRole = effectiveUserRole
    if (!currentRole) return `/${locale}/auth`
    
    switch (currentRole) {
      case 'admin':
      case 'manager':
        return `/${locale}/admin`
      case 'team_member':
        return `/${locale}/guide`
      case 'customer':
      default:
        return `/${locale}/auth`
    }
  }

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
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/team-chat/unread-count', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setTeamChatUnreadCount(result.unreadCount || 0)
      }
    } catch (error) {
      console.error('팀 채팅 안읽은 메시지 수 조회 오류:', error)
    }
  }, [user?.email])

  // 사용자가 로그인되어 있을 때만 안읽은 메시지 수 조회
  useEffect(() => {
    if (user?.email && userRole && userRole !== 'customer') {
      refreshTeamChatUnreadCount()
      
      // 실시간 구독으로 새 메시지 감지
      if (supabase) {
        const subscription = supabase
          .channel('team-chat-unread')
          .on('postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'team_chat_messages'
            }, 
            () => {
              refreshTeamChatUnreadCount()
            }
          )
          .subscribe()
      
        // 5분마다 안읽은 메시지 수 새로고침
        const interval = setInterval(refreshTeamChatUnreadCount, 300000)
        
        return () => {
          subscription.unsubscribe()
          clearInterval(interval)
        }
      }
    } else {
      setTeamChatUnreadCount(0)
    }
  }, [user?.email, userRole, refreshTeamChatUnreadCount])

  // 토큰 자동 갱신 (30분마다 체크)
  useEffect(() => {
    if (user && !isSimulating) {
      const interval = setInterval(async () => {
        const refreshed = await refreshTokenIfNeeded()
        if (!refreshed) {
          console.warn('AuthContext: Token refresh failed, user may need to re-login')
        }
      }, 30 * 60 * 1000) // 30분마다 체크
      
      return () => clearInterval(interval)
    }
  }, [user, isSimulating, refreshTokenIfNeeded])

  const value: AuthContextType = {
    user,
    authUser,
    userRole: effectiveUserRole,
    permissions: effectivePermissions,
    loading,
    isInitialized,
    signOut,
    hasPermission: hasPermissionCheck,
    getRedirectPath,
    teamChatUnreadCount,
    refreshTeamChatUnreadCount,
    simulatedUser,
    startSimulation,
    stopSimulation,
    isSimulating,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}