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
        canViewFinance: hasPermission(role, 'canViewFinance'),
      }

      console.log('User role check result:', {
        email,
        teamData,
        role,
        permissions: userPermissions
      })
      
      // team 테이블에서 사용자 이름 업데이트
      if (teamData && teamData.name_ko) {
        setAuthUser(prev => prev ? {
          ...prev,
          name: teamData.name_ko
        } : null)
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
        // 먼저 localStorage에서 세션 정보 확인
        const storedSession = localStorage.getItem('auth_session')
        if (storedSession) {
          try {
            const sessionData = JSON.parse(storedSession)
            console.log('Found stored session data:', { 
              email: sessionData.user?.email, 
              userRole: sessionData.userRole 
            })
            
            if (sessionData.user) {
              setUser(sessionData.user)
              
              const authUserData: AuthUser = {
                id: sessionData.user.id,
                email: sessionData.user.email || '',
                name: sessionData.teamData?.name_ko || 
                      sessionData.user.user_metadata?.name || 
                      sessionData.user.user_metadata?.full_name || 
                      sessionData.user.user_metadata?.display_name ||
                      (sessionData.user.email ? sessionData.user.email.split('@')[0] : undefined),
                avatar_url: sessionData.user.user_metadata?.avatar_url,
                created_at: sessionData.user.created_at,
              }
              setAuthUser(authUserData)
              
              if (sessionData.userRole) {
                setUserRole(sessionData.userRole)
                
                // 권한 설정
                const userPermissions = {
                  canViewAdmin: hasPermission(sessionData.userRole, 'canViewAdmin'),
                  canManageProducts: hasPermission(sessionData.userRole, 'canManageProducts'),
                  canManageCustomers: hasPermission(sessionData.userRole, 'canManageCustomers'),
                  canManageReservations: hasPermission(sessionData.userRole, 'canManageReservations'),
                  canManageTours: hasPermission(sessionData.userRole, 'canManageTours'),
                  canManageTeam: hasPermission(sessionData.userRole, 'canManageTeam'),
                  canViewSchedule: hasPermission(sessionData.userRole, 'canViewSchedule'),
                  canManageBookings: hasPermission(sessionData.userRole, 'canManageBookings'),
                  canViewAuditLogs: hasPermission(sessionData.userRole, 'canViewAuditLogs'),
                  canManageChannels: hasPermission(sessionData.userRole, 'canManageChannels'),
                  canManageOptions: hasPermission(sessionData.userRole, 'canManageOptions'),
                  canViewFinance: hasPermission(sessionData.userRole, 'canViewFinance'),
                }
                setPermissions(userPermissions)
              }
              
              setLoading(false)
              return
            }
          } catch (parseError) {
            console.error('Error parsing stored session:', parseError)
            localStorage.removeItem('auth_session')
          }
        }
        
        // localStorage에 세션이 없으면 Supabase에서 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('AuthContext: Session check result:', { 
          session: !!session, 
          user: !!session?.user, 
          email: session?.user?.email,
          userMetadata: session?.user?.user_metadata,
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
          console.log('Initial session found, setting user data')
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
        } else {
          console.log('No initial session found')
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
        console.log('Auth state change:', { event, session: !!session, user: !!session?.user })
        
        try {
          // 로그아웃 이벤트인 경우 즉시 상태 초기화
          if (event === 'SIGNED_OUT') {
            console.log('SIGNED_OUT event, clearing user data')
            setUser(null)
            setAuthUser(null)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
            return
          }

          // 세션이 없고 SIGNED_OUT이 아닌 경우 (INITIAL_SESSION 등)
          if (!session && event !== 'SIGNED_OUT') {
            console.log('No session but not SIGNED_OUT, checking localStorage...')
            const storedSession = localStorage.getItem('auth_session')
            if (storedSession) {
              try {
                const sessionData = JSON.parse(storedSession)
                console.log('Found stored session on no-session event:', { 
                  email: sessionData.user?.email, 
                  userRole: sessionData.userRole 
                })
                
                if (sessionData.user) {
                  setUser(sessionData.user)
                  
                  const authUserData: AuthUser = {
                    id: sessionData.user.id,
                    email: sessionData.user.email || '',
                    name: sessionData.teamData?.name_ko || 
                          sessionData.user.user_metadata?.name || 
                          sessionData.user.user_metadata?.full_name || 
                          sessionData.user.user_metadata?.display_name ||
                          (sessionData.user.email ? sessionData.user.email.split('@')[0] : undefined),
                    avatar_url: sessionData.user.user_metadata?.avatar_url,
                    created_at: sessionData.user.created_at,
                  }
                  setAuthUser(authUserData)
                  
                  if (sessionData.userRole) {
                    setUserRole(sessionData.userRole)
                    
                    const userPermissions = {
                      canViewAdmin: hasPermission(sessionData.userRole, 'canViewAdmin'),
                      canManageProducts: hasPermission(sessionData.userRole, 'canManageProducts'),
                      canManageCustomers: hasPermission(sessionData.userRole, 'canManageCustomers'),
                      canManageReservations: hasPermission(sessionData.userRole, 'canManageReservations'),
                      canManageTours: hasPermission(sessionData.userRole, 'canManageTours'),
                      canManageTeam: hasPermission(sessionData.userRole, 'canManageTeam'),
                      canViewSchedule: hasPermission(sessionData.userRole, 'canViewSchedule'),
                      canManageBookings: hasPermission(sessionData.userRole, 'canManageBookings'),
                      canViewAuditLogs: hasPermission(sessionData.userRole, 'canViewAuditLogs'),
                      canManageChannels: hasPermission(sessionData.userRole, 'canManageChannels'),
                      canManageOptions: hasPermission(sessionData.userRole, 'canManageOptions'),
                      canViewFinance: hasPermission(sessionData.userRole, 'canViewFinance'),
                    }
                    setPermissions(userPermissions)
                  }
                }
              } catch (parseError) {
                console.error('Error parsing stored session on no-session event:', parseError)
                localStorage.removeItem('auth_session')
              }
            } else {
              console.log('No stored session found, setting to customer')
              setUser(null)
              setAuthUser(null)
              setUserRole('customer')
              setPermissions(null)
            }
            setLoading(false)
            return
          }


          // 로그인 이벤트인 경우
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('SIGNED_IN event detected, setting user data')
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
          } else if (session?.user) {
            // 토큰 갱신 등의 경우
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
    // localStorage에서 세션 정보 제거
    localStorage.removeItem('auth_session')
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
