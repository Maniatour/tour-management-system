import type { Session } from '@supabase/supabase-js'

const ACCESS_KEY = 'sb-access-token'
const REFRESH_KEY = 'sb-refresh-token'
const EXPIRES_KEY = 'sb-expires-at'

function supabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    const host = new URL(url).hostname
    const ref = host.split('.')[0]
    return ref || null
  } catch {
    return null
  }
}

export function getSupabaseGoTrueStorageKey(): string | null {
  const ref = supabaseProjectRef()
  return ref ? `sb-${ref}-auth-token` : null
}

export function persistSupabaseSessionToStorage(session: Session): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_KEY, session.access_token)
  localStorage.setItem(REFRESH_KEY, session.refresh_token)
  const tokenExpiry = session.expires_at || Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  localStorage.setItem(EXPIRES_KEY, tokenExpiry.toString())
}

/** 커스텀 sb-* 토큰 + GoTrue 기본 storage 정리 */
export function clearStoredAuthTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXPIRES_KEY)
  const goTrueKey = getSupabaseGoTrueStorageKey()
  if (goTrueKey) {
    localStorage.removeItem(goTrueKey)
  }
}

/** GoTrue storage에만 세션이 있고 sb-* 가 어긋난 경우 동기화 */
export function syncCustomTokensFromGoTrueStorage(): boolean {
  if (typeof window === 'undefined') return false
  const goTrueKey = getSupabaseGoTrueStorageKey()
  if (!goTrueKey) return false
  const raw = localStorage.getItem(goTrueKey)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as {
      access_token?: string
      refresh_token?: string
      expires_at?: number
    }
    if (!parsed.access_token || !parsed.refresh_token) return false
    const customRt = localStorage.getItem(REFRESH_KEY)
    if (customRt && customRt !== parsed.refresh_token) {
      return false
    }
    localStorage.setItem(ACCESS_KEY, parsed.access_token)
    localStorage.setItem(REFRESH_KEY, parsed.refresh_token)
    if (parsed.expires_at) {
      localStorage.setItem(EXPIRES_KEY, String(parsed.expires_at))
    }
    return true
  } catch {
    return false
  }
}
