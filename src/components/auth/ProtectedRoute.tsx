'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserPermissions } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: keyof UserPermissions
  fallback?: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission,
  fallback,
  redirectTo = '/'
}: ProtectedRouteProps) {
  const { user, userRole, permissions, loading, hasPermission, isSimulating, simulatedUser } = useAuth()
  const router = useRouter()

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole

  useEffect(() => {
    if (loading) return

    // 로그인하지 않은 경우 (시뮬레이션 중이 아닌 경우에만)
    if (!currentUser && !isSimulating) {
      router.push('/ko/auth')
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
