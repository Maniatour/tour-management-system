import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'

const intlMiddleware = createIntlMiddleware({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  localeDetection: false // 자동 감지 비활성화
})

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

  // /chat/ 경로는 로케일이 필요 없으므로 미들웨어를 건너뛰도록 처리
  if (req.nextUrl.pathname.startsWith('/chat/')) {
    const response = NextResponse.next()
    response.headers.set('x-pathname', req.nextUrl.pathname)
    return response
  }

  // /photos/ 경로는 로케일이 필요 없으므로 미들웨어를 건너뛰도록 처리
  if (req.nextUrl.pathname.startsWith('/photos/')) {
    const response = NextResponse.next()
    response.headers.set('x-pathname', req.nextUrl.pathname)
    return response
  }

  // 개발 환경에서만 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('Middleware: Request to:', req.nextUrl.pathname)
    console.log('Middleware: Cookies:', req.cookies.get('NEXT_LOCALE')?.value)
  }

  // 언어 처리 미들웨어 실행
  const response = intlMiddleware(req)
  const pathname = req.nextUrl.pathname

  // 리다이렉트인 경우 그대로 반환 (pathname은 다음 요청에서 설정됨)
  if (response.status >= 300 && response.status < 400) {
    return response
  }

  // pathname을 서버(레이아웃)로 전달: 요청 헤더에 설정해야 layout의 headers()에서 읽을 수 있음
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

  const res = NextResponse.next({
    request: { headers: requestHeaders }
  })
  // pathname 쿠키도 설정 (일부 환경에서 요청 헤더가 전달되지 않을 수 있어 레이아웃 fallback용)
  res.cookies.set('x-pathname', pathname, { path: '/', maxAge: 60, sameSite: 'lax' })
  // intlMiddleware가 설정한 쿠키/헤더 복사
  response.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
  response.headers.forEach((v, k) => { if (k !== 'x-middleware-skip') res.headers.set(k, v) })

  // 언어 변경 시 쿠키 설정 (강제 리다이렉트 제거)
  const locale = pathname.split('/')[1]
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value

  if (locale === 'ko' || locale === 'en') {
    res.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax'
    })
    if (process.env.NODE_ENV === 'development') {
      console.log('Middleware: Setting locale cookie:', locale)
      console.log('Middleware: Previous cookie locale:', cookieLocale)
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
