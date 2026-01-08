'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [error, setError] = useState<string | null>(null)

  // locale 검증 (유효한 로케일만 허용)
  const validLocale = (locale === 'ko' || locale === 'en') ? locale : 'ko'

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback for locale:', validLocale)
        
        // 클라이언트 사이드에서만 실행
        if (typeof window === 'undefined') {
          return
        }

        const supabase = createClientSupabase()
        
        // URL에서 세션 정보 확인 (Supabase가 자동으로 처리)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Auth callback: Session error:', sessionError)
          setError(sessionError.message)
          setTimeout(() => {
            router.replace(`/${validLocale}/auth?error=session_error`)
          }, 2000)
          return
        }

        if (session?.user) {
          console.log('Auth callback: User authenticated successfully:', session.user.email)
          // 성공적으로 로그인된 경우 메인 페이지로 리다이렉트
          setTimeout(() => {
            router.replace(`/${validLocale}`)
          }, 500)
        } else {
          console.warn('Auth callback: No session found, checking URL hash/query')
          
          // URL 해시나 쿼리 파라미터에서 토큰 확인
          const hash = window.location.hash
          const searchParams = new URLSearchParams(window.location.search)
          
          // Supabase는 자동으로 URL의 토큰을 처리하므로 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // 다시 세션 확인
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          
          if (retrySession?.user) {
            console.log('Auth callback: Session found after retry')
            router.replace(`/${validLocale}`)
          } else {
            console.error('Auth callback: No session after retry')
            setError('로그인에 실패했습니다. 다시 시도해주세요.')
            setTimeout(() => {
              router.replace(`/${validLocale}/auth?error=no_session`)
            }, 2000)
          }
        }
        
      } catch (err) {
        console.error('Auth callback: Unexpected error:', err)
        const errorMessage = err instanceof Error ? err.message : '예상치 못한 오류가 발생했습니다'
        setError(errorMessage)
        setTimeout(() => {
          router.replace(`/${validLocale}/auth?error=unexpected_error`)
        }, 2000)
      }
    }

    handleAuthCallback()
  }, [router, validLocale])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            '로그인 처리 중...'
          )}
        </p>
      </div>
    </div>
  )
}