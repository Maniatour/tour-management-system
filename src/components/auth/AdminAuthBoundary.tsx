'use client'

import type { ReactNode } from 'react'
import { useContext } from 'react'
import { AuthContext, AuthProvider } from '@/contexts/AuthContext'

/**
 * Admin 라우트: 루트 `AuthProvider`가 HMR/오류 복구 중 일시적으로 빠진 경우에만
 * 로컬 `AuthProvider`로 감싼다. 정상 시에는 중복 Provider를 만들지 않는다.
 */
export default function AdminAuthBoundary({ children }: { children: ReactNode }) {
  const parentAuth = useContext(AuthContext)
  if (parentAuth !== undefined) {
    return <>{children}</>
  }
  return <AuthProvider>{children}</AuthProvider>
}
