'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  // locale 검증 (유효한 로케일만 허용)
  const validLocale = (locale === 'ko' || locale === 'en') ? locale : 'ko'

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback for locale:', validLocale)
        
        // 짧은 대기 후 즉시 리다이렉트 (Supabase가 자동으로 처리하도록 함)
        setTimeout(() => {
          console.log('Auth callback: Redirecting to main page')
          router.replace(`/${validLocale}`)
        }, 500)
        
      } catch (error) {
        console.error('Auth callback: Unexpected error:', error)
        router.replace(`/${validLocale}/auth?error=unexpected_error`)
      }
    }

    handleAuthCallback()
  }, [router, validLocale])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}