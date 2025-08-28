import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  // 지원하는 언어 목록
  locales: ['ko', 'en'],
  
  // 기본 언어
  defaultLocale: 'ko',
  
  // 로케일 감지 비활성화 (URL 기반으로만 동작)
  localeDetection: false
})

export const config = {
  // 다국어 라우팅이 적용될 경로 패턴
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
