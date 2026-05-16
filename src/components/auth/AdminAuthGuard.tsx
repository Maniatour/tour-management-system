'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const AUTH_GUARD_FAILSAFE_MS = 20_000

interface AdminAuthGuardProps {
  children: React.ReactNode
  locale: string
}

export default function AdminAuthGuard({ children, locale }: AdminAuthGuardProps) {
  const { user, userRole, userPosition, loading, isInitialized, isSimulating, simulatedUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirectToPath = pathname && pathname !== `/${locale}/auth` ? pathname : `/${locale}`

  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
  const currentUserPosition = isSimulating && simulatedUser ? simulatedUser.position : userPosition

  const [authTimedOut, setAuthTimedOut] = useState(false)

  useEffect(() => {
    if (!loading && isInitialized) {
      setAuthTimedOut(false)
      return
    }
    const timer = setTimeout(() => {
      if (!isInitialized || loading) setAuthTimedOut(true)
    }, AUTH_GUARD_FAILSAFE_MS)
    return () => clearTimeout(timer)
  }, [loading, isInitialized])

  const lastLogRef = useRef<string>('')
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const key = `${user?.email}|${userRole}|${loading}|${isInitialized}|${isSimulating}`
    if (key === lastLogRef.current) return
    lastLogRef.current = key
    console.log('AdminAuthGuard', { user: user?.email, userRole, loading, isInitialized, isSimulating })
  }, [user?.email, userRole, loading, isInitialized, isSimulating])

  useEffect(() => {
    if (loading || !isInitialized) return

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

  const showBlockingAuth =
    !authTimedOut &&
    (!isInitialized || (loading && !user) || (loading && userRole === null && !isSimulating))

  if (showBlockingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">{'\uC778\uC99D \uD655\uC778 \uC911...'}</p>
        </div>
      </div>
    )
  }

  if (authTimedOut && (!currentUser || currentUserRole === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {'\uC778\uC99D \uC751\uB2F5\uC774 \uC9C0\uC5F0\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4'}
          </h1>
          <p className="text-gray-600 mb-6 text-sm">
            {
              '\uB124\uD2B8\uC6CC\uD06C\uAC00 \uB290\uB9AC\uAC70\uB098 \uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.'
            }
          </p>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/auth?redirectTo=${encodeURIComponent(redirectToPath)}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {'\uB85C\uADF8\uC778 \uD398\uC774\uC9C0\uB85C \uC774\uB3D9'}
          </button>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{'\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4'}</h1>
          <p className="text-gray-600 mb-6">
            {'\uC774 \uD398\uC774\uC9C0\uC5D0 \uC811\uADFC\uD558\uB824\uBA74 \uB85C\uADF8\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/auth`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {'\uB85C\uADF8\uC778 \uD398\uC774\uC9C0\uB85C \uC774\uB3D9'}
          </button>
        </div>
      </div>
    )
  }

  if (currentUserRole === 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{'\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</h1>
          <p className="text-gray-600 mb-6">
            {'\uC774 \uD398\uC774\uC9C0\uC5D0 \uC811\uADFC\uD558\uB824\uBA74 \uD300 \uBA64\uBC84\uC5EC\uC57C \uD569\uB2C8\uB2E4.'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/auth?redirectTo=${encodeURIComponent(redirectToPath)}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {'\uB85C\uADF8\uC778 \uD398\uC774\uC9C0\uB85C \uC774\uB3D9'}
          </button>
        </div>
      </div>
    )
  }

  if (
    currentUserPosition &&
    (currentUserPosition.toLowerCase() === 'tour guide' || currentUserPosition.toLowerCase() === 'driver')
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{'\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</h1>
          <p className="text-gray-600 mb-6">
            {
              '\uD22C\uC5B4 \uAC00\uC774\uB4DC\uC640 \uB4DC\uB77C\uC774\uBC84\uB294 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0 \uC811\uADFC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'
            }
          </p>
          <button
            onClick={() => router.push(`/${locale}/guide`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {'\uAC00\uC774\uB4DC \uD398\uC774\uC9C0\uB85C \uC774\uB3D9'}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
