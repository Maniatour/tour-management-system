'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, createClientSupabase } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission } from '@/lib/roles'

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

  // 사용자 역할 및 권한 확인
  const checkUserRole = async (email: string) => {
    if (!email) {
      setUserRole('customer')
      setPermissions(null)
      return
    }

    try {
      // 팀 테이블에서 사용자 정보 조회
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
      if (teamData && teamData.name_ko) {
        setAuthUser(prev => prev ? {
          ...prev,
          name: teamData.name_ko
        } : null)
      }
      
      setUserRole(role)
      setPermissions(userPermissions)
      
      // 세션 정보를 localStorage에 저장 (team 정보 포함)
      if (user) {
        const sessionData = {
          user,
          teamData,
          userRole: role,
          permissions: userPermissions
        }
        localStorage.setItem('auth_session', JSON.stringify(sessionData))
      }
    } catch (error) {
      console.error('Error checking user role:', error)
      setUserRole('customer')
      setPermissions(null)
    }
  }

  useEffect(() => {
    // 초기 사용자 상태 가져오기
    const getInitialUser = async () => {
      try {
        // 먼저 Supabase 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Session check result:', { 
            session: !!session, 
            user: !!session?.user, 
            email: session?.user?.email,
            userMetadata: session?.user?.user_metadata,
            error: sessionError,
            accessToken: session?.access_token ? 'present' : 'missing',
            refreshToken: session?.refresh_token ? 'present' : 'missing',
            expiresAt: session?.expires_at,
            tokenType: session?.token_type
          })
        }
        
        // 세션이 만료되었는지 확인
        if (session?.expires_at) {
          const now = Math.floor(Date.now() / 1000)
          const expiresAt = session.expires_at
          if (process.env.NODE_ENV === 'development') {
            console.log('Token expiry check:', {
              now,
              expiresAt,
              isExpired: now >= expiresAt,
              timeUntilExpiry: expiresAt - now
            })
          }
        }
        
        if (session?.user) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Found active Supabase session:', { 
              email: session.user.email, 
              id: session.user.id 
            })
          }
          
          setUser(session.user)
          
          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.user_metadata?.display_name ||
                  (session.user.email ? session.user.email.split('@')[0] : undefined),
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
          }
          setAuthUser(authUserData)
          
          // 사용자 역할 확인
          if (session.user.email) {
            await checkUserRole(session.user.email)
          }
          
          setLoading(false)
          return
        }
        
        // Supabase가 자동으로 세션을 관리하므로 별도 복원 로직 불필요
        if (process.env.NODE_ENV === 'development') {
          console.log('No active Supabase session, waiting for auth state change...')
        }
        
        // 세션도 localStorage도 없는 경우
        if (process.env.NODE_ENV === 'development') {
          console.log('No session found, setting as customer')
        }
        setUser(null)
        setAuthUser(null)
        setUserRole('customer')
        setPermissions(null)
        setLoading(false)
      } catch (error) {
        console.error('Error in getInitialUser:', error)
        setUser(null)
        setAuthUser(null)
        setUserRole('customer')
        setPermissions(null)
        setLoading(false)
      }
    }

    getInitialUser()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Auth state change:', { event, session: !!session, user: !!session?.user })
        }
        
        try {
          // 로그아웃 이벤트인 경우 즉시 상태 초기화
          if (event === 'SIGNED_OUT') {
            if (process.env.NODE_ENV === 'development') {
              console.log('SIGNED_OUT event, clearing user data')
            }
            setUser(null)
            setAuthUser(null)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
            return
          }

          // 세션이 없고 SIGNED_OUT이 아닌 경우 (INITIAL_SESSION 등)
          if (!session && event !== 'SIGNED_OUT') {
            if (process.env.NODE_ENV === 'development') {
              console.log('No session but not SIGNED_OUT, setting as customer')
            }
            setUser(null)
            setAuthUser(null)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
          }

          // 새로운 세션이 있는 경우
          if (session?.user) {
            if (process.env.NODE_ENV === 'development') {
              console.log('New session found, updating user data')
            }
            setUser(session.user)
            
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 
                    session.user.user_metadata?.full_name || 
                    session.user.user_metadata?.display_name ||
                    (session.user.email ? session.user.email.split('@')[0] : undefined),
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
            }
            setAuthUser(authUserData)
            
            // 사용자 역할 확인
            if (session.user.email) {
              await checkUserRole(session.user.email)
            }
            
            setLoading(false)
          } else {
            // 세션이 없는 경우
            setUser(null)
            setAuthUser(null)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error)
          setUser(null)
          setAuthUser(null)
          setUserRole('customer')
          setPermissions(null)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
    if (!userRole) return `/${locale}/auth/login`
    
    switch (userRole) {
      case 'admin':
      case 'manager':
        return `/${locale}/admin`
      case 'team_member':
        return `/${locale}/admin`
      case 'customer':
      default:
        return `/${locale}/auth/login`
    }
  }

  // AuthContext에서는 리다이렉트 로직을 제거하고 상태만 관리

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