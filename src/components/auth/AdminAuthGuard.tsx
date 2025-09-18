'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface AdminAuthGuardProps {
  children: React.ReactNode
  locale: string
}

export default function AdminAuthGuard({ children, locale }: AdminAuthGuardProps) {
  const { user, userRole, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
        console.log('AdminAuthGuard: No user, redirecting to auth')
        router.replace(`/${locale}/auth?redirectTo=/${locale}/admin`)
      } else if (userRole === 'customer') {
        // 고객인 경우 홈으로 리다이렉트
        console.log('AdminAuthGuard: Customer user, redirecting to home')
        router.replace(`/${locale}`)
      }
    }
  }, [user, userRole, loading, router, locale])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user || userRole === 'customer') {
    return null
  }

  return <>{children}</>
}
