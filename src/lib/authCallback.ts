import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { updateSupabaseToken } from '@/lib/supabase'

const SESSION_BUDGET_MS = 10_000
const EXCHANGE_BUDGET_MS = 12_000
const AUTH_EVENT_WAIT_MS = 8_000

export function persistSupabaseSessionToStorage(session: Session) {
  if (typeof window === 'undefined') return
  localStorage.setItem('sb-access-token', session.access_token)
  if (session.refresh_token) {
    localStorage.setItem('sb-refresh-token', session.refresh_token)
  }
  const tokenExpiry = session.expires_at || Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  localStorage.setItem('sb-expires-at', tokenExpiry.toString())
  updateSupabaseToken(session.access_token)
}

export async function getSessionBounded(
  supabase: SupabaseClient,
  budgetMs = SESSION_BUDGET_MS
): Promise<Session | null> {
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data, error }) => (error ? null : data.session)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
    ])
  } catch {
    return null
  }
}

function parseHashTokens(): {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
} | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash || !hash.includes('access_token')) return null

  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const accessToken = hashParams.get('access_token')
  if (!accessToken) return null

  const refreshToken = hashParams.get('refresh_token')
  const expiresIn = hashParams.get('expires_in')
  const expiresAtRaw = hashParams.get('expires_at')

  let expiresAt: number | null = null
  if (expiresAtRaw) {
    expiresAt = parseInt(expiresAtRaw, 10)
  } else if (expiresIn) {
    expiresAt = Math.floor(Date.now() / 1000) + parseInt(expiresIn, 10)
  }

  return { accessToken, refreshToken, expiresAt }
}

function clearOAuthUrlFragments() {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    url.hash = ''
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState({}, document.title, url.pathname + url.search)
  } catch {
    /* ignore */
  }
}

async function waitForAuthSessionEvent(supabase: SupabaseClient): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      subscription.unsubscribe()
      clearTimeout(timer)
      resolve(session)
    }

    const timer = setTimeout(() => finish(null), AUTH_EVENT_WAIT_MS)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        finish(session)
      }
    })
  })
}

/**
 * Google OAuth 등 리다이렉트 콜백에서 세션을 복구한다.
 * 모바일에서 getSession()이 멈추는 경우를 위해 PKCE code·hash·이벤트·타임아웃을 모두 시도한다.
 */
export async function completeOAuthCallback(
  supabase: SupabaseClient
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'client_only' }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const urlError =
    searchParams.get('error_description') ||
    searchParams.get('error') ||
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description')
  if (urlError) {
    return { ok: false, error: urlError }
  }

  const code = searchParams.get('code')
  if (code) {
    try {
      const result = await Promise.race([
        supabase.auth.exchangeCodeForSession(code),
        new Promise<{ data: { session: null }; error: { message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ data: { session: null }, error: { message: 'exchangeCodeForSession_timeout' } }),
            EXCHANGE_BUDGET_MS
          )
        ),
      ])
      if (result.data.session?.user) {
        persistSupabaseSessionToStorage(result.data.session)
        clearOAuthUrlFragments()
        return { ok: true, session: result.data.session }
      }
      if (result.error?.message && result.error.message !== 'exchangeCodeForSession_timeout') {
        return { ok: false, error: result.error.message }
      }
    } catch (e) {
      console.warn('completeOAuthCallback: exchangeCodeForSession failed', e)
    }
  }

  const hashTokens = parseHashTokens()
  if (hashTokens) {
    const expiry = hashTokens.expiresAt ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600
    localStorage.setItem('sb-access-token', hashTokens.accessToken)
    if (hashTokens.refreshToken) {
      localStorage.setItem('sb-refresh-token', hashTokens.refreshToken)
    }
    localStorage.setItem('sb-expires-at', String(expiry))
    updateSupabaseToken(hashTokens.accessToken)

    try {
      const { data } = await Promise.race([
        supabase.auth.setSession({
          access_token: hashTokens.accessToken,
          refresh_token: hashTokens.refreshToken || '',
        }),
        new Promise<{ data: { session: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), SESSION_BUDGET_MS)
        ),
      ])
      if (data.session?.user) {
        persistSupabaseSessionToStorage(data.session)
        clearOAuthUrlFragments()
        return { ok: true, session: data.session }
      }
    } catch (e) {
      console.warn('completeOAuthCallback: setSession from hash failed', e)
    }

    clearOAuthUrlFragments()
    const fallback = await getSessionBounded(supabase, 4_000)
    if (fallback?.user) {
      persistSupabaseSessionToStorage(fallback)
      return { ok: true, session: fallback }
    }

    return {
      ok: true,
      session: {
        access_token: hashTokens.accessToken,
        refresh_token: hashTokens.refreshToken || '',
        expires_at: expiry,
        expires_in: Math.max(0, expiry - Math.floor(Date.now() / 1000)),
        token_type: 'bearer',
      } as Session,
    }
  }

  const fromEvent = await waitForAuthSessionEvent(supabase)
  if (fromEvent?.user) {
    persistSupabaseSessionToStorage(fromEvent)
    clearOAuthUrlFragments()
    return { ok: true, session: fromEvent }
  }

  let session = await getSessionBounded(supabase)
  if (session?.user) {
    persistSupabaseSessionToStorage(session)
    clearOAuthUrlFragments()
    return { ok: true, session }
  }

  const rt = localStorage.getItem('sb-refresh-token')
  if (rt) {
    try {
      const refreshed = await Promise.race([
        supabase.auth.refreshSession({ refresh_token: rt }),
        new Promise<{ data: { session: null }; error: { message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ data: { session: null }, error: { message: 'refresh_timeout' } }),
            SESSION_BUDGET_MS
          )
        ),
      ])
      if (refreshed.data.session?.user) {
        persistSupabaseSessionToStorage(refreshed.data.session)
        clearOAuthUrlFragments()
        return { ok: true, session: refreshed.data.session }
      }
    } catch (e) {
      console.warn('completeOAuthCallback: refresh failed', e)
    }
  }

  session = await getSessionBounded(supabase, 4_000)
  if (session?.user) {
    persistSupabaseSessionToStorage(session)
    clearOAuthUrlFragments()
    return { ok: true, session }
  }

  return { ok: false, error: 'no_session' }
}
