'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import CompanyExpenseManager from '@/components/CompanyExpenseManager'
import AllTourExpensesManager from '@/components/AllTourExpensesManager'
import CashManagement from '@/components/CashManagement'
import CategoryManagerModal from '@/components/expenses/CategoryManagerModal'
import PaymentRecordsHistoryTab from '@/components/expenses/PaymentRecordsHistoryTab'
import { Receipt, Calendar, Building2, MapPin, Wallet, Settings, Banknote, AlertTriangle } from 'lucide-react'

type ExpenseTab = 'payments' | 'reservation' | 'company' | 'tour' | 'cash'

export default function ExpensesManagementPage() {
  const t = useTranslations('expenses')
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as ExpenseTab | null
  const [activeTab, setActiveTab] = useState<ExpenseTab>(tabFromUrl || 'tour')
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const openCompanyLedgerDupRef = useRef<(() => void) | null>(null)
  const registerOpenCompanyLedgerDup = useCallback((fn: (() => void) | null) => {
    openCompanyLedgerDupRef.current = fn
  }, [])

  useEffect(() => {
    if (tabFromUrl && ['payments', 'reservation', 'company', 'tour', 'cash'].includes(tabFromUrl)) {
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
      id: 'payments' as ExpenseTab,
      label: t('tabPayments'),
      icon: Banknote,
      description: t('tabPaymentsDesc')
    },
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
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-full">
      {/* 헤더 - 모바일 컴팩트 */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Receipt className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{t('title')}</h1>
          </div>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600 hidden sm:block">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-gray-500 hidden sm:block">
            <Link
              href={`/${locale}/admin/expense-payment-method-normalize`}
              className="text-blue-600 hover:underline"
            >
              {t('linkNormalizePaymentMethods')}
            </Link>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          {activeTab === 'company' && (
            <button
              type="button"
              onClick={() => openCompanyLedgerDupRef.current?.()}
              className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md text-amber-950 text-xs sm:text-sm font-medium"
              title="목록의 시작일·종료일(비어 있으면 최근 90일~오늘) 범위에서 회사·투어·예약·입장권 지출 중 금액·등록일이 비슷한 그룹을 찾습니다."
            >
              <AlertTriangle size={14} className="sm:w-4 sm:h-4 shrink-0 text-amber-600" aria-hidden />
              회사 지출 중복 점검
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCategoryManagerOpen(true)}
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 text-xs sm:text-sm font-medium shrink-0"
          >
            <Settings size={14} className="sm:w-4 sm:h-4" />
            {t('categoryManager')}
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 - 모바일 컴팩트 */}
      <div className="bg-white rounded-lg shadow-sm border mb-4 sm:mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-0.5 sm:gap-1 p-1 sm:p-1.5" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-colors min-w-0
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  <span className="sm:hidden truncate">{String(tab.label).split(/\s/)[0]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 탭 컨텐츠 - 통일된 패딩 */}
      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === 'payments' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{t('sectionPaymentsTitle')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{t('sectionPaymentsDesc')}</p>
            </div>
            <PaymentRecordsHistoryTab />
          </div>
        )}

        {activeTab === 'reservation' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{t('sectionReservationTitle')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{t('sectionReservationDesc')}</p>
            </div>
            <ReservationExpenseManager />
          </div>
        )}

        {activeTab === 'company' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{t('sectionCompanyTitle')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{t('sectionCompanyDesc')}</p>
            </div>
            <CompanyExpenseManager registerOpenLedgerDuplicateCheck={registerOpenCompanyLedgerDup} />
          </div>
        )}

        {activeTab === 'tour' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{t('sectionTourTitle')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{t('sectionTourDesc')}</p>
            </div>
            <AllTourExpensesManager />
          </div>
        )}

        {activeTab === 'cash' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{t('sectionCashTitle')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{t('sectionCashDesc')}</p>
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

