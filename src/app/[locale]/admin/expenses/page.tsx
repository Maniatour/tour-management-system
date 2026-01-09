'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import CompanyExpenseManager from '@/components/CompanyExpenseManager'
import AllTourExpensesManager from '@/components/AllTourExpensesManager'
import { Receipt, Calendar, Building2, MapPin } from 'lucide-react'

type ExpenseTab = 'reservation' | 'company' | 'tour'

export default function ExpensesManagementPage() {
  const [activeTab, setActiveTab] = useState<ExpenseTab>('tour')

  const tabs = [
    {
      id: 'reservation' as ExpenseTab,
      label: '예약 지출',
      icon: Calendar,
      description: '예약 관련 지출 관리'
    },
    {
      id: 'company' as ExpenseTab,
      label: '회사 지출',
      icon: Building2,
      description: '일반 회사 지출 관리'
    },
    {
      id: 'tour' as ExpenseTab,
      label: '투어 지출',
      icon: MapPin,
      description: '투어 관련 지출 관리'
    }
  ]

  return (
    <div className="container mx-auto px-2 py-6 max-w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Receipt className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">지출 관리</h1>
        </div>
        <p className="text-gray-600">예약, 회사, 투어 지출을 통합 관리합니다.</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === 'reservation' && (
          <div className="p-3">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">예약 지출 관리</h2>
              <p className="text-sm text-gray-600">
                투어 이외의 예약에 대한 지출을 관리합니다. 예약 ID를 지정하여 관련 지출을 추적할 수 있습니다.
              </p>
            </div>
            <ReservationExpenseManager />
          </div>
        )}

        {activeTab === 'company' && (
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">회사 지출 관리</h2>
              <p className="text-sm text-gray-600">
                일반적인 회사 운영 지출을 관리합니다. 카테고리별 분류 및 승인 프로세스를 지원합니다.
              </p>
            </div>
            <CompanyExpenseManager />
          </div>
        )}

        {activeTab === 'tour' && (
          <div className="p-3">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">투어 지출 관리</h2>
              <p className="text-sm text-gray-600">
                모든 투어의 지출을 통합 관리합니다. 투어별, 날짜별, 상태별로 필터링하여 조회할 수 있습니다.
              </p>
            </div>
            <AllTourExpensesManager />
          </div>
        )}
      </div>
    </div>
  )
}

