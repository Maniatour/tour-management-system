'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    console.log('Auth callback: Simple redirect to admin')
    console.log('Auth callback: Current pathname:', window.location.pathname)
    
    // URL에서 locale 추출
    const currentPath = window.location.pathname
    let locale = 'ko' // 기본값
    if (currentPath.startsWith('/ko/')) {
      locale = 'ko'
    } else if (currentPath.startsWith('/en/')) {
      locale = 'en'
    } else if (currentPath.startsWith('/ja/')) {
      locale = 'ja'
    }
    
    console.log('Auth callback: Detected locale:', locale)
    
    // URL 해시 확인
    const hash = window.location.hash
    console.log('Auth callback: URL hash present:', !!hash)
    
    if (hash && hash.includes('access_token')) {
      console.log('Auth callback: Found tokens, storing in localStorage and redirecting to admin')
      
      // 토큰을 localStorage에 저장
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      
      if (accessToken) {
        localStorage.setItem('auth_tokens', JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          timestamp: Date.now()
        }))
        console.log('Auth callback: Tokens stored in localStorage')
      }
      
      // 관리자 페이지로 리다이렉트
      router.replace(`/${locale}/admin`)
    } else {
      console.log('Auth callback: No tokens found, redirecting to auth')
      router.replace(`/${locale}/auth?error=no_tokens`)
    }
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