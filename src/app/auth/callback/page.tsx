'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback')
        
        // URL에서 해시 프래그먼트 확인
        const hash = window.location.hash
        console.log('Auth callback: URL hash:', hash)
        
        // locale 감지
        let locale = 'ko' // 기본값
        
        // 브라우저 언어 설정 확인
        const browserLang = navigator.language || navigator.languages?.[0] || 'ko'
        if (browserLang.startsWith('en')) {
          locale = 'en'
        } else if (browserLang.startsWith('ja')) {
          locale = 'ja'
        }
        
        // localStorage에서 저장된 locale 확인
        const savedLocale = localStorage.getItem('preferred-locale')
        if (savedLocale && ['ko', 'en', 'ja'].includes(savedLocale)) {
          locale = savedLocale
        }
        
        console.log('Auth callback: Detected locale:', locale)
        
        // 해시가 있으면 토큰을 localStorage에 저장하고 즉시 리다이렉트
        if (hash && hash.includes('access_token')) {
          console.log('Auth callback: Found access token in hash, storing tokens')
          
          // 해시에서 토큰 정보 추출
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          const expiresAt = hashParams.get('expires_at')
          
          if (accessToken) {
            console.log('Auth callback: Storing tokens in localStorage')
            
            // 토큰을 localStorage에 저장
            localStorage.setItem('sb-access-token', accessToken)
            if (refreshToken) {
              localStorage.setItem('sb-refresh-token', refreshToken)
            }
            // 토큰 만료 시간을 7일로 설정 (기본값)
            const tokenExpiry = expiresAt ? parseInt(expiresAt) : Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
            localStorage.setItem('sb-expires-at', tokenExpiry.toString())
            
            console.log('Auth callback: Tokens stored, redirecting to main page')
            router.replace(`/${locale}`)
            return
          }
        }
        
        // 토큰이 없으면 에러 페이지로 리다이렉트
        console.log('Auth callback: No access token found')
        router.replace(`/${locale}/auth?error=no_token`)
      } catch (error) {
        console.error('Auth callback: Unexpected error:', error)
        router.replace(`/ko/auth?error=unexpected_error`)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}