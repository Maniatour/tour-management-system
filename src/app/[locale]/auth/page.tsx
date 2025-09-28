'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import SignUpForm from '@/components/auth/SignUpForm'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'

type AuthMode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const { user, userRole, loading, getRedirectPath } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // 현재 로케일 추출
  const currentLocale = (() => {
    const segments = (pathname || '/').split('/').filter(Boolean)
    return segments[0] || 'ko'
  })()

  const redirectToParam = searchParams?.get('redirectTo') || `/${currentLocale}`

  useEffect(() => {
    if (!loading && user && userRole) {
      console.log('Auth page: User logged in, role:', userRole, 'redirecting to:', redirectToParam)
      
      // redirectToParam이 auth 페이지를 가리키는 경우 무한 루프 방지
      if (redirectToParam.includes('/auth')) {
        console.log('Auth page: RedirectTo points to auth page, redirecting to admin instead')
        router.replace(`/${currentLocale}/admin`)
        return
      }
      
      // AuthContext의 getRedirectPath 함수를 사용하여 올바른 경로로 리다이렉트
      const redirectPath = getRedirectPath(currentLocale)
      console.log('Auth page: Redirecting to:', redirectPath)
      router.replace(redirectPath)
    }
  }, [user, userRole, loading, router, redirectToParam, currentLocale, getRedirectPath])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const handleSuccess = () => {
    router.push(redirectToParam)
  }

  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToSignUp={() => setMode('signup')}
          />
        )
      case 'signup':
        return (
          <SignUpForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )
      case 'reset':
        return (
          <ResetPasswordForm
            onBack={() => setMode('login')}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {renderForm()}
        
        {mode === 'login' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setMode('reset')}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        )}
      </div>
    </div>
  )
}