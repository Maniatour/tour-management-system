'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import LoginForm from '@/components/auth/LoginForm'
import SignUpForm from '@/components/auth/SignUpForm'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'

type AuthMode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const t = useTranslations()
  const [mode, setMode] = useState<AuthMode>('login')
  const { user, userRole, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // 현재 로케일 추출 (유효한 로케일만 허용)
  const currentLocale = (() => {
    const segments = (pathname || '/').split('/').filter(Boolean)
    const locale = segments[0]
    // 'ko' 또는 'en'만 허용, 그 외는 기본값 'ko' 사용
    return (locale === 'ko' || locale === 'en') ? locale : 'ko'
  })()

  // redirectToParam 검증 및 기본값 설정
  const redirectToParam = (() => {
    const redirectTo = searchParams?.get('redirectTo')
    // redirectTo가 있고 유효한 경로인 경우
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.includes('undefined')) {
      return redirectTo
    }
    // 기본값: 현재 로케일의 홈페이지
    return `/${currentLocale}`
  })()

  useEffect(() => {
    // 로딩이 완료되고 사용자가 있지만 userRole이 아직 없는 경우 잠시 대기
    if (!loading && user && !userRole) {
      console.log('Auth page: User logged in but role not yet determined, waiting...')
      return
    }
    
    if (!loading && user && userRole) {
      console.log('Auth page: User logged in, role:', userRole, 'redirecting to:', redirectToParam)
      
      // redirectToParam 검증
      if (!redirectToParam || redirectToParam.includes('undefined') || redirectToParam.includes('/auth')) {
        console.log('Auth page: Invalid redirectToParam, redirecting to home instead')
        router.replace(`/${currentLocale}`)
        return
      }
      
      // redirectToParam이 유효한 경로인지 확인
      if (!redirectToParam.startsWith('/')) {
        console.log('Auth page: Invalid redirectToParam format, redirecting to home instead')
        router.replace(`/${currentLocale}`)
        return
      }
      
      // redirectToParam으로 리다이렉트
      console.log('Auth page: Redirecting to:', redirectToParam)
      router.replace(redirectToParam)
    }
  }, [user, userRole, loading, router, redirectToParam, currentLocale])

  if (loading || (user && !userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user && userRole) {
    return null
  }

  const handleSuccess = () => {
    // redirectToParam 검증 후 리다이렉트
    const targetPath = (redirectToParam && !redirectToParam.includes('undefined') && redirectToParam.startsWith('/')) 
      ? redirectToParam 
      : `/${currentLocale}`
    router.push(targetPath)
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
              {t('auth.forgotPassword')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}