'use client'

declare global {
  interface Window {
    openGuideDocumentUpload?: (type: 'medical' | 'cpr') => void
  }
}

import React, { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, LogIn, Home, Menu, X, Settings, LogOut, ChevronDown, UserCheck, FileText, Shield, User, ArrowLeft, Search } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import { useAuth } from '@/contexts/AuthContext'
import { CartIcon, CartSidebar } from '@/components/cart/CartProvider'

const NavigationContent = () => {
  const t = useTranslations('common')
  const pathname = usePathname()
  const locale = useLocale()
  const router = useRouter()
  const { userRole, loading, signOut, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  
  // 시뮬레이션 상태에서 현재 사용자와 역할 결정
  const currentUser = isSimulating && simulatedUser ? simulatedUser : authUser
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showCart, setShowCart] = useState(false)
  
  // Admin 페이지에서는 네비게이션을 숨김
  if (pathname.startsWith(`/${locale}/admin`)) {
    return null
  }

  // 상품 관련 페이지인지 확인
  const isProductPage = pathname.includes('/products')

  const handleLogout = async () => {
    try {
      await signOut()
      router.push(`/${locale}/auth`)
    } catch (error) {
      console.error(t('logoutError'), error)
    }
  }

  const handleUserMenuClick = () => {
    setIsUserMenuOpen(false)
  }

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      // 약간의 지연을 두고 페이지 이동
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error(t('simulationStopError'), error)
      // 오류가 발생해도 관리자 페이지로 이동
      router.push(`/${locale}/admin`)
    }
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
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  시뮬레이션: {simulatedUser.name_ko}
                </div>
                <button
                  onClick={handleStopSimulation}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  관리자로 돌아가기
                </button>
              </div>
            )}
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
            <Link 
              href={`/${locale}/products/tags`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="w-4 h-4 mr-2">🏷️</span>
              태그별 모아보기
            </Link>
            <Link 
              href={`/${locale}/reservation-check`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Search className="w-4 h-4 mr-2" />
              예약 확인
            </Link>
            <LanguageSwitcher />
            
            {/* 인증 상태에 따른 메뉴 */}
            {loading ? (
              <div className="flex items-center text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                Loading...
              </div>
            ) : currentUser ? (
              <div className="flex items-center space-x-4">
                {/* 상품 페이지에서만 장바구니 아이콘 표시 */}
                {isProductPage && (
                  <CartIcon onClick={() => setShowCart(true)} />
                )}
                {/* 사용자 드롭다운 메뉴 */}
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {((currentUser as any)?.name_ko || (currentUser as any)?.name_en || (currentUser as any)?.name || currentUser?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {(currentUser as any)?.name_ko || (currentUser as any)?.name_en || (currentUser as any)?.name || currentUser?.email?.split('@')[0] || t('user')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentUserRole === 'admin' ? t('admin') : 
                         currentUserRole === 'manager' ? t('manager') : 
                         currentUserRole === 'team_member' ? t('teamMember') : t('customer')}
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
                              {(currentUser as any)?.name_ko || (currentUser as any)?.name_en || (currentUser as any)?.name || currentUser?.email?.split('@')[0] || t('user')}
                            </p>
                            <p className="text-xs text-gray-500">{currentUser?.email || t('noEmail')}</p>
                            {currentUserRole && (
                              <p className="text-xs text-blue-600 font-medium mt-1">
                                {currentUserRole === 'admin' ? t('admin') : 
                                 currentUserRole === 'manager' ? t('manager') : 
                                 currentUserRole === 'team_member' ? t('teamMember') : t('customer')}
                              </p>
                            )}
                          </div>
                          
                          {/* 페이지 이동 메뉴 */}
                          <div className="px-4 py-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                              페이지 이동
                            </p>
                            
                            {/* 홈페이지 */}
                            <Link
                              href={`/${locale}`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <Home className="w-4 h-4 mr-2" />
                              홈페이지
                            </Link>
                            
                            {/* 고객 페이지 (모든 사용자) */}
                            <Link
                              href={`/${locale}/dashboard`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <User className="w-4 h-4 mr-2" />
                              고객 페이지
                            </Link>
                            
                            {/* 관리자 페이지 (관리자/매니저/팀원) */}
                            {currentUserRole && currentUserRole !== 'customer' && (
                              <Link
                                href={`/${locale}/admin`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                관리자 페이지
                              </Link>
                            )}
                            
                            {/* 가이드 페이지 (팀원만) */}
                            {currentUserRole === 'team_member' && (
                              <Link
                                href={`/${locale}/guide`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                가이드 페이지
                              </Link>
                            )}
                          </div>
                          
                          {/* 개인 메뉴 (고객용) */}
                          {currentUserRole === 'customer' && (
                            <>
                              <div className="px-4 py-2 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                  {t('myInfo')}
                                </p>
                                <Link
                                  href={`/${locale}/dashboard/profile`}
                                  onClick={handleUserMenuClick}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <User className="w-4 h-4 mr-2" />
                                  {t('myInfo')}
                                </Link>
                                <Link
                                  href={`/${locale}/dashboard/reservations`}
                                  onClick={handleUserMenuClick}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                >
                                  <Calendar className="w-4 h-4 mr-2" />
                                  {t('myReservations')}
                                </Link>
                              </div>
                            </>
                          )}
                          
                          {/* 문서 업로드 메뉴 (팀원만) */}
                          {currentUserRole === 'team_member' && (
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
                          
                          {/* 시뮬레이션 중지 버튼 (시뮬레이션 중일 때) */}
                          {isSimulating && (
                            <div className="px-4 py-2 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  handleUserMenuClick()
                                  handleStopSimulation()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('backToAdmin')}
                              </button>
                            </div>
                          )}
                          
                          {/* 시뮬레이션 메뉴 (관리자만) */}
                          {currentUserRole === 'admin' && !isSimulating && (
                            <div className="px-4 py-2 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                시뮬레이션
                              </p>
                              
                              {/* 가이드 시뮬레이션 */}
                              <button
                                onClick={() => {
                                  // 가이드 시뮬레이션은 관리자 페이지에서만 가능
                                  window.location.href = `/${locale}/admin`
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                가이드 시뮬레이션
                              </button>
                              
                              {/* 고객 시뮬레이션 */}
                              <button
                                onClick={() => {
                                  // 고객 시뮬레이션은 관리자 페이지에서만 가능
                                  window.location.href = `/${locale}/admin`
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center"
                              >
                                <User className="w-4 h-4 mr-2" />
                                고객 시뮬레이션
                              </button>
                            </div>
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
              <div className="flex items-center space-x-4">
                {/* 상품 페이지에서만 장바구니 아이콘 표시 */}
                {isProductPage && (
                  <CartIcon onClick={() => setShowCart(true)} />
                )}
                <Link
                  href={`/${locale}/auth`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {t('login')}
                </Link>
              </div>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="md:hidden flex items-center space-x-2">
            {/* 상품 페이지에서만 장바구니 아이콘 표시 */}
            {isProductPage && (
              <CartIcon onClick={() => setShowCart(true)} />
            )}
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
              <Link 
                href={`/${locale}/reservation-check`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Search className="w-4 h-4 mr-3" />
                예약 확인
              </Link>
              
              {/* 인증 상태에 따른 메뉴 */}
              {loading ? (
                <div className="flex items-center text-gray-600 px-2 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                  Loading...
                </div>
              ) : currentUser ? (
                <div className="px-2 py-2 space-y-2">
                  {/* 사용자 정보 표시 */}
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {((currentUser as any)?.name_ko || (currentUser as any)?.name_en || (currentUser as any)?.name || currentUser?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {(currentUser as any)?.name_ko || (currentUser as any)?.name_en || (currentUser as any)?.name || currentUser?.email?.split('@')[0] || t('user')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentUserRole === 'admin' ? t('admin') : 
                         currentUserRole === 'manager' ? t('manager') : 
                         currentUserRole === 'team_member' ? t('teamMember') : t('customer')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 고객용 메뉴 */}
                  {currentUserRole === 'customer' && (
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
                  {currentUserRole && currentUserRole !== 'customer' && (
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
                  {currentUserRole === 'team_member' && (
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
                  {currentUserRole === 'team_member' && (
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
                  
                  {/* 시뮬레이션 중지 버튼 (시뮬레이션 중일 때) */}
                  {isSimulating && (
                    <button
                      onClick={() => {
                        handleStopSimulation()
                        setIsMobileMenuOpen(false)
                      }}
                      className="flex items-center w-full text-red-600 hover:text-red-700 transition-colors px-2 py-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-3" />
                      {t('backToAdmin')}
                    </button>
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

      {/* 장바구니 사이드바 (상품 페이지에서만) */}
      {isProductPage && (
        <CartSidebar
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          onCheckout={() => {
            setShowCart(false)
            // 상품 상세 페이지로 이동하여 결제 페이지 열기
            if (pathname.includes('/products/')) {
              // 상품 상세 페이지에서 결제 처리
              window.dispatchEvent(new CustomEvent('openCartCheckout'))
            }
          }}
        />
      )}
    </nav>
  )
}

const Navigation = () => {
  return <NavigationContent />
}

export default Navigation
