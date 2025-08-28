'use client'

import React, { use } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Package, 
  Users, 
  Calendar, 
  DollarSign,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import Link from 'next/link'

interface AdminDashboardProps {
  params: Promise<{ locale: string }>
}

export default function AdminDashboard({ params }: AdminDashboardProps) {
  const { locale } = use(params)
  const t = useTranslations('admin')

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

  const quickActions = [
    {
      name: '새 상품 추가',
      description: '새로운 투어 상품을 등록합니다',
      href: `/${locale}/admin/products`,
      icon: Package,
      color: 'bg-blue-500'
    },
    {
      name: '예약 확인',
      description: '오늘의 예약 현황을 확인합니다',
      href: `/${locale}/admin/reservations`,
      icon: Calendar,
      color: 'bg-green-500'
    },
    {
      name: '고객 관리',
      description: '고객 정보를 관리합니다',
      href: `/${locale}/admin/customers`,
      icon: Users,
      color: 'bg-purple-500'
    },
    {
      name: '옵션 관리',
      description: '상품 옵션을 관리합니다',
      href: `/${locale}/admin/options`,
      icon: Package,
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="mt-2 text-gray-600">
          투어 관리 시스템의 전체 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stat.value}
                        </div>
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                          stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stat.changeType === 'increase' ? (
                            <TrendingUp className="self-center flex-shrink-0 h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="self-center flex-shrink-0 h-4 w-4 text-red-500" />
                          )}
                          <span className="sr-only">
                            {stat.changeType === 'increase' ? '증가' : '감소'}
                          </span>
                          {stat.change}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* 빠른 액션 */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.name}
                href={action.href}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 rounded-md p-3 ${action.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-900">
                        {action.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 최근 활동 */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">최근 활동</h2>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">아직 활동이 없습니다</h3>
              <p className="mt-1 text-sm text-gray-500">
                상품을 추가하거나 예약을 관리해보세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
