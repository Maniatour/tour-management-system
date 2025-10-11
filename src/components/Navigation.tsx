'use client'

declare global {
  interface Window {
    openGuideDocumentUpload?: (type: 'medical' | 'cpr') => void
  }
}

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, LogIn, Home, Menu, X, Settings, LogOut, ChevronDown, UserCheck, FileText, Shield, User } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import SunriseTime from './SunriseTime'
import { useAuth } from '@/contexts/AuthContext'

const Navigation = () => {
  const t = useTranslations('common')
  const pathname = usePathname()
  const locale = useLocale()
  const router = useRouter()
  const { user, userRole, loading, signOut, authUser } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  
  // Admin 페이지에서는 네비게이션을 숨김
  if (pathname.startsWith(`/${locale}/admin`)) {
    return null
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push(`/${locale}/auth`)
    } catch (error) {
      console.error('로그아웃 중 오류가 발생했습니다:', error)
    }
  }

  const handleUserMenuClick = () => {
    setIsUserMenuOpen(false)
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
              {t('home')}
            </Link>
            <Link 
              href={`/${locale}/products`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {t('products')}
            </Link>
            {/* 일출 시간 표시 */}
            <SunriseTime />
            <LanguageSwitcher />
            
            {/* 인증 상태에 따른 메뉴 */}
            {loading ? (
              <div className="flex items-center text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                Loading...
              </div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                {/* 사용자 드롭다운 메뉴 */}
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(authUser?.name || authUser?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {authUser?.name || authUser?.email?.split('@')[0] || t('user')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {userRole === 'admin' ? t('admin') : 
                         userRole === 'manager' ? t('manager') : 
                         userRole === 'team_member' ? t('teamMember') : t('customer')}
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {isUserMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      
                      {/* Dropdown */}
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                        <div className="py-1">
                          <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">
                              {authUser?.name || authUser?.email?.split('@')[0] || t('user')}
                            </p>
                            <p className="text-xs text-gray-500">{authUser?.email || t('noEmail')}</p>
                            {userRole && (
                              <p className="text-xs text-blue-600 font-medium mt-1">
                                {userRole === 'admin' ? t('admin') : 
                                 userRole === 'manager' ? t('manager') : 
                                 userRole === 'team_member' ? t('teamMember') : t('customer')}
                              </p>
                            )}
                          </div>
                          
                          {/* 고객용 메뉴 */}
                          {userRole === 'customer' && (
                            <>
                              <Link
                                href={`/${locale}/dashboard`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Home className="w-4 h-4 mr-2" />
                                내 대시보드
                              </Link>
                              <Link
                                href={`/${locale}/dashboard/profile`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <User className="w-4 h-4 mr-2" />
                                내 정보
                              </Link>
                              <Link
                                href={`/${locale}/dashboard/reservations`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                내 예약
                              </Link>
                            </>
                          )}
                          
                          {/* 관리자 페이지 링크 (관리자/매니저/팀원만) */}
                          {userRole && userRole !== 'customer' && (
                            <Link
                              href={`/${locale}/admin`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              {t('adminPage')}
                            </Link>
                          )}
                          
                          {/* 가이드 페이지 링크 (팀원만) */}
                          {userRole === 'team_member' && (
                            <Link
                              href={`/${locale}/guide`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              {t('guidePage')}
                            </Link>
                          )}
                          
                          {/* 문서 업로드 메뉴 (팀원만) */}
                          {userRole === 'team_member' && (
                            <>
                              <button
                                onClick={() => {
                                  handleUserMenuClick()
                                  if (typeof window !== 'undefined' && window.openGuideDocumentUpload) {
                                    window.openGuideDocumentUpload('medical')
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                {t('medicalReport')}
                              </button>
                              <button
                                onClick={() => {
                                  handleUserMenuClick()
                                  if (typeof window !== 'undefined' && window.openGuideDocumentUpload) {
                                    window.openGuideDocumentUpload('cpr')
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                {t('cprCertificate')}
                              </button>
                            </>
                          )}
                          
                          <div className="border-t border-gray-100 my-1"></div>
                          
                          <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            {t('logout')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Link
                href={`/${locale}/auth`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {t('login')}
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
                {t('home')}
              </Link>
              <Link 
                href={`/${locale}/products`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Calendar className="w-4 h-4 mr-3" />
                {t('products')}
              </Link>
              
              {/* 인증 상태에 따른 메뉴 */}
              {loading ? (
                <div className="flex items-center text-gray-600 px-2 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                  Loading...
                </div>
              ) : user ? (
                <div className="px-2 py-2 space-y-2">
                  {/* 사용자 정보 표시 */}
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(authUser?.name || authUser?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {authUser?.name || authUser?.email?.split('@')[0] || t('user')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {userRole === 'admin' ? t('admin') : 
                         userRole === 'manager' ? t('manager') : 
                         userRole === 'team_member' ? t('teamMember') : t('customer')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 고객용 메뉴 */}
                  {userRole === 'customer' && (
                    <>
                      <Link
                        href={`/${locale}/dashboard`}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Home className="w-4 h-4 mr-3" />
                        내 대시보드
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/profile`}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <User className="w-4 h-4 mr-3" />
                        내 정보
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/reservations`}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Calendar className="w-4 h-4 mr-3" />
                        내 예약
                      </Link>
                    </>
                  )}
                  
                  {/* 관리자 페이지 링크 (관리자/매니저/팀원만) */}
                  {userRole && userRole !== 'customer' && (
                    <Link
                      href={`/${locale}/admin`}
                      className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      {t('adminPage')}
                    </Link>
                  )}
                  
                  {/* 가이드 페이지 링크 (팀원만) */}
                  {userRole === 'team_member' && (
                    <Link
                      href={`/${locale}/guide`}
                      className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <UserCheck className="w-4 h-4 mr-3" />
                      {t('guidePage')}
                    </Link>
                  )}
                  
                  {/* 문서 업로드 메뉴 (팀원만) */}
                  {userRole === 'team_member' && (
                    <>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          if (typeof window !== 'undefined' && window.openGuideDocumentUpload) {
                            window.openGuideDocumentUpload('medical')
                          }
                        }}
                        className="flex items-center w-full text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                      >
                        <FileText className="w-4 h-4 mr-3" />
                        {t('medicalReport')}
                      </button>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          if (typeof window !== 'undefined' && window.openGuideDocumentUpload) {
                            window.openGuideDocumentUpload('cpr')
                          }
                        }}
                        className="flex items-center w-full text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                      >
                        <Shield className="w-4 h-4 mr-3" />
                        {t('cprCertificate')}
                      </button>
                    </>
                  )}
                  
                  {/* 로그아웃 버튼 */}
                  <button
                    onClick={() => {
                      handleLogout()
                      setIsMobileMenuOpen(false)
                    }}
                    className="flex items-center w-full text-gray-600 hover:text-red-600 transition-colors px-2 py-2"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <Link
                  href={`/${locale}/auth`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LogIn className="w-4 h-4 mr-3" />
                  {t('login')}
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
