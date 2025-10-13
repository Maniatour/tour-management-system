'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface AdminAuthGuardProps {
  children: React.ReactNode
  locale: string
}

export default function AdminAuthGuard({ children, locale }: AdminAuthGuardProps) {
  const { user, userRole, loading, isInitialized } = useAuth()
  const router = useRouter()

  // 디버깅을 위한 로깅
  console.log('AdminAuthGuard - 상태:', {
    user: user?.email,
    userRole,
    loading,
    isInitialized,
    hasUser: !!user,
    isCustomer: userRole === 'customer'
  })

  useEffect(() => {
    // isInitialized가 true이고 user가 undefined인 경우 잠시 기다림
    if (isInitialized && !user) {
      console.log('AdminAuthGuard: Initialized but no user yet, waiting...')
      return
    }
    
    if (isInitialized && user) {
      if (userRole === 'customer') {
        console.log('AdminAuthGuard: Customer role, redirecting to home')
        router.replace(`/${locale}`)
      }
    }
  }, [user, userRole, isInitialized, router, locale])

  // isInitialized가 false이거나 user가 undefined인 경우 로딩 표시
  if (!isInitialized || !user) {
    console.log('AdminAuthGuard: Not ready, showing loading')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  if (userRole === 'customer') {
    console.log('AdminAuthGuard: No access, showing access denied')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">이 페이지에 접근하려면 팀 멤버여야 합니다.</p>
          <button
            onClick={() => router.push(`/${locale}/auth`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  console.log('AdminAuthGuard: Access granted, rendering children')
  return <>{children}</>
}