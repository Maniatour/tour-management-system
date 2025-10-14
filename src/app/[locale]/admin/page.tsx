'use client'

import React, { use } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Package, 
  Users, 
  Calendar, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Map,
  Settings,
  BookOpen,
  UserCheck,
  FileText,
  Globe,
  Car,
  Gift,
  BarChart3,
  Shield,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface AdminDashboardProps {
  params: Promise<{ locale: string }>
}

export default function AdminDashboard({ params }: AdminDashboardProps) {
  const { locale } = use(params)

  const stats = [
    {
      name: '총 상품 수',
      value: '24',
      change: '+12%',
      changeType: 'increase',
      icon: Package,
      href: `/${locale}/admin/products`
    },
    {
      name: '총 고객 수',
      value: '1,234',
      change: '+8%',
      changeType: 'increase',
      icon: Users,
      href: `/${locale}/admin/customers`
    },
    {
      name: '이번 달 예약',
      value: '89',
      change: '+23%',
      changeType: 'increase',
      icon: Calendar,
      href: `/${locale}/admin/reservations`
    },
    {
      name: '이번 달 매출',
      value: '$12,345',
      change: '+15%',
      changeType: 'increase',
      icon: DollarSign,
      href: `/${locale}/admin/reservations`
    }
  ]

  const mobileMenuItems = [
    {
      name: '상품 관리',
      href: `/${locale}/admin/products`,
      icon: Package,
      color: 'bg-blue-500'
    },
    {
      name: '고객 관리',
      href: `/${locale}/admin/customers`,
      icon: Users,
      color: 'bg-green-500'
    },
    {
      name: '예약 관리',
      href: `/${locale}/admin/reservations`,
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      name: '부킹 관리',
      href: `/${locale}/admin/booking`,
      icon: BookOpen,
      color: 'bg-orange-500'
    },
    {
      name: '투어 관리',
      href: `/${locale}/admin/tours`,
      icon: Map,
      color: 'bg-red-500'
    },
    {
      name: '팀 관리',
      href: `/${locale}/admin/team`,
      icon: UserCheck,
      color: 'bg-indigo-500'
    },
    {
      name: '옵션 관리',
      href: `/${locale}/admin/options`,
      icon: Settings,
      color: 'bg-gray-500'
    },
    {
      name: '채널 관리',
      href: `/${locale}/admin/channels`,
      icon: Globe,
      color: 'bg-cyan-500'
    },
    {
      name: '차량 관리',
      href: `/${locale}/admin/vehicles`,
      icon: Car,
      color: 'bg-yellow-500'
    },
    {
      name: '쿠폰 관리',
      href: `/${locale}/admin/coupons`,
      icon: Gift,
      color: 'bg-pink-500'
    },
    {
      name: '데이터 검토',
      href: `/${locale}/admin/data-review`,
      icon: BarChart3,
      color: 'bg-teal-500'
    },
    {
      name: '감사 로그',
      href: `/${locale}/admin/audit-logs`,
      icon: Shield,
      color: 'bg-slate-500'
    },
    {
      name: '출석 관리',
      href: `/${locale}/admin/attendance`,
      icon: Clock,
      color: 'bg-emerald-500'
    },
    {
      name: 'Off 스케줄',
      href: `/${locale}/admin/off-schedule`,
      icon: FileText,
      color: 'bg-violet-500'
    },
    {
      name: '픽업 호텔',
      href: `/${locale}/admin/pickup-hotels`,
      icon: Map,
      color: 'bg-amber-500'
    },
    {
      name: '투어 리포트',
      href: `/${locale}/admin/tour-reports`,
      icon: FileText,
      color: 'bg-rose-500'
    }
  ]

  return (
    <div className="bg-gray-50">
      {/* 통계 카드 */}
      <div className="px-2 pt-0 pb-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat) => {
            const IconComponent = stat.icon
            return (
              <Link
                key={stat.name}
                href={stat.href}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{stat.name}</p>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`flex items-center text-xs font-semibold ${
                    stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.changeType === 'increase' ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {stat.change}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 모바일 앱 스타일 그리드 */}
      <div className="px-2 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {mobileMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center p-3 transition-all duration-200 active:scale-95"
              >
                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-2`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
