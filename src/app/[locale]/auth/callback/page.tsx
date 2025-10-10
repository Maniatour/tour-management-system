'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AuthCallbackPageProps {
  params: {
    locale: string
  }
}

export default function AuthCallbackPage({ params }: AuthCallbackPageProps) {
  const router = useRouter()
  const { locale } = params

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback for locale:', locale)
        
        // 짧은 대기 후 즉시 리다이렉트 (Supabase가 자동으로 처리하도록 함)
        setTimeout(() => {
          console.log('Auth callback: Redirecting to main page')
          router.replace(`/${locale}`)
        }, 500)
        
      } catch (error) {
        console.error('Auth callback: Unexpected error:', error)
        router.replace(`/${locale}/auth?error=unexpected_error`)
      }
    }

    handleAuthCallback()
  }, [router, locale])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}