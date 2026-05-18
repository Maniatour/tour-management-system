import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import {
  fetchAuthRefreshTokenSingleFlight,
  isAuthRefreshRateLimited,
  isAuthRefreshTokenRequestUrl,
} from './authRefreshCoordinator'

export { isAbortLikeError } from './isAbortLikeError'
export {
  canAttemptProactiveRefresh,
  coordinatedRefreshSession,
  getAuthRefreshCooldownRemainingMs,
  isAuthInvalidRefreshError,
  isAuthRefreshRateLimited,
  isAuthRateLimitError,
  markProactiveRefreshAttempted,
} from './authRefreshCoordinator'
export {
  clearStoredAuthTokens,
  persistSupabaseSessionToStorage,
  syncCustomTokensFromGoTrueStorage,
} from './authStorage'

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
const supabaseOutboundMaxConcurrentDefault = typeof window === 'undefined' ? 14 : 6
let supabaseOutboundLimit = supabaseOutboundMaxConcurrentDefault
let supabaseOutboundActive = 0
const supabaseOutboundWaiters: Array<() => void> = []

/** Failed to fetch 연쇄 시 동시 재시도·로그 폭주 방지 */
const REST_NETWORK_FAILURE_WINDOW_MS = 12_000
let restNetworkFailureWindowStartMs = 0
let restNetworkFailureCount = 0
let restGlobalBackoffUntilMs = 0
let lastRestRetryLogAtMs = 0

function isBrowserNetworkFetchError(message: string): boolean {
  return (
    message.includes('Failed to fetch') ||
    message.includes('ERR_CONNECTION_CLOSED') ||
    message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
    message.includes('network') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT')
  )
}

function recordRestNetworkFailure(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - restNetworkFailureWindowStartMs > REST_NETWORK_FAILURE_WINDOW_MS) {
    restNetworkFailureWindowStartMs = now
    restNetworkFailureCount = 0
  }
  restNetworkFailureCount += 1
  if (restNetworkFailureCount >= 2) {
    const backoffMs = Math.min(45_000, 2_500 * restNetworkFailureCount)
    restGlobalBackoffUntilMs = Math.max(restGlobalBackoffUntilMs, now + backoffMs)
    supabaseOutboundLimit = Math.max(2, supabaseOutboundMaxConcurrentDefault - 3)
  }
}

function recordRestNetworkSuccess(): void {
  if (typeof window === 'undefined') return
  restNetworkFailureCount = 0
  restGlobalBackoffUntilMs = 0
  supabaseOutboundLimit = supabaseOutboundMaxConcurrentDefault
}

async function waitRestGlobalBackoff(): Promise<void> {
  const waitMs = restGlobalBackoffUntilMs - Date.now()
  if (waitMs <= 0) return
  await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 8_000)))
}

function logRestRetryThrottled(attempt: number, maxRetries: number, message: string): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastRestRetryLogAtMs < 8_000) return
  lastRestRetryLogAtMs = now
  if (process.env.NODE_ENV === 'development') {
    console.debug(
      `[supabase] network retry ${attempt}/${maxRetries} (recent failures: ${restNetworkFailureCount}): ${message}`
    )
  }
}

function acquireSupabaseOutboundSlot(): Promise<void> {
  if (supabaseOutboundActive < supabaseOutboundLimit) {
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

export function decodeJwtExpSec(accessToken: string): number | null {
  try {
    const part = accessToken.split('.')[1]
    if (!part) return null
    const payload = JSON.parse(
      atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    ) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** REST·RLS 호출에 쓸 수 있는 access JWT가 있는지 (429 쿨다운 중 유효 토큰이면 true) */
export function canUseAuthenticatedRest(): boolean {
  return getStoredAccessTokenIfValid(30) != null
}

/** GoTrue 세션이 비어도(localStorage JWT 유효 시) REST RLS 요청이 401 나지 않도록 */
export function getStoredAccessTokenIfValid(minTtlSec = 45): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('sb-access-token')?.trim()
  if (!token) return null
  const exp = decodeJwtExpSec(token)
  const nowSec = Math.floor(Date.now() / 1000)
  if (exp != null && exp <= nowSec + minTtlSec) return null
  return token
}

/**
 * App Router API 호출용 Bearer JWT.
 * getSession()만 쓰면 GoTrue 메모리 세션과 localStorage(sb-access-token) 불일치로
 * 직원 UI(isStaff)인데도 토큰이 비어 인증 오류가 날 수 있습니다.
 */
export async function getAccessTokenForApi(minTtlSec = 30): Promise<string | null> {
  const stored = getStoredAccessTokenIfValid(minTtlSec)
  if (stored) return stored

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    const exp = decodeJwtExpSec(session.access_token)
    const nowSec = Math.floor(Date.now() / 1000)
    if (exp == null || exp > nowSec + minTtlSec) {
      return session.access_token
    }
  }

  if (typeof window !== 'undefined') {
    const { coordinatedRefreshSession, canAttemptProactiveRefresh, markProactiveRefreshAttempted } =
      await import('./authRefreshCoordinator')
    const rt = localStorage.getItem('sb-refresh-token')
    if (rt && canAttemptProactiveRefresh()) {
      markProactiveRefreshAttempted()
      const { session: refreshed, error } = await coordinatedRefreshSession(supabase, {
        refresh_token: rt,
      })
      if (!error && refreshed?.access_token) {
        return refreshed.access_token
      }
    }
  }

  return getStoredAccessTokenIfValid(0)
}

function bearerTokenFromAuthorizationHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader?.trim()) return null
  const match = authHeader.trim().match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function mergeRestAuthorizationFromStorage(options: RequestInit): RequestInit {
  if (typeof window === 'undefined') return options
  const stored = getStoredAccessTokenIfValid(30)
  if (!stored) return options

  const headers = new Headers(options.headers)
  const existingBearer = bearerTokenFromAuthorizationHeader(headers.get('Authorization'))
  if (existingBearer === stored) return options

  headers.set('Authorization', `Bearer ${stored}`)
  return { ...options, headers }
}

// 재시도 로직이 포함된 fetch 함수
const fetchWithRetry = async (
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> => {
  const maxServerRetries = typeof window === 'undefined' ? 3 : 2
  const maxNetworkRetriesDefault = typeof window === 'undefined' ? 3 : 1
  const retryDelay = 1000
  let lastError: Error | null = null
  let maxRetries = maxServerRetries

  // Supabase가 넘기는 AbortSignal은 세션 갱신·내부 요청 정리 등으로 조기 abort되어
  // 정상적인 REST 조회도 전부 AbortError로 끝나는 경우가 있다. fetch에는 사용하지 않고
  // 여기서만 타임아웃(AbortController)을 건다.
  const { signal: _supabaseSignal, ...baseOptions } = options

  await waitRestGlobalBackoff()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const restOptions = mergeRestAuthorizationFromStorage(baseOptions)
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

      if (response.status === 401 && attempt < maxRetries) {
        const stored = getStoredAccessTokenIfValid(0)
        const sentBearer = bearerTokenFromAuthorizationHeader(headers.get('Authorization'))
        if (stored && sentBearer !== stored) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
          continue
        }
      }

      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408)) {
        recordRestNetworkSuccess()
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

      const isNetworkFetchError =
        error instanceof Error && isBrowserNetworkFetchError(error.message)

      const isRetryableError =
        error instanceof Error &&
        (isRetryableGatewayOrServerStatus || isNetworkFetchError)

      if (isNetworkFetchError) {
        recordRestNetworkFailure()
        maxRetries =
          Date.now() < restGlobalBackoffUntilMs
            ? 0
            : maxNetworkRetriesDefault
      } else if (isRetryableGatewayOrServerStatus) {
        maxRetries = maxServerRetries
      }

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

      const jitter = 0.85 + Math.random() * 0.3
      const delay = Math.round(retryDelay * Math.pow(2, attempt) * jitter)
      if (isNetworkFetchError) {
        logRestRetryThrottled(attempt + 1, maxRetries, lastError.message)
      } else if (process.env.NODE_ENV === 'development') {
        console.debug(
          `Supabase 요청 실패, ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}):`,
          lastError.message
        )
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Unknown error')
}

/**
 * GoTrue(/auth/v1/)는 REST용 fetchWithRetry(30초 Abort·다단 재시도)와 겹치면 초기화가 과도하게 길어짐.
 * 게이트웨이 일시 오류(502/503/504/408)는 짧은 백오프로 재시도하고,
 * `Failed to fetch` 등 브라우저 네트워크 일시 오류도 동일하게 소수 재시도(Abort는 제외).
 */
async function fetchAuthWithGatewayRetryCore(
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

async function fetchAuthWithGatewayRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = requestUrlString(input)
  if (isAuthRefreshTokenRequestUrl(url)) {
    return fetchAuthRefreshTokenSingleFlight(() => fetchAuthWithGatewayRetryCore(input, init))
  }
  return fetchAuthWithGatewayRetryCore(input, init)
}

function supabaseGlobalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrlString(input)
  if (url.includes('/auth/v1/')) {
    return fetchAuthWithGatewayRetry(input, init)
  }
  return fetchWithRetry(input, init ?? {})
}

// 전역 싱글톤 인스턴스 생성 (auth 설정 포함)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // 자동 refresh는 429·SIGNED_OUT 연쇄를 유발 — AuthContext.refreshTokenIfNeeded + coordinatedRefresh만 사용
    autoRefreshToken: false,
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

let lastAppliedAccessToken: string | null = null

export function resetSupabaseTokenSyncCache(): void {
  lastAppliedAccessToken = null
}

/** GoTrue in-memory 세션과 동기화. SIGNED_IN 직후 불필요한 setSession(→ refresh_token 폭주)은 피한다. */
export const updateSupabaseToken = (
  accessToken: string,
  options?: { refreshToken?: string; forceSetSession?: boolean }
) => {
  if (typeof window === 'undefined' || !accessToken.trim()) return
  if (!options?.forceSetSession && lastAppliedAccessToken === accessToken) return

  const refreshToken = options?.refreshToken ?? localStorage.getItem('sb-refresh-token') ?? ''
  localStorage.setItem('sb-access-token', accessToken)
  if (options?.refreshToken) {
    localStorage.setItem('sb-refresh-token', options.refreshToken)
  }

  const expSec = decodeJwtExpSec(accessToken)
  const nowSec = Math.floor(Date.now() / 1000)
  const stillValid = expSec != null && expSec > nowSec + 120

  lastAppliedAccessToken = accessToken

  // 429 쿨다운 중 setSession은 refresh_token을 다시 치므로 생략. REST는 localStorage JWT로 계속 가능.
  if (isAuthRefreshRateLimited()) return

  if (!options?.forceSetSession && stillValid) {
    return
  }

  // 만료된 access로 setSession하면 GoTrue가 refresh_token을 치는데, sb-refresh-token이 stale이면 400·SIGNED_OUT 연쇄
  const accessExpired = expSec != null && expSec <= nowSec
  if (!options?.forceSetSession && accessExpired) {
    return
  }

  if (!options?.forceSetSession && !refreshToken.trim()) {
    return
  }

  void supabase.auth
    .setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    .catch((error) => {
      const msg = error?.message ?? String(error)
      if (msg.includes('AbortError') || msg.includes('aborted') || msg.includes('signal is aborted')) return
      if (msg.toLowerCase().includes('too many requests') || msg.includes('429')) return
      console.error('Failed to update Supabase token:', error)
    })
}

// 클라이언트 컴포넌트용 Supabase 클라이언트 (같은 인스턴스 사용)
export const createClientSupabase = () => {
  return supabase
}

// createClient 함수도 export (기존 코드 호환성을 위해)
export { createClient }

export type { Database }
