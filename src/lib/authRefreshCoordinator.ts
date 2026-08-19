import {
  isAuthRefreshDiscardedError as isSdkAuthRefreshDiscardedError,
  type AuthError,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { clearStoredAuthTokens, persistSupabaseSessionToStorage } from './authStorage'

const DEFAULT_COOLDOWN_MS = 90_000
/** checkStoredTokens·visibility·주기 갱신이 겹쳐 GoTrue 429를 유발하지 않도록 */
const PROACTIVE_REFRESH_MIN_INTERVAL_MS = 120_000

let rateLimitedUntilMs = 0
let lastProactiveRefreshAtMs = 0
let refreshInFlight: Promise<{ session: Session | null; error: AuthError | null }> | null = null
let refreshFetchInFlight: Promise<Response> | null = null

export function isAuthRefreshInFlight(): boolean {
  return refreshInFlight != null || refreshFetchInFlight != null
}

/** 갱신 중 signOut/setSession이 세션을 바꿔 SDK가 결과를 버린 경우 — 재시도·로그아웃 처리하지 않음 */
export function isAuthRefreshDiscardedError(error: unknown): boolean {
  if (isSdkAuthRefreshDiscardedError(error)) return true
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; message?: string }
  if (e.name === 'AuthRefreshDiscardedError') return true
  return String(e.message ?? '').includes('Refresh result discarded')
}

export function isAuthRefreshRateLimited(): boolean {
  return Date.now() < rateLimitedUntilMs
}

export function canAttemptProactiveRefresh(): boolean {
  if (isAuthRefreshRateLimited()) return false
  return Date.now() - lastProactiveRefreshAtMs >= PROACTIVE_REFRESH_MIN_INTERVAL_MS
}

export function markProactiveRefreshAttempted(): void {
  lastProactiveRefreshAtMs = Date.now()
}

export function getAuthRefreshCooldownRemainingMs(): number {
  return Math.max(0, rateLimitedUntilMs - Date.now())
}

export function markAuthRefreshRateLimited(retryAfterSec?: number): void {
  const ms =
    retryAfterSec != null && retryAfterSec > 0 && retryAfterSec < 3600
      ? retryAfterSec * 1000
      : DEFAULT_COOLDOWN_MS
  rateLimitedUntilMs = Math.max(rateLimitedUntilMs, Date.now() + ms)
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[auth] refresh_token rate limited — pausing manual refresh for ${Math.round(ms / 1000)}s`
    )
  }
}

export function isAuthRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: number; message?: string }
  if (e.status === 429) return true
  const msg = String(e.message ?? '').toLowerCase()
  return msg.includes('429') || msg.includes('too many requests') || msg.includes('rate limit')
}

/** refresh_token 재사용·만료·폐기 — 재시도해도 400만 반복되며 SIGNED_OUT 연쇄를 유발 */
export function isAuthInvalidRefreshError(error: unknown): boolean {
  if (isAuthRefreshDiscardedError(error)) return false
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: number; message?: string; code?: string }
  if (e.status === 400 || e.status === 401) return true
  const code = String(e.code ?? '').toLowerCase()
  if (
    code.includes('refresh_token') ||
    code === 'invalid_grant' ||
    code === 'session_not_found'
  ) {
    return true
  }
  const msg = String(e.message ?? '').toLowerCase()
  return (
    msg.includes('invalid refresh') ||
    msg.includes('refresh token not found') ||
    msg.includes('refresh_token') ||
    msg.includes('invalid_grant') ||
    msg.includes('already been used') ||
    msg.includes('session not found')
  )
}

export function parseRetryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  if (!header) return undefined
  const seconds = parseInt(header, 10)
  if (Number.isFinite(seconds) && seconds > 0) return seconds
  const until = Date.parse(header)
  if (Number.isFinite(until)) {
    const sec = Math.ceil((until - Date.now()) / 1000)
    return sec > 0 ? sec : undefined
  }
  return undefined
}

export function isAuthRefreshTokenRequestUrl(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')
}

/** GoTrue refresh_token 요청 — 동시 1회 + 429 쿨다운 */
export function fetchAuthRefreshTokenSingleFlight(doFetch: () => Promise<Response>): Promise<Response> {
  if (isAuthRefreshRateLimited()) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: 'too_many_requests',
          error_description: 'Refresh paused after rate limit (client cooldown)',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    )
  }

  if (!refreshFetchInFlight) {
    refreshFetchInFlight = (async () => {
      try {
        const response = await doFetch()
        if (response.status === 429) {
          markAuthRefreshRateLimited(parseRetryAfterSeconds(response))
        }
        return response
      } finally {
        refreshFetchInFlight = null
      }
    })()
  }

  // 동일 Response body는 한 번만 읽을 수 있음 — 대기 호출자는 clone을 받는다
  return refreshFetchInFlight.then((response) => response.clone())
}

async function readCurrentAuthSession(client: SupabaseClient): Promise<Session | null> {
  try {
    const { data, error } = await client.auth.getSession()
    if (isAuthRefreshDiscardedError(error)) return data.session ?? null
    if (error || !data.session) return null
    return data.session
  } catch (e) {
    if (isAuthRefreshDiscardedError(e)) return null
    return null
  }
}

/** refreshSession 호출부 통합 — fetch 단일 비행과 함께 쓰면 중복 완화 */
export async function coordinatedRefreshSession(
  client: SupabaseClient,
  params?: { refresh_token?: string }
): Promise<{ session: Session | null; error: AuthError | null }> {
  if (isAuthRefreshRateLimited()) {
    return {
      session: null,
      error: { message: 'refresh_rate_limited', status: 429, name: 'AuthApiError' } as AuthError,
    }
  }

  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      const refreshArgs = params?.refresh_token
        ? { refresh_token: params.refresh_token }
        : undefined
      const { data, error } = await client.auth.refreshSession(refreshArgs)

      if (isAuthRefreshDiscardedError(error)) {
        // 다른 탭/setSession/signOut이 먼저 세션을 바꿈. 새 세션이 있으면 그걸 쓰고, 없으면 로그아웃으로 처리하지 않음.
        const current = await readCurrentAuthSession(client)
        if (current) persistSupabaseSessionToStorage(current)
        return { session: current, error: null }
      }

      if (error && isAuthRateLimitError(error)) {
        markAuthRefreshRateLimited()
      }
      if (error && isAuthInvalidRefreshError(error)) {
        clearStoredAuthTokens()
      } else if (data.session) {
        persistSupabaseSessionToStorage(data.session)
      }
      return { session: data.session ?? null, error: error ?? null }
    } catch (e) {
      if (isAuthRefreshDiscardedError(e)) {
        const current = await readCurrentAuthSession(client)
        if (current) persistSupabaseSessionToStorage(current)
        return { session: current, error: null }
      }
      if (isAuthRateLimitError(e)) {
        markAuthRefreshRateLimited()
      }
      return {
        session: null,
        error: (e instanceof Error ? e : new Error(String(e))) as AuthError,
      }
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}
