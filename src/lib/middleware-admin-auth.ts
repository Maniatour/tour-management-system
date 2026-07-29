import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  AUTH_ACCESS_COOKIE,
  isAccessTokenFresh,
} from '@/lib/authSessionCookie'
import { isStaffTeamRole, readTeamClaimsFromAccessToken } from '@/lib/authJwtRoleClaims'
import { DEFAULT_ROUTING_LOCALE, isSiteLocale, siteLocalePathTest } from '@/lib/siteLocales'

export function isAdminAppPath(pathname: string): boolean {
  return siteLocalePathTest(pathname, '/admin(/|$)')
}

function readAuthAccessToken(req: NextRequest): string | null {
  const raw = req.cookies.get(AUTH_ACCESS_COOKIE)?.value
  if (!raw) return null
  try {
    return decodeURIComponent(raw).trim() || null
  } catch {
    return raw.trim() || null
  }
}

function localeFromPath(pathname: string): string {
  const localeSegment = pathname.split('/')[1]
  return isSiteLocale(localeSegment) ? localeSegment : DEFAULT_ROUTING_LOCALE
}

/**
 * /admin 선검증:
 * - 만료 쿠키 → 로그인
 * - JWT team_role=customer → 홈
 * - JWT staff + 유효 → 통과
 * - 쿠키 없음 / 클레임 없음 → 클라이언트 가드에 위임
 */
export function handleAdminRouteAuth(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname
  if (!isAdminAppPath(pathname)) return null

  const token = readAuthAccessToken(req)
  if (!token) return null

  const locale = localeFromPath(pathname)

  if (!isAccessTokenFresh(token)) {
    const redirectTo = `${pathname}${req.nextUrl.search}`
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}/auth`
    url.search = `?redirectTo=${encodeURIComponent(redirectTo)}`
    return NextResponse.redirect(url)
  }

  const claims = readTeamClaimsFromAccessToken(token)
  if (!claims) return null

  if (claims.teamRole === 'customer') {
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}`
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isStaffTeamRole(claims.teamRole)) {
    return null
  }

  return null
}
