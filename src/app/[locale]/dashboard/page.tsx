'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getRoleDisplayName } from '@/lib/roles'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Calendar, Users, Map, Package, Settings, UserCheck } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { userRole, hasPermission } = useAuth()

  const getDashboardContent = () => {
    if (!userRole) return null

    switch (userRole) {
      case 'customer':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">고객 대시보드</h2>
              <p className="text-gray-600 mb-4">
                투어 관리 시스템에 오신 것을 환영합니다!<br />
                현재 고객 계정으로 로그인되어 있습니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/products"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Package className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold">투어 상품 보기</h3>
                  <p className="text-sm text-gray-600">다양한 투어 상품을 확인하세요</p>
                </Link>
                <Link
                  href="/off-schedule"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-8 h-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">스케줄 확인</h3>
                  <p className="text-sm text-gray-600">투어 스케줄을 확인하세요</p>
                </Link>
              </div>
            </div>
          </div>
        )

      case 'team_member':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">팀원 대시보드</h2>
              <p className="text-gray-600 mb-4">
                팀원으로 로그인되어 있습니다. 다음 기능을 사용할 수 있습니다:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hasPermission('canManageCustomers') && (
                  <Link
                    href="/admin/customers"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Users className="w-8 h-8 text-blue-600 mb-2" />
                    <h3 className="font-semibold">고객 관리</h3>
                    <p className="text-sm text-gray-600">고객 정보를 관리하세요</p>
                  </Link>
                )}
                {hasPermission('canManageReservations') && (
                  <Link
                    href="/admin/reservations"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Calendar className="w-8 h-8 text-green-600 mb-2" />
                    <h3 className="font-semibold">예약 관리</h3>
                    <p className="text-sm text-gray-600">투어 예약을 관리하세요</p>
                  </Link>
                )}
                {hasPermission('canManageTours') && (
                  <Link
                    href="/admin/tours"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Map className="w-8 h-8 text-purple-600 mb-2" />
                    <h3 className="font-semibold">투어 관리</h3>
                    <p className="text-sm text-gray-600">투어를 관리하세요</p>
                  </Link>
                )}
                {hasPermission('canViewSchedule') && (
                  <Link
                    href="/schedule"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Calendar className="w-8 h-8 text-orange-600 mb-2" />
                    <h3 className="font-semibold">스케줄 보기</h3>
                    <p className="text-sm text-gray-600">가이드 스케줄을 확인하세요</p>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )

      case 'manager':
      case 'admin':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {getRoleDisplayName(userRole)} 대시보드
              </h2>
              <p className="text-gray-600 mb-4">
                모든 관리 기능에 접근할 수 있습니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                  href="/admin/products"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Package className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold">상품 관리</h3>
                  <p className="text-sm text-gray-600">투어 상품을 관리하세요</p>
                </Link>
                <Link
                  href="/admin/customers"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Users className="w-8 h-8 text-green-600 mb-2" />
                  <h3 className="font-semibold">고객 관리</h3>
                  <p className="text-sm text-gray-600">고객 정보를 관리하세요</p>
                </Link>
                <Link
                  href="/admin/reservations"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-8 h-8 text-purple-600 mb-2" />
                  <h3 className="font-semibold">예약 관리</h3>
                  <p className="text-sm text-gray-600">투어 예약을 관리하세요</p>
                </Link>
                <Link
                  href="/admin/tours"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Map className="w-8 h-8 text-orange-600 mb-2" />
                  <h3 className="font-semibold">투어 관리</h3>
                  <p className="text-sm text-gray-600">투어를 관리하세요</p>
                </Link>
                <Link
                  href="/admin/team"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <UserCheck className="w-8 h-8 text-red-600 mb-2" />
                  <h3 className="font-semibold">팀 관리</h3>
                  <p className="text-sm text-gray-600">팀원을 관리하세요</p>
                </Link>
                <Link
                  href="/admin/options"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-8 h-8 text-gray-600 mb-2" />
                  <h3 className="font-semibold">옵션 관리</h3>
                  <p className="text-sm text-gray-600">투어 옵션을 관리하세요</p>
                </Link>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 pt-0 pb-8">
        {getDashboardContent()}
      </div>
    </ProtectedRoute>
  )
}
