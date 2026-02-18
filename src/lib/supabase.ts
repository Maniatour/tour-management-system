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
    // 호출자의 signal이 이미 abort된 경우 즉시 중단 (컴포넌트 언마운트 등)
    if (options.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const headers = new Headers(options.headers)
      
      if (!headers.has('Connection')) {
        headers.set('Connection', 'keep-alive')
      }
      
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, application/vnd.pgjson.object+json, application/vnd.pgjson.array+json')
      }

      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        headers: headers
      })

      clearTimeout(timeoutId)

      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408)) {
        return response
      }

      if (response.status >= 500 || response.status === 408) {
        throw new Error(`Server error: ${response.status}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 호출자의 signal이 abort된 경우 재시도 없이 즉시 중단
      if (options.signal?.aborted) {
        throw lastError
      }

      const isRetryableError = 
        error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('ERR_CONNECTION_CLOSED') ||
          error.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
          error.message.includes('network') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT')
        )

      // AbortError는 재시도하지 않음 (타임아웃 또는 컴포넌트 언마운트)
      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('aborted')
      )

      if (attempt === maxRetries || !isRetryableError || isAbortError) {
        throw lastError
      }

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
