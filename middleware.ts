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

  // 개발 환경에서만 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('Middleware: Request to:', req.nextUrl.pathname)
    console.log('Middleware: Cookies:', req.cookies.get('NEXT_LOCALE')?.value)
  }

  // 언어 처리 미들웨어 실행
  const response = intlMiddleware(req)
  
  // 언어 변경 시 쿠키 설정 및 강제 리다이렉트
  const locale = req.nextUrl.pathname.split('/')[1]
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value
  
  if (locale === 'ko' || locale === 'en') {
    // 쿠키 설정
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax'
    })
    
    // 쿠키와 URL의 언어가 다르면 강제 리다이렉트
    if (cookieLocale && cookieLocale !== locale) {
      const newUrl = new URL(req.url)
      newUrl.pathname = newUrl.pathname.replace(`/${locale}`, `/${cookieLocale}`)
      return NextResponse.redirect(newUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
