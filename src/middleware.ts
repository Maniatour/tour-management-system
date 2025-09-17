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

  // 로케일 접두어 제거 (예: /ko, /en, /ja 또는 /ko-KR)
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

  // 로그인하지 않은 경우
  if (!session) {
    if (isAdminRoute || isTeamRoute) {
      const redirectUrl = new URL('/auth', req.url)
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    // 로그인한 상태에서 인증 페이지에 접근하는 경우
    if (isAuthRoute) {
      const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/'
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }

    // 팀원/관리자 권한이 필요한 라우트 체크
    if (isTeamRoute || isAdminRoute) {
      // 여기서는 기본적으로 로그인만 확인하고, 
      // 실제 권한 체크는 각 페이지에서 수행
      // (미들웨어에서는 데이터베이스 조회가 제한적이므로)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
