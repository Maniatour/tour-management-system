import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 사용자 역할 확인 함수 (미들웨어용)
async function checkUserRole(supabase: any, email: string) {
  try {
    const { data: teamData, error } = await supabase
      .from('team')
      .select('position, is_active')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (error || !teamData) {
      return 'customer'
    }

    const position = teamData.position?.toLowerCase() || ''
    
    // position 기반으로 역할 결정
    if (position === 'super') {
      return 'admin'
    }
    if (position === 'office manager') {
      return 'manager'
    }
    if (position === 'tour guide' || position === 'op' || position === 'driver') {
      return 'team_member'
    }
    
    // position이 있지만 특정 키워드가 없는 경우 팀원으로 처리
    if (position) {
      return 'team_member'
    }
    
    return 'customer'
  } catch (error) {
    console.error('Error checking user role in middleware:', error)
    return 'customer'
  }
}

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
  
  // URL에서 locale 추출 (최상단에 한 번 정의)
  const pathSegments = req.nextUrl.pathname.split('/').filter(Boolean)
  const locale = pathSegments[0] || 'ko'
  
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isTeamRoute = teamRoutes.some(route => path.startsWith(route))
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))

  // 로그인하지 않은 경우
  if (!session) {
    if (isAdminRoute || isTeamRoute) {
      const redirectUrl = new URL(`/${locale}/auth`, req.url)
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    // 로그인한 상태에서 인증 페이지에 접근하는 경우
    if (isAuthRoute) {
      const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/'
      const redirectUrl = new URL(redirectTo, req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // admin 라우트 접근 권한 확인
    if (isAdminRoute) {
      const userRole = await checkUserRole(supabase, session.user.email!)
      
      // admin, manager, team_member만 admin 페이지 접근 가능
      if (userRole === 'customer') {
        const redirectUrl = new URL(`/${locale}`, req.url)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // 팀원 권한이 필요한 라우트 체크
    if (isTeamRoute) {
      const userRole = await checkUserRole(supabase, session.user.email!)
      
      // team_member, manager, admin만 팀 라우트 접근 가능
      if (userRole === 'customer') {
        const redirectUrl = new URL(`/${locale}`, req.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // 나머지는 통과 (클라이언트에서 권한 체크 및 리다이렉트)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
