'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { completeOAuthCallback } from '@/lib/authCallback'

const CALLBACK_FAILSAFE_MS = 18_000

function detectLocale(): string {
  if (typeof window === 'undefined') return 'ko'
  const saved = localStorage.getItem('preferred-locale')
  if (saved === 'en' || saved === 'ko') return saved
  const browserLang = navigator.language || ''
  return browserLang.startsWith('en') ? 'en' : 'ko'
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const locale = detectLocale()
    const redirectTo = `/${locale}`

    const finish = (path: string) => {
      if (cancelled || finishedRef.current) return
      finishedRef.current = true
      router.replace(path)
    }

    const fail = (message: string, query: string) => {
      if (cancelled || finishedRef.current) return
      finishedRef.current = true
      setError(message)
      setTimeout(() => {
        router.replace(`/${locale}/auth?error=${encodeURIComponent(query)}`)
      }, 1500)
    }

    const failsafe = setTimeout(() => {
      if (finishedRef.current) return
      fail('로그인 처리 시간이 초과되었습니다. 다시 시도해 주세요.', 'callback_timeout')
    }, CALLBACK_FAILSAFE_MS)

    void (async () => {
      try {
        const supabase = createClientSupabase()
        const result = await completeOAuthCallback(supabase)

        if (cancelled || finishedRef.current) return

        if (result.ok) {
          finish(redirectTo)
          return
        }

        fail(
          result.error === 'no_session'
            ? '로그인에 실패했습니다. 다시 시도해 주세요.'
            : result.error,
          result.error === 'no_session' ? 'no_session' : 'callback_error'
        )
      } catch (err) {
        console.error('Auth callback: Unexpected error:', err)
        fail('예상치 못한 오류가 발생했습니다.', 'unexpected_error')
      } finally {
        clearTimeout(failsafe)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(failsafe)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">
          {error ? <span className="text-red-600">{error}</span> : '로그인 처리 중...'}
        </p>
      </div>
    </div>
  )
}
