import type { NextRequest } from 'next/server'

/** 미들웨어 /admin 선검증용 — localStorage JWT 미러 (httpOnly 아님, XSS 노출은 localStorage와 동일) */
export const AUTH_ACCESS_COOKIE = 'tms-auth-access'

/** App Router API — Authorization 헤더 또는 tms-auth-access 쿠키에서 JWT 추출 */
export function readAuthAccessTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }

  const raw = request.cookies.get(AUTH_ACCESS_COOKIE)?.value
  if (!raw) return null
  try {
    return decodeURIComponent(raw).trim() || null
  } catch {
    return raw.trim() || null
  }
}

export function syncAuthSessionCookie(accessToken: string, expiresAtSec: number): void {
  if (typeof document === 'undefined') return
  const maxAge = expiresAtSec - Math.floor(Date.now() / 1000)
  if (maxAge <= 0) {
    clearAuthSessionCookie()
    return
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AUTH_ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

export function syncAuthSessionCookieFromStorage(): void {
  if (typeof window === 'undefined') return
  const token = localStorage.getItem('sb-access-token')?.trim()
  const expRaw = localStorage.getItem('sb-expires-at')
  if (!token || !expRaw) {
    clearAuthSessionCookie()
    return
  }
  const exp = parseInt(expRaw, 10)
  if (!Number.isFinite(exp)) {
    clearAuthSessionCookie()
    return
  }
  syncAuthSessionCookie(token, exp)
}

export function clearAuthSessionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function decodeJwtExpSec(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json =
      typeof atob !== 'undefined'
        ? atob(padded)
        : ''
    if (!json) return null
    const parsed = JSON.parse(json) as { exp?: number }
    return typeof parsed.exp === 'number' ? parsed.exp : null
  } catch {
    return null
  }
}

export function isAccessTokenFresh(token: string, skewSec = 30): boolean {
  const exp = decodeJwtExpSec(token)
  if (exp == null) return false
  return exp > Math.floor(Date.now() / 1000) + skewSec
}
