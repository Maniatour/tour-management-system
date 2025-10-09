'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import { detectGuidePreferredLanguage, SupportedLocale } from '@/lib/guideLanguageDetection'

interface TeamData {
  name_ko?: string
  email: string
  is_active: boolean
  position?: string
  languages?: string[] | null
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
  teamChatUnreadCount: number
  refreshTeamChatUnreadCount: () => Promise<void>
  preventAutoRedirect?: boolean
  // 시뮬레이션 관련
  simulatedUser: SimulatedUser | null
  startSimulation: (user: SimulatedUser) => void
  stopSimulation: () => void
  isSimulating: boolean
}

interface SimulatedUser {
  email: string
  name_ko: string
  position: string
  role: UserRole
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamChatUnreadCount, setTeamChatUnreadCount] = useState(0)
  
  // 시뮬레이션 상태
  const [simulatedUser, setSimulatedUser] = useState<SimulatedUser | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // 가이드 언어 탐지 및 리다이렉트 함수
  const getGuidePreferredLanguage = useCallback(async (email: string): Promise<SupportedLocale> => {
    try {
      console.log(`[AuthContext] Getting preferred language for guide: ${email}`)
      
      const { data: teamData, error } = await supabase
        .from('team')
        .select('languages')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error(`[AuthContext] Error fetching team data for ${email}:`, error)
        return 'ko' // 기본값
      }

      if (!teamData) {
        console.log(`[AuthContext] No team data found for ${email}`)
        return 'ko' // 기본값
      }

      const preferredLocale = detectGuidePreferredLanguage(teamData, email)
      console.log(`[AuthContext] Guide ${email} preferred language: ${preferredLocale}`)
      
      return preferredLocale
    } catch (error) {
      console.error(`[AuthContext] Error detecting guide language for ${email}:`, error)
      return 'ko' // 기본값
    }
  }, [])

  // 가이드 리다이렉트 함수
  const redirectGuideToPreferredLanguage = useCallback(async (email: string) => {
    try {
      console.log('AuthContext: Starting guide redirect process for:', email)
      
      const preferredLanguage = await getGuidePreferredLanguage(email)
      console.log('AuthContext: Guide preferred language:', preferredLanguage)
      
      // 현재 경로에서 locale 추출
      const currentPath = window.location.pathname
      const currentLocaleMatch = currentPath.match(/^\/([a-z]{2})/)
      const currentLocale = currentLocaleMatch ? currentLocaleMatch[1] : 'ko'
      
      console.log('AuthContext: Current locale:', currentLocale, 'Preferred:', preferredLanguage)
      
      // 이미 선호 언어 페이지에 있다면 리다이렉트하지 않음
      if (currentLocale === preferredLanguage) {
        console.log('AuthContext: Already on preferred language page, no redirect needed')
        return
      }
      
      // 가이드 페이지로 리다이렉트
      const targetPath = `/${preferredLanguage}/guide`
      console.log('AuthContext: Redirecting guide to:', targetPath)
      
      // 리다이렉트 전에 약간의 지연을 두어 상태가 안정화되도록 함
      setTimeout(() => {
        try {
          router.push(targetPath)
        } catch (error) {
          console.error('AuthContext: Error during router.push:', error)
        }
      }, 100)
      
    } catch (error) {
      console.error('AuthContext: Error in guide redirect process:', error)
      // 에러 발생 시 기본 가이드 페이지로 리다이렉트
      try {
        const currentPath = window.location.pathname
        const currentLocaleMatch = currentPath.match(/^\/([a-z]{2})/)
        const currentLocale = currentLocaleMatch ? currentLocaleMatch[1] : 'ko'
        router.push(`/${currentLocale}/guide`)
      } catch (fallbackError) {
        console.error('AuthContext: Fallback redirect also failed:', fallbackError)
      }
    }
  }, [getGuidePreferredLanguage, router])

  // 사용자 역할 및 권한 확인
  const checkUserRole = useCallback(async (email: string, timeoutId?: NodeJS.Timeout) => {
    if (!email) {
      console.log('AuthContext: No email provided, setting customer role')
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      if (timeoutId) clearTimeout(timeoutId)
      return
    }

    try {
      console.log('AuthContext: Checking user role for:', email)
      
      const { data: teamData, error } = await supabase
        .from('team')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('AuthContext: Error fetching team data:', error)
        // 에러가 발생해도 기본 역할로 설정하고 계속 진행
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
      if (timeoutId) clearTimeout(timeoutId)
      
      console.log('AuthContext: User role set successfully:', role, 'for user:', email)
      
      // 가이드인 경우 선호 언어로 리다이렉트 (안전하게 처리)
      if (role === 'team_member' && teamData) {
        const position = (teamData as TeamData).position?.toLowerCase() || ''
        if (position.includes('guide') || position.includes('tour guide') || position.includes('tourguide')) {
          console.log('AuthContext: Guide detected, scheduling language redirect')
          // 더 긴 지연을 두어 다른 리다이렉트와 충돌하지 않도록 함
          setTimeout(() => {
            try {
              redirectGuideToPreferredLanguage(email)
            } catch (error) {
              console.error('AuthContext: Error in guide redirect:', error)
            }
          }, 1000)
        }
      }
    } catch (error) {
      console.error('AuthContext: Error checking user role:', error)
      // 에러 발생 시에도 기본 역할로 설정하고 로딩 해제
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [redirectGuideToPreferredLanguage])

  // team 멤버십 확인
  const checkTeamMembership = useCallback(async (email: string, timeoutId?: NodeJS.Timeout) => {
    if (!email) {
      console.log('AuthContext: No email provided for team check')
      setUserRole('customer')
      setPermissions(null)
      setLoading(false)
      if (timeoutId) clearTimeout(timeoutId)
      return
    }

    try {
      console.log('AuthContext: Checking team membership for:', email)
      
      const { data: teamData, error } = await supabase
        .from('team')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error || !teamData) {
        console.log('AuthContext: Not a team member or error occurred:', error?.message || 'No data')
        setUserRole('customer')
        setPermissions(null)
        setLoading(false) // team 확인 완료 후 로딩 해제
        if (timeoutId) clearTimeout(timeoutId)
        return
      }

      console.log('AuthContext: Team member found:', (teamData as TeamData).name_ko)
      
      // team 멤버인 경우 역할 확인
      await checkUserRole(email, timeoutId)
      // checkUserRole에서 이미 setLoading(false)를 호출하므로 여기서는 호출하지 않음
    } catch (error) {
      console.error('AuthContext: Team check failed:', error)
      setUserRole('customer')
      setPermissions(null)
      setLoading(false) // 에러 발생 시에도 로딩 해제
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [checkUserRole])

  // 시뮬레이션 정보 복원 (한 번만 실행)
  useEffect(() => {
    const savedSimulation = localStorage.getItem('positionSimulation')
    if (savedSimulation) {
      try {
        const simulationData = JSON.parse(savedSimulation)
        setSimulatedUser(simulationData)
        setIsSimulating(true)
        console.log('AuthContext: Simulation restored from localStorage:', simulationData)
      } catch (error) {
        console.error('AuthContext: Error parsing saved simulation:', error)
        localStorage.removeItem('positionSimulation')
      }
    }
  }, []) // 빈 의존성 배열로 한 번만 실행

  useEffect(() => {
    console.log('AuthContext: Initializing...')
    setLoading(true)
    
    // 타임아웃 설정 (15초 후 강제로 로딩 해제 - 더 여유있게 설정)
    const timeoutId = setTimeout(() => {
      console.warn('AuthContext: Initialization timeout, forcing loading to false')
      setLoading(false)
      setUserRole('customer')
      setPermissions(null)
    }, 15000)
    
    // 현재 세션 확인
    const checkCurrentSession = async () => {
      try {
        console.log('AuthContext: Checking current session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('AuthContext: Error getting session:', error)
          clearTimeout(timeoutId)
          setLoading(false)
          setUserRole('customer')
          setPermissions(null)
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
          
          // team 확인 (타임아웃 ID 전달)
          await checkTeamMembership(session.user.email, timeoutId)
        } else {
          console.log('AuthContext: No existing session')
          clearTimeout(timeoutId)
          setLoading(false)
          setUserRole('customer')
          setPermissions(null)
        }
      } catch (error) {
        console.error('AuthContext: Error checking session:', error)
        clearTimeout(timeoutId)
        setLoading(false)
        setUserRole('customer')
        setPermissions(null)
      }
    }

    // 현재 세션 확인
    checkCurrentSession()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state change:', { event, session: !!session, user: !!session?.user })
        
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
          
          // team 확인 (타임아웃 없이)
          try {
            await checkTeamMembership(session.user.email)
          } catch (error) {
            console.error('AuthContext: Error in team membership check after sign in:', error)
            setUserRole('customer')
            setPermissions(null)
            setLoading(false)
          }
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

  // 시뮬레이션 함수들
  const startSimulation = (simulatedUserData: SimulatedUser) => {
    setSimulatedUser(simulatedUserData)
    setIsSimulating(true)
    
    // localStorage에 시뮬레이션 정보 저장
    localStorage.setItem('positionSimulation', JSON.stringify(simulatedUserData))
    
    console.log('Simulation started:', simulatedUserData)
    
    // tour guide를 시뮬레이션할 때 가이드 대시보드로 이동
    if (simulatedUserData.position.toLowerCase().includes('guide')) {
      // 현재 locale을 가져와서 가이드 대시보드로 이동
      const currentPath = window.location.pathname
      const localeMatch = currentPath.match(/^\/([a-z]{2})/)
      const locale = localeMatch ? localeMatch[1] : 'ko'
      router.push(`/${locale}/guide`)
    }
  }

  const stopSimulation = () => {
    setSimulatedUser(null)
    setIsSimulating(false)
    localStorage.removeItem('positionSimulation')
    
    console.log('Simulation stopped')
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
        // 관리자, 매니저, 슈퍼관리자 등은 admin 페이지로
        return `/${locale}/admin`
      case 'team_member':
        // 투어 가이드만 guide 페이지로 리다이렉트
        return `/${locale}/guide`
      case 'customer':
      default:
        // 일반 고객은 로그인 페이지로
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
      const subscription = supabase
        .channel('team-chat-unread')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'team_chat_messages'
          }, 
          () => {
            // 새 메시지가 올 때만 카운트 새로고침
            refreshTeamChatUnreadCount()
          }
        )
        .subscribe()
      
      // 5분마다 안읽은 메시지 수 새로고침 (폴백용)
      const interval = setInterval(refreshTeamChatUnreadCount, 300000)
      
      return () => {
        subscription.unsubscribe()
        clearInterval(interval)
      }
    } else {
      setTeamChatUnreadCount(0)
    }
  }, [user?.email, userRole, refreshTeamChatUnreadCount])

  const value: AuthContextType = {
    user,
    authUser,
    userRole: effectiveUserRole,
    permissions: effectivePermissions,
    loading,
    signOut,
    hasPermission: hasPermissionCheck,
    getRedirectPath,
    teamChatUnreadCount,
    refreshTeamChatUnreadCount,
    // 시뮬레이션 관련
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