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
  const { user, userRole, permissions, loading, hasPermission } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // 로그인하지 않은 경우
    if (!user) {
      router.push('/ko/auth')
      return
    }

    // 권한이 필요한 경우
    if (requiredPermission && userRole && !hasPermission(requiredPermission)) {
      if (fallback) return
      router.push(redirectTo)
      return
    }
  }, [user, userRole, requiredPermission, loading, router, fallback, redirectTo, hasPermission])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requiredPermission && userRole && !hasPermission(requiredPermission)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return null
  }

  return <>{children}</>
}
