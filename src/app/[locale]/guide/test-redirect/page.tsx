'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function TestRedirectPage() {
  const { user, userRole, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('TestRedirectPage: Component mounted')
    console.log('TestRedirectPage: Auth state', { user: !!user, userRole, isLoading })
    
    // 5초 후에 현재 상태를 로그로 출력
    const timer = setTimeout(() => {
      console.log('TestRedirectPage: After 5 seconds', { 
        user: !!user, 
        userRole, 
        isLoading,
        currentPath: window.location.pathname
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [user, userRole, isLoading])

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">리다이렉트 테스트 페이지</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">현재 상태</h2>
        <div className="space-y-2">
          <p><strong>로딩 중:</strong> {isLoading ? '예' : '아니오'}</p>
          <p><strong>사용자:</strong> {user ? user.email : '없음'}</p>
          <p><strong>사용자 역할:</strong> {userRole || '없음'}</p>
          <p><strong>현재 경로:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</p>
        </div>
        
        <div className="mt-6">
          <p className="text-sm text-gray-600">
            이 페이지는 5초 동안 유지됩니다. 브라우저 개발자 도구 콘솔을 확인하세요.
          </p>
        </div>
      </div>
    </div>
  )
}
