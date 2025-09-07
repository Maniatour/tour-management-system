'use client'

import React, { useState } from 'react'
import { 
  Package, 
  Users, 
  Calendar, 
  Settings, 
  MapPin, 
  BarChart3,
  LogOut,
  Menu,
  X,
  History,
  Ticket,
  Building,
  FileCheck,
  CalendarDays,
  Car,
  BookOpen,
  Truck,
  DollarSign,
  UserCheck
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useAuth } from '@/contexts/AuthContext'

interface AdminSidebarAndHeaderProps {
  locale: string
  children: React.ReactNode
}

export default function AdminSidebarAndHeader({ locale, children }: AdminSidebarAndHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, authUser, userRole } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
      router.push(`/${locale}/auth`)
    } catch (error) {
      console.error('로그아웃 중 오류가 발생했습니다:', error)
    }
  }

  const navigation = [
    { name: '대시보드', href: `/${locale}/admin`, icon: BarChart3 },
    { name: '상품 관리', href: `/${locale}/admin/products`, icon: Package },
    { name: '고객 관리', href: `/${locale}/admin/customers`, icon: Users },
    { name: '예약 관리', href: `/${locale}/admin/reservations`, icon: Calendar },
    { name: '예약 통계', href: `/${locale}/admin/reservations/statistics`, icon: BarChart3 },
    { name: '부킹 관리', href: `/${locale}/admin/booking`, icon: BookOpen },
    { name: '공급업체 관리', href: `/${locale}/admin/suppliers`, icon: Truck },
    { name: '공급업체 정산', href: `/${locale}/admin/suppliers/settlement`, icon: DollarSign },
    { name: 'Off 스케줄 관리', href: `/${locale}/admin/off-schedule`, icon: UserCheck },
    { name: '데이터 검수', href: `/${locale}/admin/data-review`, icon: FileCheck },
    { name: '픽업 호텔 관리', href: `/${locale}/admin/pickup-hotels`, icon: Building },
    { name: '차량 관리', href: `/${locale}/admin/vehicles`, icon: Car },
    { name: '팀 관리', href: `/${locale}/admin/team`, icon: Users },
    { name: '옵션 관리', href: `/${locale}/admin/options`, icon: Settings },
    { name: '투어 관리', href: `/${locale}/admin/tours`, icon: MapPin },
    { name: '채널 관리', href: `/${locale}/admin/channels`, icon: Settings },
    { name: '쿠폰 관리', href: `/${locale}/admin/coupons`, icon: Ticket },
    { name: '감사 추적', href: `/${locale}/admin/audit-logs`, icon: History },
  ]

  return (
    <>
      {/* 어드민 헤더 - 페이지 가장 상단에 여백 없이 */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <Menu size={24} />
              </button>
              
              {/* 시스템 제목 */}
              <h1 className="text-lg md:text-xl font-bold text-gray-800">
                투어 관리 시스템
              </h1>
              
              {/* 어드민 네비게이션 메뉴 */}
              <Link 
                href={`/${locale}/admin/products`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                상품 관리
              </Link>
              <Link 
                href={`/${locale}/admin/off-schedule`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Off 스케줄 관리
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                <div className="font-medium">
                  {authUser?.name || '관리자'}님, 안녕하세요!
                </div>
                <div className="text-xs text-gray-500">
                  {authUser?.email || '이메일 정보 없음'} | 
                  {userRole === 'admin' ? ' 관리자' : 
                   userRole === 'manager' ? ' 매니저' : 
                   userRole === 'team_member' ? ' 팀원' : ' 고객'}
                </div>
              </div>
              <LanguageSwitcher />
              <button 
                onClick={handleLogout}
                className="flex items-center text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={20} className="mr-2" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        </div>
      )}

      {/* 모바일 사이드바 */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">투어 관리 시스템</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="mt-8 px-4">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} className="mr-3" />
                {item.name}
              </Link>
            )
          })}
          
          {/* 모바일 로그아웃 버튼 */}
          <button
            onClick={() => {
              handleLogout()
              setSidebarOpen(false)
            }}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg mb-2 transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            로그아웃
          </button>
        </nav>
      </div>

      {/* 데스크톱 사이드바 - 헤더 아래에 위치 */}
      <div className="hidden lg:fixed lg:top-16 lg:left-0 lg:bottom-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white shadow-lg">
          <nav className="flex-1 px-4 mt-8">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg mb-2 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          {/* 데스크톱 로그아웃 버튼 */}
          <div className="px-4 pb-4">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut size={20} className="mr-3" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 - 헤더 높이만큼 상단 여백 추가 */}
      <div className="pt-16 lg:pl-64">
        {/* 페이지 콘텐츠 */}
        <main className="py-6">
          <div className="max-w-full mx-auto px-1 sm:px-2 lg:px-3">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
