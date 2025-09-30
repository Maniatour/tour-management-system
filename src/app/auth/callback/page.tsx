'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback')
        
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
        
        // Supabase가 자동으로 URL의 토큰을 처리하도록 함
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback: Error getting session:', error)
          router.replace(`/${locale}/auth?error=session_error`)
          return
        }
        
        if (data.session?.user) {
          console.log('Auth callback: User authenticated:', data.session.user.email)
          // 잠시 후 AuthContext가 로드되도록 대기
          setTimeout(() => {
            // 사용자 역할에 따라 적절한 페이지로 리다이렉트
            const userEmail = data.session.user.email?.toLowerCase()
            
            // 슈퍼관리자 이메일 확인 (무조건 admin 페이지)
            const superAdminEmails = ['info@maniatour.com', 'wooyong.shim09@gmail.com']
            if (userEmail && superAdminEmails.includes(userEmail)) {
              router.replace(`/${locale}/admin`)
            } else {
              // 일반 사용자는 AuthContext에서 역할 확인 후 적절한 페이지로 리다이렉트됨
              // 투어 가이드는 /guide로, 나머지(매니저, op, admin, super 등)는 /admin으로
              router.replace(`/${locale}/guide`)
            }
          }, 100)
        } else {
          console.log('Auth callback: No session found')
          router.replace(`/${locale}/auth?error=no_session`)
        }
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