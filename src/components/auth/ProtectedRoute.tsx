'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserPermissions } from '@/lib/roles'
import { useRouter, usePathname } from 'next/navigation'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: keyof UserPermissions
  fallback?: ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission,
  fallback,
  redirectTo = '/'
}: ProtectedRouteProps) {
  const { user, userRole, loading, hasPermission, isSimulating, simulatedUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const localeFromPath = (() => {
    const segment = pathname?.split('/').filter(Boolean)[0]
    return segment === 'ko' || segment === 'en' ? segment : 'ko'
  })()

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole

  useEffect(() => {
    if (loading) return

    // 로그인하지 않은 경우 (시뮬레이션 중이 아닌 경우에만)
    if (!currentUser && !isSimulating) {
      router.push(`/${localeFromPath}/auth`)
      return
    }

    // 권한이 필요한 경우
    if (requiredPermission && currentUserRole && !hasPermission(requiredPermission)) {
      if (fallback) return
      router.push(redirectTo)
      return
    }
  }, [currentUser, currentUserRole, requiredPermission, loading, router, fallback, redirectTo, hasPermission, isSimulating])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentUser && !isSimulating) {
    return null
  }

  if (requiredPermission && currentUserRole && !hasPermission(requiredPermission)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return null
  }

  return <>{children}</>
}
