'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Calendar, UserCheck, LogIn, Home, Menu, X } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import UserProfile from './auth/UserProfile'
import { useAuth } from '@/contexts/AuthContext'

const Navigation = () => {
  const t = useTranslations('common')
  const pathname = usePathname()
  const locale = useLocale()
  const { user, userRole, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
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
          
          {/* 데스크톱 네비게이션 메뉴 */}
          <div className="hidden md:flex items-center space-x-6">
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
              <div className="flex items-center text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                로딩 중...
              </div>
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

          {/* 모바일 메뉴 버튼 */}
          <div className="md:hidden flex items-center space-x-2">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-4">
              <Link 
                href={`/${locale}`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Home className="w-4 h-4 mr-3" />
                홈
              </Link>
              <Link 
                href={`/${locale}/products`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Calendar className="w-4 h-4 mr-3" />
                상품
              </Link>
              <Link 
                href={`/${locale}/off-schedule`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <UserCheck className="w-4 h-4 mr-3" />
                Off 스케줄
              </Link>
              
              {/* 인증 상태에 따른 메뉴 */}
              {loading ? (
                <div className="flex items-center text-gray-600 px-2 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                  로딩 중...
                </div>
              ) : user ? (
                <div className="px-2 py-2">
                  {/* 팀원/관리자인 경우 admin 페이지로 리다이렉트 */}
                  {userRole && userRole !== 'customer' ? (
                    <Link
                      href={`/${locale}/admin`}
                      className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <UserCheck className="w-4 h-4 mr-3" />
                      관리자 페이지
                    </Link>
                  ) : (
                    <UserProfile />
                  )}
                </div>
              ) : (
                <Link
                  href={`/${locale}/auth`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LogIn className="w-4 h-4 mr-3" />
                  로그인
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navigation
