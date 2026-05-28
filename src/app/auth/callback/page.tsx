'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { resolveOAuthCallbackLocale } from '@/lib/appOrigin'

function AuthCallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}

/** 구/폴백 URL(/auth/callback) → /{locale}/auth/callback (OAuth code·hash 유지) */
function AuthCallbackRedirect() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const locale = resolveOAuthCallbackLocale(searchParams?.get('locale'))
    const { search, hash } = window.location
    window.location.replace(`/${locale}/auth/callback${search}${hash}`)
  }, [searchParams])

  return <AuthCallbackLoading />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackRedirect />
    </Suspense>
  )
}
