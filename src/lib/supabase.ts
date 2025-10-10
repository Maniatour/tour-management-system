import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 환경 변수 검증
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
}

// 개발 환경에서만 로그 출력
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length
  })
}

// 기본 Supabase 클라이언트 생성
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Supabase 연결 상태 확인 함수
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('team')
      .select('count')
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Supabase connection check failed:', error)
      return false
    }
    
    console.log('Supabase connection is healthy')
    return true
  } catch (error) {
    console.error('Supabase connection check error:', error)
    return false
  }
}

// 토큰을 동적으로 업데이트하는 함수
export const updateSupabaseToken = (accessToken: string) => {
  if (typeof window !== 'undefined') {
    // Supabase 클라이언트의 auth 헤더 업데이트
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: localStorage.getItem('sb-refresh-token') || ''
    }).catch(error => {
      console.error('Failed to update Supabase token:', error)
    })
  }
}

// 클라이언트 컴포넌트용 Supabase 클라이언트 (같은 인스턴스 사용)
export const createClientSupabase = () => {
  return supabase
}

// createClient 함수도 export (기존 코드 호환성을 위해)
export { createClient }

export type { Database }
