'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface AdminAuthGuardProps {
  children: React.ReactNode
  locale: string
}

export default function AdminAuthGuard({ children, locale }: AdminAuthGuardProps) {
  const { user, userRole, userPosition, loading, isInitialized, isSimulating, simulatedUser } = useAuth()
  const router = useRouter()

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
  const currentUserPosition = isSimulating && simulatedUser ? simulatedUser.position : userPosition

  // 디버깅을 위한 로깅
  console.log('AdminAuthGuard - 상태:', {
    user: user?.email,
    userRole,
    loading,
    isInitialized,
    hasUser: !!user,
    isCustomer: userRole === 'customer',
    isSimulating,
    simulatedUser: simulatedUser?.email,
    currentUser: currentUser?.email,
    currentUserRole
  })

  useEffect(() => {
    // 로딩 중이거나 초기화되지 않은 경우 리다이렉트하지 않음
    if (loading || !isInitialized) {
      console.log('AdminAuthGuard: Still loading or not initialized, not redirecting')
      return
    }
    
    // currentUser가 없는 경우 (로그인하지 않은 상태)
    if (!currentUser) {
      console.log('AdminAuthGuard: No currentUser, redirecting to home')
      router.replace(`/${locale}`)
      return
    }
    
    // customer 역할인 경우 리다이렉트
    if (currentUserRole === 'customer') {
      console.log('AdminAuthGuard: Customer role, redirecting to home')
      router.replace(`/${locale}`)
      return
    }
    
    // tour guide나 driver인 경우 리다이렉트
    if (currentUserPosition && (currentUserPosition.toLowerCase() === 'tour guide' || currentUserPosition.toLowerCase() === 'driver')) {
      console.log('AdminAuthGuard: Tour guide or driver position, redirecting to guide page')
      router.replace(`/${locale}/guide`)
      return
    }
  }, [currentUser, currentUserRole, currentUserPosition, isInitialized, loading, router, locale])

  // SSR 호환성을 위해 초기 로딩 상태 처리
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // 클라이언트가 마운트되기 전까지는 로딩 표시
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  // 로딩 중이거나 초기화되지 않은 경우 로딩 표시
  if (!isInitialized || loading) {
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

  // currentUser가 없는 경우 (로그인하지 않은 상태)
  if (!currentUser) {
    console.log('AdminAuthGuard: No currentUser, showing access denied')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600 mb-6">이 페이지에 접근하려면 로그인해야 합니다.</p>
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

  if (currentUserRole === 'customer') {
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

  // tour guide나 driver인 경우 리다이렉트
  if (currentUserPosition && (currentUserPosition.toLowerCase() === 'tour guide' || currentUserPosition.toLowerCase() === 'driver')) {
    console.log('AdminAuthGuard: Tour guide or driver position, redirecting to guide page')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">투어 가이드와 드라이버는 관리자 페이지에 접근할 수 없습니다.</p>
          <button
            onClick={() => router.push(`/${locale}/guide`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            가이드 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  console.log('AdminAuthGuard: Access granted, rendering children')
  return <>{children}</>
}