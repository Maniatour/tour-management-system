'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import CompanyExpenseManager from '@/components/CompanyExpenseManager'
import AllTourExpensesManager from '@/components/AllTourExpensesManager'
import CashManagement from '@/components/CashManagement'
import CategoryManagerModal from '@/components/expenses/CategoryManagerModal'
import { Receipt, Calendar, Building2, MapPin, Wallet, Settings } from 'lucide-react'

type ExpenseTab = 'reservation' | 'company' | 'tour' | 'cash'

export default function ExpensesManagementPage() {
  const t = useTranslations('expenses')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as ExpenseTab | null
  const [activeTab, setActiveTab] = useState<ExpenseTab>(tabFromUrl || 'tour')
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  
  useEffect(() => {
    if (tabFromUrl && ['reservation', 'company', 'tour', 'cash'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])
  
  const handleTabChange = (tab: ExpenseTab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const tabs = [
    {
      id: 'reservation' as ExpenseTab,
      label: t('tabReservation'),
      icon: Calendar,
      description: t('tabReservationDesc')
    },
    {
      id: 'company' as ExpenseTab,
      label: t('tabCompany'),
      icon: Building2,
      description: t('tabCompanyDesc')
    },
    {
      id: 'tour' as ExpenseTab,
      label: t('tabTour'),
      icon: MapPin,
      description: t('tabTourDesc')
    },
    {
      id: 'cash' as ExpenseTab,
      label: t('tabCash'),
      icon: Wallet,
      description: t('tabCashDesc')
    }
  ]

  return (
    <div className="container mx-auto px-2 py-6 max-w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <Receipt className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
          >
            <Settings size={18} />
            {t('categoryManager')}
          </button>
        </div>
        <p className="text-gray-600">{t('subtitle')}</p>
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
                  onClick={() => handleTabChange(tab.id)}
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('sectionReservationTitle')}</h2>
              <p className="text-sm text-gray-600">
                {t('sectionReservationDesc')}
              </p>
            </div>
            <ReservationExpenseManager />
          </div>
        )}

        {activeTab === 'company' && (
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('sectionCompanyTitle')}</h2>
              <p className="text-sm text-gray-600">
                {t('sectionCompanyDesc')}
              </p>
            </div>
            <CompanyExpenseManager />
          </div>
        )}

        {activeTab === 'tour' && (
          <div className="p-3">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('sectionTourTitle')}</h2>
              <p className="text-sm text-gray-600">
                {t('sectionTourDesc')}
              </p>
            </div>
            <AllTourExpensesManager />
          </div>
        )}

        {activeTab === 'cash' && (
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('sectionCashTitle')}</h2>
              <p className="text-sm text-gray-600">
                {t('sectionCashDesc')}
              </p>
            </div>
            <CashManagement />
          </div>
        )}
      </div>

      {/* 카테고리 매니저 모달 */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />
    </div>
  )
}

