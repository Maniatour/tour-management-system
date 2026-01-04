'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, updateSupabaseToken } from '@/lib/supabase'
import { AuthUser } from '@/lib/auth'
import { UserRole, getUserRole, UserPermissions, hasPermission } from '@/lib/roles'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthContextType {
  user: AuthUser | null
  authUser: AuthUser | null
  userRole: UserRole | null
  userPosition: string | null
  permissions: UserPermissions | null
  loading: boolean
  isInitialized: boolean
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userPosition, setUserPosition] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [teamChatUnreadCount, setTeamChatUnreadCount] = useState(0)
  
  // 시뮬레이션 상태 (SSR 호환성을 위해 초기값은 null/false로 설정)
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
      setUserPosition(null)
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
        setUserPosition(null)
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
        setUserPosition(null) // 슈퍼관리자는 position 없음
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
          rawTeamData: teamData,
          email: email
        })

        if (error && error.code !== 'PGRST116') {
          console.error('AuthContext: Error fetching team data:', error)
        }

        const role = getUserRole(email, teamData && !error ? teamData as Record<string, unknown> : undefined)
        const position = teamData && !error ? (teamData as Record<string, unknown>).position as string | null : null
        
        // position 저장
        setUserPosition(position)
        
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
        setUserPosition(null)
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
      }
    } catch (error) {
      console.error('AuthContext: Error checking user role:', error)
      setUserRole('customer')
      setUserPosition(null)
      setPermissions(null)
      setLoading(false)
      setIsInitialized(true)
    }
  }, [])

  // 시뮬레이션 정보 복원 (클라이언트에서만 실행, SSR 호환성)
  useEffect(() => {
    // 클라이언트에서만 실행
    if (typeof window === 'undefined') {
      return
    }
    
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
    
    // localStorage에서 시뮬레이션 정보 확인
    let simulationData = null
    const savedSimulation = localStorage.getItem('positionSimulation')
    const simulationEndTime = localStorage.getItem('simulationEndTime')
    
    // 시뮬레이션 종료 시점이 있으면 복원하지 않음 (더 엄격하게 체크)
    if (simulationEndTime) {
      const endTime = parseInt(simulationEndTime, 10)
      const now = Date.now()
      // 종료 시점이 1시간 이내면 복원하지 않음 (더 엄격한 정책)
      if (!isNaN(endTime) && (now - endTime) < 3600000) {
        console.log('AuthContext: Simulation was ended recently, not restoring:', simulationEndTime)
        // 종료 시점 기록은 유지 (다음 새로고침에서도 차단)
        return
      } else {
        // 1시간 이상 지났으면 종료 시점 기록 정리
        localStorage.removeItem('simulationEndTime')
        sessionStorage.removeItem('simulationEndTime')
      }
    }
    
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
      const sessionEndTime = sessionStorage.getItem('simulationEndTime')
      
      // sessionStorage에서도 종료 시점이 있으면 복원하지 않음 (더 엄격하게 체크)
      if (sessionEndTime) {
        const endTime = parseInt(sessionEndTime, 10)
        const now = Date.now()
        if (!isNaN(endTime) && (now - endTime) < 3600000) {
          console.log('AuthContext: Simulation was ended recently in session, not restoring:', sessionEndTime)
          return
        } else {
          sessionStorage.removeItem('simulationEndTime')
        }
      }
      
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
      const simulationEndCookie = cookies.find(cookie => cookie.trim().startsWith('simulation_end_time='))
      
      // 쿠키에서도 종료 시점이 있으면 복원하지 않음 (더 엄격하게 체크)
      if (simulationEndCookie) {
        const cookieValue = simulationEndCookie.split('=')[1]
        const endTime = parseInt(cookieValue, 10)
        const now = Date.now()
        if (!isNaN(endTime) && (now - endTime) < 3600000) {
          console.log('AuthContext: Simulation was ended recently in cookies, not restoring')
          return
        } else {
          // 1시간 이상 지났으면 쿠키 정리
          const cookiePaths = ['/', '/ko', '/en']
          cookiePaths.forEach(path => {
            document.cookie = `simulation_end_time=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          })
        }
      }
      
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
      // 시뮬레이션 데이터 유효성 검사
      if (simulationData.email && simulationData.role) {
        console.log('AuthContext: Valid simulation data found, restoring...', simulationData)
        
        // 상태 설정 (동기적으로 즉시 설정)
        setSimulatedUser(simulationData)
        setIsSimulating(true)
        setLoading(false) // 시뮬레이션 복원 시 즉시 로딩 완료
        setIsInitialized(true) // 시뮬레이션 복원 시 초기화 완료
        
        console.log('AuthContext: Simulation restored successfully:', simulationData)
        
        // 언어 전환 시 시뮬레이션 상태가 보존되었음을 확인
        console.log('AuthContext: Simulation state preserved during language switch')
        
        // 추가 안전장치: 시뮬레이션 상태를 다시 한 번 저장하여 지속성 보장
        localStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        sessionStorage.setItem('positionSimulation', JSON.stringify(simulationData))
        document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
        document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulationData))}; path=/; max-age=3600; SameSite=Lax`
        
        // 시뮬레이션 상태가 복원되었음을 전역적으로 알림
        window.dispatchEvent(new CustomEvent('simulationRestored', { detail: simulationData }))
        
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
        localStorage.setItem('positionSimulation', JSON.stringify(simulatedUser))
        sessionStorage.setItem('positionSimulation', JSON.stringify(simulatedUser))
        document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
        document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulatedUser))}; path=/; max-age=3600; SameSite=Lax`
      } else {
        // 저장된 데이터가 현재 상태와 다른지 확인
        try {
          const parsedSaved = JSON.parse(savedSimulation)
          if (parsedSaved.email !== simulatedUser.email) {
            // 시뮬레이션 데이터 불일치 시 조용히 업데이트 (로그 레벨을 낮춤)
            console.debug('AuthContext: Simulation data mismatch, updating...')
            localStorage.setItem('positionSimulation', JSON.stringify(simulatedUser))
            sessionStorage.setItem('positionSimulation', JSON.stringify(simulatedUser))
            document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulatedUser))}; path=/; max-age=3600; SameSite=Lax`
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
    
    console.log('AuthContext: Initializing authentication...')
    
    // localStorage에서 토큰 확인
    const checkStoredTokens = async () => {
      try {
        const accessToken = localStorage.getItem('sb-access-token')
        const expiresAt = localStorage.getItem('sb-expires-at')
        
        console.log('AuthContext: Checking stored tokens:', {
          hasAccessToken: !!accessToken,
          hasExpiresAt: !!expiresAt,
          expiresAt: expiresAt ? new Date(parseInt(expiresAt) * 1000).toISOString() : 'N/A'
        })
        
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
                  setUserPosition(null)
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
      
      // 토큰이 없거나 만료된 경우 - Supabase 세션 확인
      console.log('AuthContext: No valid token found, checking Supabase session...')
      
      // Supabase에서 현재 세션 확인
      if (supabase) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (session && !error) {
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
            
            // 토큰을 localStorage에 저장
            localStorage.setItem('sb-access-token', session.access_token)
            localStorage.setItem('sb-refresh-token', session.refresh_token)
            const tokenExpiry = session.expires_at || Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
            localStorage.setItem('sb-expires-at', tokenExpiry.toString())
            
            // Supabase 클라이언트에 토큰 설정
            updateSupabaseToken(session.access_token)
            
            // 사용자 역할 확인
            if (session.user.email) {
              checkUserRole(session.user.email).catch(error => {
                console.error('AuthContext: Team membership check failed:', error)
                setUserRole('customer')
                setUserPosition(null)
                setPermissions(null)
              })
            } else {
              console.error('AuthContext: No email in session user')
              setUserRole('customer')
              setUserPosition(null)
              setPermissions(null)
            }
            return
          } else {
            console.log('AuthContext: No Supabase session found:', error?.message)
          }
        } catch (sessionError) {
          console.error('AuthContext: Error getting Supabase session:', sessionError)
        }
      }
      
      // 짧은 지연 후 다시 한 번 확인 (토큰 복원 시간 제공)
      setTimeout(() => {
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
                
                checkUserRole(mockUser.email || '').catch(error => {
                  console.error('AuthContext: Team membership check failed:', error)
                  setUserRole('customer')
                  setUserPosition(null)
                  setPermissions(null)
                })
                return
              }
            } catch (tokenError) {
              console.error('AuthContext: Error parsing delayed token:', tokenError)
            }
          }
        }
        
        // 여전히 토큰이 없으면 customer로 설정
        console.log('AuthContext: No token found after delay, setting customer role')
        setUserRole('customer')
        setUserPosition(null)
        setPermissions(null)
        setLoading(false)
        setIsInitialized(true)
      }, 200) // 200ms 지연으로 증가
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
      async (event: AuthChangeEvent, session: Session | null) => {
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
          setUserPosition(null)
          setPermissions(null)
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN' && session?.user?.email) {
          console.log('AuthContext: User signed in, setting user data')
          
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
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user?.email) {
          console.log('AuthContext: Token refreshed')
          
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
        } else if (event === 'INITIAL_SESSION') {
          // 초기 세션 처리
          console.log('AuthContext: INITIAL_SESSION event received')
          if (session?.user?.email) {
            console.log('AuthContext: Initial session found for:', session.user.email)
            
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
      
      // 시뮬레이션 상태도 함께 초기화
      stopSimulation()
      
      await supabase.auth.signOut()
      
      // localStorage에서 토큰 제거
      localStorage.removeItem('sb-access-token')
      localStorage.removeItem('sb-refresh-token')
      localStorage.removeItem('sb-expires-at')
      
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
      
      localStorage.setItem('positionSimulation', JSON.stringify(simulatedUserData))
      
      // sessionStorage에도 백업 저장
      sessionStorage.setItem('positionSimulation', JSON.stringify(simulatedUserData))
      
      // 쿠키에도 시뮬레이션 정보 저장
      document.cookie = `simulation_active=true; path=/; max-age=3600; SameSite=Lax`
      document.cookie = `simulation_user=${encodeURIComponent(JSON.stringify(simulatedUserData))}; path=/; max-age=3600; SameSite=Lax`
      
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
      
      // 시뮬레이션 종료 시점 기록 (더 긴 만료 시간으로 설정하여 확실히 차단)
      const endTime = Date.now()
      localStorage.setItem('simulationEndTime', endTime.toString())
      sessionStorage.setItem('simulationEndTime', endTime.toString())
      document.cookie = `simulation_end_time=${endTime}; path=/; max-age=86400; SameSite=Lax` // 24시간
      
      // 로컬 스토리지 정리 (모든 가능한 키 제거)
      localStorage.removeItem('positionSimulation')
      sessionStorage.removeItem('positionSimulation')
      localStorage.removeItem('simulation_active')
      sessionStorage.removeItem('simulation_active')
      
      // 쿠키도 정리 (모든 경로에서)
      const cookiePaths = ['/', '/ko', '/en']
      cookiePaths.forEach(path => {
        document.cookie = `simulation_active=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        document.cookie = `simulation_user=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        document.cookie = `simulation_end_time=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      })
      
      // 전역 이벤트 발생하여 다른 컴포넌트에 알림
      window.dispatchEvent(new CustomEvent('simulationStopped'))
      
      console.log('시뮬레이션 중지 완료')
      setLoading(false)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 강제로 상태 초기화
      setSimulatedUser(null)
      setIsSimulating(false)
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
      } else {
        // 응답이 실패한 경우 (401, 500 등)
        // 네트워크 오류가 아닌 경우에만 콘솔에 기록
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
    
    // 모든 경우에 cleanup 함수 반환 (빈 함수라도)
    return () => {}
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}