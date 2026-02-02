import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

// 재시도 로직이 포함된 fetch 함수
const fetchWithRetry = async (
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> => {
  const maxRetries = 3
  const retryDelay = 1000
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 타임아웃 설정 (30초)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      // 헤더를 안전하게 병합
      // Supabase 클라이언트가 설정한 헤더를 보존하면서 필요한 헤더만 추가
      const headers = new Headers(options.headers)
      
      // Connection 헤더가 없으면 추가 (기존 헤더를 덮어쓰지 않음)
      if (!headers.has('Connection')) {
        headers.set('Connection', 'keep-alive')
      }
      
      // Accept 헤더 추가 (406 에러 방지)
      // Supabase PostgREST는 application/json 또는 application/vnd.pgjson.object+json을 지원
      // 기존 Accept 헤더가 있으면 그대로 사용, 없으면 Supabase가 지원하는 모든 형식 포함
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, application/vnd.pgjson.object+json, application/vnd.pgjson.array+json')
      }

      // 기존 signal이 있으면 타임아웃과 함께 사용
      // (실제로는 Supabase가 signal을 전달하지 않으므로 controller.signal 사용)
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        headers: headers
      })

      clearTimeout(timeoutId)

      // 성공적인 응답이거나 재시도할 수 없는 오류인 경우
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408)) {
        return response
      }

      // 서버 오류인 경우 재시도
      if (response.status >= 500 || response.status === 408) {
        throw new Error(`Server error: ${response.status}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 재시도 가능한 오류인지 확인
      const isRetryableError = 
        error instanceof Error && (
          error.name === 'AbortError' ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('ERR_CONNECTION_CLOSED') ||
          error.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT')
        )

      // 마지막 시도이거나 재시도할 수 없는 오류인 경우
      if (attempt === maxRetries || !isRetryableError) {
        throw lastError
      }

      // 지수 백오프로 대기
      const delay = retryDelay * Math.pow(2, attempt)
      console.warn(`Supabase 요청 실패, ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}):`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Unknown error')
}

// 전역 싱글톤 인스턴스 생성 (auth 설정 포함)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: fetchWithRetry
  }
})

// 서버 전용 서비스 롤 클라이언트 (RLS 우회용)
export const supabaseAdmin = typeof window === 'undefined' && supabaseServiceRoleKey
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : undefined

// Supabase 연결 상태 확인 함수
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('team')
      .select('id')
      .limit(1)
      .maybeSingle()
    
    if (error) {
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
