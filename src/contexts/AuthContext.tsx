'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission } from '@/lib/roles'

interface TeamData {
  name_ko?: string
  email: string
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  authUser: AuthUser | null
  userRole: UserRole | null
  permissions: UserPermissions | null
  loading: boolean
  signOut: () => Promise<void>
  hasPermission: (permission: keyof UserPermissions) => boolean
  getRedirectPath: (locale: string) => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  // team 멤버십 확인
  const checkTeamMembership = useCallback(async (email: string) => {
    if (!email) return

    try {
      console.log('AuthContext: Checking team membership for:', email)
      
      const { data: teamData, error } = await supabase
        .from('team')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error || !teamData) {
        console.log('AuthContext: Not a team member')
        setUserRole('customer')
        setPermissions(null)
        setLoading(false) // team 확인 완료 후 로딩 해제
        return
      }

      console.log('AuthContext: Team member found:', (teamData as TeamData).name_ko)
      
      // team 멤버인 경우 역할 확인
      await checkUserRole(email)
      setLoading(false) // team 확인 완료 후 로딩 해제
    } catch (error) {
      console.error('AuthContext: Team check failed:', error)
      setUserRole('customer')
      setPermissions(null)
      setLoading(false) // 에러 발생 시에도 로딩 해제
    }
  }, [])

  // 사용자 역할 및 권한 확인
  const checkUserRole = async (email: string) => {
    if (!email) {
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      return
    }

    try {
      const { data: teamData, error } = await supabase
        .from('team')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching team data:', error)
      }

      const role = getUserRole(email, teamData)
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
      if (teamData && (teamData as TeamData).name_ko) {
        setAuthUser(prev => prev ? {
          ...prev,
          name: (teamData as TeamData).name_ko
        } : null)
      }
      
      setUserRole(role)
      setPermissions(userPermissions)
      setLoading(false)
      
      console.log('AuthContext: User role set:', role)
    } catch (error) {
      console.error('Error checking user role:', error)
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('AuthContext: Initializing...')
    setLoading(true)
    
    // localStorage에서 토큰 확인 (콜백 페이지에서 저장된 토큰)
    const checkStoredTokens = async () => {
      if (typeof window !== 'undefined') {
        try {
          const storedTokens = localStorage.getItem('auth_tokens')
          console.log('AuthContext: Checking stored tokens:', !!storedTokens)
          
          if (storedTokens) {
            const tokens = JSON.parse(storedTokens)
            const { access_token, refresh_token, timestamp } = tokens
            
            // 토큰이 1시간 이내인지 확인
            if (access_token && (Date.now() - timestamp) < 3600000) {
              console.log('AuthContext: Found valid stored tokens, parsing JWT directly')
              try {
                // JWT 토큰에서 직접 사용자 정보 추출
                const tokenParts = access_token.split('.')
                if (tokenParts.length === 3) {
                  const payload = JSON.parse(atob(tokenParts[1]))
                  console.log('AuthContext: JWT payload:', payload)
                  
                  if (payload.email) {
                    console.log('AuthContext: Creating user from JWT payload:', payload.email)
                    
                    // JWT에서 사용자 정보 생성
                    const user: User = {
                      id: payload.sub,
                      email: payload.email,
                      user_metadata: {
                        name: payload.name || payload.full_name,
                        avatar_url: payload.avatar_url || payload.picture,
                        provider: 'google'
                      },
                      app_metadata: {},
                      created_at: new Date(payload.iat * 1000).toISOString(),
                      aud: payload.aud,
                      role: payload.role
                    }
                    
                    console.log('AuthContext: User created from JWT:', user.email)
                    setUser(user)
                    
                    const authUserData: AuthUser = {
                      id: user.id,
                      email: user.email ?? '',
                      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
                      avatar_url: user.user_metadata?.avatar_url || undefined,
                      created_at: user.created_at,
                    }
                    setAuthUser(authUserData)
                    
                    // 성공 시 저장된 토큰 삭제
                    localStorage.removeItem('auth_tokens')
                    
                    // team 확인
                    if (user.email) {
                      checkTeamMembership(user.email)
                    }
                    
                    // 백그라운드에서 세션 설정 시도
                    setTimeout(async () => {
                      try {
                        console.log('AuthContext: Attempting background session setup')
                        const { error } = await supabase.auth.setSession({
                          access_token: access_token,
                          refresh_token: refresh_token || ''
                        })
                        if (error) {
                          console.log('AuthContext: Background session setup failed:', error.message)
                        } else {
                          console.log('AuthContext: Background session setup successful')
                        }
                      } catch (error) {
                        console.log('AuthContext: Background session setup error:', error)
                      }
                    }, 1000)
                  } else {
                    console.log('AuthContext: No email in JWT payload')
                    localStorage.removeItem('auth_tokens')
                  }
                } else {
                  console.log('AuthContext: Invalid JWT token format')
                  localStorage.removeItem('auth_tokens')
                }
              } catch (error) {
                console.error('AuthContext: JWT parsing error:', error)
                localStorage.removeItem('auth_tokens')
              }
            } else {
              console.log('AuthContext: Stored tokens expired or invalid, removing')
              localStorage.removeItem('auth_tokens')
            }
          }
        } catch (error) {
          console.error('AuthContext: Error checking stored tokens:', error)
          localStorage.removeItem('auth_tokens')
        }
      }
    }
    
    // 저장된 토큰 확인
    checkStoredTokens()

    // 현재 세션 확인
    const checkCurrentSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('AuthContext: Error getting session:', error)
          setLoading(false)
          return
        }

        if (session?.user?.email) {
          console.log('AuthContext: Found existing session for:', session.user.email)
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
          
          // team 확인
          checkTeamMembership(session.user.email)
        } else {
          console.log('AuthContext: No existing session')
          setLoading(false)
        }
      } catch (error) {
        console.error('AuthContext: Error checking session:', error)
        setLoading(false)
      }
    }

    // 현재 세션 확인
    checkCurrentSession()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', { event, session: !!session, user: !!session?.user })
        
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
          
          // team 확인
          checkTeamMembership(session.user.email)
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
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [checkTeamMembership])

  // 로그아웃 함수
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
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
    if (!permissions) return false
    return permissions[permission] || false
  }

  // 리다이렉트 경로 가져오기
  const getRedirectPath = (locale: string): string => {
    if (!userRole) return `/${locale}/auth`
    
    switch (userRole) {
      case 'admin':
      case 'manager':
        return `/${locale}/admin`
      case 'team_member':
        return `/${locale}/admin`
      case 'customer':
      default:
        return `/${locale}/auth`
    }
  }

  const value: AuthContextType = {
    user,
    authUser,
    userRole,
    permissions,
    loading,
    signOut,
    hasPermission: hasPermissionCheck,
    getRedirectPath,
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