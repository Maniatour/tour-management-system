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
  const { user, userRole, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // 현재 로케일 추출 (/ko, /en, /ja, /ko-KR 등 첫 세그먼트)
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
        const pathSegments = (pathname || '/').split('/').filter(Boolean)
        const locale = pathSegments[0] || 'ko'
        router.replace(`/${locale}/admin`)
        return
      }
      
      // 관리자/팀원인 경우 관리자 페이지로, 그 외에는 redirectToParam으로
      if (userRole !== 'customer') {
        console.log('Auth page: Admin user, redirecting to admin page')
        const pathSegments = (pathname || '/').split('/').filter(Boolean)
        const locale = pathSegments[0] || 'ko'
        router.replace(`/${locale}/admin`)
      } else {
        console.log('Auth page: Customer user, redirecting to home')
        router.replace(redirectToParam)
      }
    }
  }, [user, userRole, loading, router, redirectToParam, pathname])

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
