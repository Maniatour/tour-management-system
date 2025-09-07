'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClientSupabase } from '@/lib/supabase'
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

    const supabase = createClientSupabase()
    
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
      }

      setUserRole(role)
      setPermissions(userPermissions)
    } catch (error) {
      console.error('Error checking user role:', error)
      setUserRole('customer')
      setPermissions(null)
    }
  }

  useEffect(() => {
    const supabase = createClientSupabase()

    // 초기 사용자 상태 가져오기
    const getInitialUser = async () => {
      try {
        // 먼저 세션이 있는지 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('AuthContext: Session check result:', { 
          session: !!session, 
          user: !!session?.user, 
          email: session?.user?.email,
          error: sessionError 
        })
        
        if (sessionError) {
          console.error('Error getting session:', sessionError)
          setUser(null)
          setAuthUser(null)
          setUserRole('customer')
          setPermissions(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          
          const authUserData: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
          }
          setAuthUser(authUserData)
          
          // 사용자 역할 확인
          if (session.user.email) {
            await checkUserRole(session.user.email)
          }
        } else {
          setUser(null)
          setAuthUser(null)
          setUserRole('customer')
          setPermissions(null)
        }
      } catch (error) {
        console.error('Error in getInitialUser:', error)
        setUser(null)
        setAuthUser(null)
        setUserRole('customer')
        setPermissions(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialUser()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          // 로그아웃 이벤트인 경우 즉시 상태 초기화
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null)
            setAuthUser(null)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
            return
          }

          // 로그인 이벤트인 경우
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user)
            
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
            }
            setAuthUser(authUserData)
            
            // 사용자 역할 확인
            if (session.user.email) {
              await checkUserRole(session.user.email)
            }
          } else if (session?.user) {
            // 토큰 갱신 등의 경우
            setUser(session.user)
            
            const authUserData: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: session.user.created_at,
            }
            setAuthUser(authUserData)
            
            // 사용자 역할 확인
            if (session.user.email) {
              await checkUserRole(session.user.email)
            }
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
          setUser(null)
          setAuthUser(null)
          setUserRole('customer')
          setPermissions(null)
        } finally {
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
  }

  const getRedirectPath = (locale: string) => {
    if (userRole && userRole !== 'customer') {
      return `/${locale}/admin`
    }
    return `/${locale}`
  }

  const value = {
    user,
    authUser,
    userRole,
    permissions,
    loading,
    signOut,
    hasPermission: (permission: keyof UserPermissions) => {
      if (!userRole) return false
      return hasPermission(userRole, permission)
    },
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
