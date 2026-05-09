import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export { isAbortLikeError } from './isAbortLikeError'

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

/** 브라우저가 동시에 수백 개 REST 요청을 열면 net::ERR_INSUFFICIENT_RESOURCES 발생 — 전역으로 동시 실행 제한 */
const supabaseOutboundMaxConcurrent = typeof window === 'undefined' ? 14 : 6
let supabaseOutboundActive = 0
const supabaseOutboundWaiters: Array<() => void> = []

function acquireSupabaseOutboundSlot(): Promise<void> {
  if (supabaseOutboundActive < supabaseOutboundMaxConcurrent) {
    supabaseOutboundActive += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    supabaseOutboundWaiters.push(() => {
      supabaseOutboundActive += 1
      resolve()
    })
  })
}

function releaseSupabaseOutboundSlot(): void {
  supabaseOutboundActive = Math.max(0, supabaseOutboundActive - 1)
  const next = supabaseOutboundWaiters.shift()
  if (next) next()
}

async function runSupabaseOutboundBounded<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSupabaseOutboundSlot()
  try {
    return await fn()
  } finally {
    releaseSupabaseOutboundSlot()
  }
}

function isInsufficientResourcesError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const m = e.message
  return (
    m.includes('INSUFFICIENT_RESOURCES') ||
    m.includes('Insufficient resources') ||
    m.includes('ERR_INSUFFICIENT_RESOURCES')
  )
}

function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input instanceof Request) return input.url
  return String(input)
}

/** Storage 업로드·다운로드는 대용량이라 짧은 fetch 타임아웃이면 `signal is aborted` 로 실패한다. */
function getSupabaseFetchTimeoutMs(url: RequestInfo | URL): number {
  const href = requestUrlString(url)
  if (href.includes('/storage/v1/')) {
    return 60 * 60 * 1000 // 1시간 (예: 100MB 느린 회선)
  }
  return typeof window === 'undefined' ? 60000 : 30000
}

// 재시도 로직이 포함된 fetch 함수
const fetchWithRetry = async (
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> => {
  const maxRetries = 3
  const retryDelay = 1000
  let lastError: Error | null = null

  // Supabase가 넘기는 AbortSignal은 세션 갱신·내부 요청 정리 등으로 조기 abort되어
  // 정상적인 REST 조회도 전부 AbortError로 끝나는 경우가 있다. fetch에는 사용하지 않고
  // 여기서만 타임아웃(AbortController)을 건다.
  const { signal: _supabaseSignal, ...restOptions } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers = new Headers(restOptions.headers)

      if (!headers.has('Connection')) {
        headers.set('Connection', 'keep-alive')
      }

      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, application/vnd.pgjson.object+json, application/vnd.pgjson.array+json')
      }

      // 타임아웃은 동시 요청 슬롯을 얻은 뒤에만 시작한다. 그렇지 않으면 대기 큐에서
      // 시간이 소모되어 업로드가 곧바로 abort 될 수 있다.
      const response = await runSupabaseOutboundBounded(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          getSupabaseFetchTimeoutMs(url)
        )
        try {
          return await fetch(url, {
            ...restOptions,
            signal: controller.signal,
            headers: headers
          })
        } finally {
          clearTimeout(timeoutId)
        }
      })

      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408)) {
        return response
      }

      if (response.status >= 500 || response.status === 408) {
        throw new Error(`Server error: ${response.status}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      /** fetch 직후 던진 `Server error: 408|5xx` — Supabase/프록시 일시 504 등은 재시도 */
      const isRetryableGatewayOrServerStatus =
        error instanceof Error &&
        /^Server error: (408|5\d{2})$/.test(error.message.trim())

      const isRetryableError =
        error instanceof Error &&
        (isRetryableGatewayOrServerStatus ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('ERR_CONNECTION_CLOSED') ||
          error.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
          error.message.includes('network') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT'))

      // AbortError는 재시도하지 않음 (타임아웃 또는 컴포넌트 언마운트)
      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('aborted')
      )

      // 소켓/리소스 고갈: 재시도하면 오히려 악화
      if (isInsufficientResourcesError(error)) {
        throw lastError
      }

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

/**
 * GoTrue(/auth/v1/)는 REST용 fetchWithRetry(30초 Abort·다단 재시도)와 겹치면 초기화가 과도하게 길어짐.
 * 게이트웨이 일시 오류(502/503/504/408)는 짧은 백오프로 재시도하고,
 * `Failed to fetch` 등 브라우저 네트워크 일시 오류도 동일하게 소수 재시도(Abort는 제외).
 */
async function fetchAuthWithGatewayRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const retryStatuses = new Set([408, 502, 503, 504])
  const maxGatewayRetries = 2
  const maxNetworkAttempts = 4
  let lastError: Error | null = null

  for (let netAttempt = 0; netAttempt < maxNetworkAttempts; netAttempt++) {
    try {
      let response = await runSupabaseOutboundBounded(() => fetch(input, init))

      for (let extra = 0; extra < maxGatewayRetries && retryStatuses.has(response.status); extra++) {
        const delayMs = 400 * Math.pow(2, extra)
        await new Promise((r) => setTimeout(r, delayMs))
        response = await runSupabaseOutboundBounded(() => fetch(input, init))
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const msg = lastError.message
      if (isInsufficientResourcesError(error)) {
        throw lastError
      }
      const isAbort =
        lastError.name === 'AbortError' || msg.includes('aborted') || msg.includes('signal is aborted')
      const retryableNetwork =
        !isAbort &&
        (msg.includes('Failed to fetch') ||
          msg.includes('ERR_CONNECTION') ||
          msg.includes('ERR_NETWORK') ||
          msg.includes('network') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('QUIC'))

      if (!retryableNetwork || netAttempt === maxNetworkAttempts - 1) {
        throw lastError
      }

      const delayMs = 350 * Math.pow(2, netAttempt)
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Supabase Auth 요청 네트워크 오류, ${delayMs}ms 후 재시도 (${netAttempt + 1}/${maxNetworkAttempts - 1}):`,
          msg
        )
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  throw lastError ?? new Error('Auth fetch failed')
}

function supabaseGlobalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : String(input)
  if (url.includes('/auth/v1/')) {
    return fetchAuthWithGatewayRetry(input, init)
  }
  return fetchWithRetry(input, init ?? {})
}

// 전역 싱글톤 인스턴스 생성 (auth 설정 포함)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: supabaseGlobalFetch
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

/**
 * 서버 전용: 사용자 JWT로 Supabase 요청 (RLS가 해당 사용자로 적용됨)
 * API 라우트에서 인증된 사용자 권한으로 DB 작업할 때 사용
 */
export function createSupabaseClientWithToken(accessToken: string) {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseClientWithToken is for server only')
  }
  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: fetchWithRetry
    }
  })
}

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
      const msg = error?.message ?? String(error)
      if (msg.includes('AbortError') || msg.includes('aborted') || msg.includes('signal is aborted')) return
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
