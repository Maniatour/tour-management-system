import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 보호된 라우트들
  const adminRoutes = ['/admin']
  const teamRoutes = ['/reservations', '/customers', '/tours', '/schedule']
  const authRoutes = ['/auth']

  // 로케일 접두어 제거
  const stripLocale = (pathname: string) => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return pathname
    const first = segments[0]
    const localeRegex = /^[a-z]{2}(?:-[A-Z]{2})?$/
    if (localeRegex.test(first)) {
      return '/' + segments.slice(1).join('/')
    }
    return pathname
  }

  const path = stripLocale(req.nextUrl.pathname)
  
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isTeamRoute = teamRoutes.some(route => path.startsWith(route))
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))

  // 서버단 강제 리다이렉트는 최소화: 클라이언트 보호(ProtectedRoute)로 위임
  // 로그인한 상태에서 인증 페이지 접근 시에만 원래 경로로 보내기
  if (session && isAuthRoute) {
    const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/'
    return NextResponse.redirect(new URL(redirectTo, req.url))
  }

  // 나머지는 통과 (클라이언트에서 권한 체크 및 리다이렉트)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
