'use client'

import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Calendar, UserCheck, LogIn, Home } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import UserProfile from './auth/UserProfile'
import { useAuth } from '@/contexts/AuthContext'

const Navigation = () => {
  const t = useTranslations('common')
  const pathname = usePathname()
  const locale = useLocale()
  const { user, userRole, loading } = useAuth()
  
  // Admin 페이지에서는 네비게이션을 숨김
  if (pathname.startsWith(`/${locale}/admin`)) {
    return null
  }

  return (
    <nav className="bg-white shadow-lg border-b relative z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* 로고 및 제목 */}
          <div className="flex items-center space-x-4">
            <Link href={`/${locale}`} className="flex items-center space-x-2">
              <h1 className="text-lg md:text-xl font-bold text-gray-800">
                {t('systemTitle')}
              </h1>
            </Link>
          </div>
          
          {/* 네비게이션 메뉴 */}
          <div className="flex items-center space-x-6">
            <Link 
              href={`/${locale}`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              홈
            </Link>
            <Link 
              href={`/${locale}/products`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Calendar className="w-4 h-4 mr-2" />
              상품
            </Link>
            <Link 
              href={`/${locale}/off-schedule`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Off 스케줄
            </Link>
            <LanguageSwitcher />
            
            {/* 인증 상태에 따른 메뉴 */}
            {loading ? (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            ) : user ? (
              <div className="flex items-center space-x-4">
                {/* 팀원/관리자인 경우 admin 페이지로 리다이렉트 */}
                {userRole && userRole !== 'customer' ? (
                  <Link
                    href={`/${locale}/admin`}
                    className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    관리자 페이지
                  </Link>
                ) : (
                  <UserProfile />
                )}
              </div>
            ) : (
              <Link
                href={`/${locale}/auth`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-2" />
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
