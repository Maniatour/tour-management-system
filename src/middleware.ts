import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // 정적 파일들은 미들웨어를 건너뛰도록 처리
  if (
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.nextUrl.pathname.startsWith('/api/') ||
    req.nextUrl.pathname.includes('.') ||
    req.nextUrl.pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // 간단한 응답 생성
  const response = NextResponse.next()

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
  
  // URL에서 locale 추출
  const pathSegments = req.nextUrl.pathname.split('/').filter(Boolean)
  const locale = pathSegments[0] || 'ko'
  
  // 보호된 라우트들
  const adminRoutes = ['/admin']
  const authRoutes = ['/auth']
  
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))

  // 개발 환경에서만 최소한의 로그 출력
  if (process.env.NODE_ENV === 'development' && isAdminRoute) {
    console.log('Middleware: Admin route accessed:', path)
  }

  // 모든 요청을 통과시킴 (클라이언트에서 인증 처리)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
