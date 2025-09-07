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
import { usePathname } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface AdminSidebarAndHeaderProps {
  locale: string
  children: React.ReactNode
}

export default function AdminSidebarAndHeader({ locale, children }: AdminSidebarAndHeaderProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        </nav>
      </div>

      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white shadow-lg">
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">투어 관리 시스템</h1>
          </div>
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
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="lg:pl-64">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200 mt-0">
          <div className="flex items-center justify-between h-16 px-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                관리자님, 안녕하세요!
              </div>
              <LanguageSwitcher />
              <button className="flex items-center text-gray-500 hover:text-gray-700">
                <LogOut size={20} className="mr-2" />
                로그아웃
              </button>
            </div>
          </div>
        </header>

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
