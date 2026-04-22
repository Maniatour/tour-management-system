'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface AdminAuthGuardProps {
  children: React.ReactNode
  locale: string
}

export default function AdminAuthGuard({ children, locale }: AdminAuthGuardProps) {
  const { user, userRole, userPosition, loading, isInitialized, isSimulating, simulatedUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  // 새로고침 후 복귀할 경로 (로그인 시 이 경로로 돌아감)
  const redirectToPath = pathname && pathname !== `/${locale}/auth` ? pathname : `/${locale}`

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
  const currentUserPosition = isSimulating && simulatedUser ? simulatedUser.position : userPosition

  const lastLogRef = useRef<string>('')
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const key = `${user?.email}|${userRole}|${loading}|${isInitialized}|${isSimulating}`
    if (key === lastLogRef.current) return
    lastLogRef.current = key
    console.log('AdminAuthGuard', { user: user?.email, userRole, loading, isInitialized, isSimulating })
  }, [user?.email, userRole, loading, isInitialized, isSimulating])

  useEffect(() => {
    if (loading || !isInitialized) {
      return
    }

    if (!currentUser) {
      router.replace(`/${locale}`)
      return
    }

    if (currentUserRole === 'customer') {
      router.replace(`/${locale}`)
      return
    }

    if (
      currentUserPosition &&
      (currentUserPosition.toLowerCase() === 'tour guide' ||
        currentUserPosition.toLowerCase() === 'driver')
    ) {
      router.replace(`/${locale}/guide`)
      return
    }
  }, [currentUser, currentUserRole, currentUserPosition, isInitialized, loading, router, locale, redirectToPath])

  // 초기화 전·역할 조회 전: 전체 스피너만 (refreshSession을 기다리지 않도록 AuthContext에서 이미 최적화됨)
  const showBlockingAuth =
    !isInitialized || (loading && !user) || (loading && userRole === null && !isSimulating)

  if (showBlockingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">이 페이지에 접근하려면 팀 멤버여야 합니다.</p>
          <button
            onClick={() => router.push(`/${locale}/auth?redirectTo=${encodeURIComponent(redirectToPath)}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  if (currentUserPosition && (currentUserPosition.toLowerCase() === 'tour guide' || currentUserPosition.toLowerCase() === 'driver')) {
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

  return <>{children}</>
}