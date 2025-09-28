'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Calendar, CalendarOff, MessageSquare, Camera, FileText } from 'lucide-react'

interface GuideLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export default function GuideLayout({ children, params }: GuideLayoutProps) {
  const { user, userRole, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    console.log('GuideLayout: useEffect triggered', { 
      isLoading, 
      user: !!user, 
      userRole, 
      userEmail: user?.email
    })
    
    if (!isLoading) {
      console.log('GuideLayout: Auth check completed', { user: !!user, userRole, isLoading })
      
      // 관리자, 매니저, 투어 가이드가 아닌 경우 접근 차단
      if (!user || !['admin', 'manager', 'team_member'].includes(userRole || '')) {
        console.log('GuideLayout: Access denied, redirecting to auth')
        router.push('/ko/auth')
        return
      }
      
      console.log('GuideLayout: Access granted - staying on guide page')
    }
  }, [user, userRole, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user || !['admin', 'manager', 'team_member'].includes(userRole || '')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-4">
            관리자, 매니저, 또는 투어 가이드만 이 페이지에 접근할 수 있습니다.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left">
            <p className="text-sm text-gray-700">
              <strong>현재 상태:</strong><br/>
              사용자: {user ? user.email : '로그인되지 않음'}<br/>
              역할: {userRole || '역할 없음'}<br/>
              로딩: {isLoading ? '로딩 중' : '완료'}
            </p>
          </div>
          <button 
            onClick={() => router.push('/ko/auth')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-0 sm:px-2 lg:px-4 py-4 sm:py-8 pb-20 sm:pb-8">
        {children}
      </main>

      {/* 모바일 푸터 네비게이션 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-50">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => router.push('/ko/guide/tours?view=calendar')}
            className={`flex flex-col items-center py-2 px-3 transition-colors ${
              pathname.includes('/guide/tours') && pathname.includes('calendar')
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <Calendar className="w-5 h-5 mb-1" />
            <span className="text-xs">투어</span>
          </button>
          
          <button
            onClick={() => router.push('/ko/off-schedule')}
            className={`flex flex-col items-center py-2 px-3 transition-colors ${
              pathname.includes('/off-schedule')
                ? 'text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <CalendarOff className="w-5 h-5 mb-1" />
            <span className="text-xs">OFF</span>
          </button>
          
          <button
            onClick={() => router.push('/ko/guide/tours')}
            className={`flex flex-col items-center py-2 px-3 transition-colors ${
              pathname.includes('/guide/tours') && !pathname.includes('calendar')
                ? 'text-green-600'
                : 'text-gray-600 hover:text-green-600'
            }`}
          >
            <MessageSquare className="w-5 h-5 mb-1" />
            <span className="text-xs">채팅</span>
          </button>
          
          <button
            onClick={() => router.push('/ko/guide/tours')}
            className={`flex flex-col items-center py-2 px-3 transition-colors ${
              pathname.includes('/guide/tours') && pathname.includes('photos')
                ? 'text-orange-600'
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Camera className="w-5 h-5 mb-1" />
            <span className="text-xs">사진</span>
          </button>
          
          <button
            onClick={() => router.push('/ko/guide/tours')}
            className={`flex flex-col items-center py-2 px-3 transition-colors ${
              pathname.includes('/guide/tours') && pathname.includes('report')
                ? 'text-red-600'
                : 'text-gray-600 hover:text-red-600'
            }`}
          >
            <FileText className="w-5 h-5 mb-1" />
            <span className="text-xs">리포트</span>
          </button>
        </div>
      </footer>
    </div>
  )
}
