'use client'

import { useCallback, useMemo } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import TicketBookingExpensesAdminTab from '@/components/expenses/TicketBookingExpensesAdminTab'
import TourHotelBookingExpensesAdminTab from '@/components/expenses/TourHotelBookingExpensesAdminTab'

export type ReservationExpenseSubTab = 'expenses' | 'tickets' | 'hotels'

const RS_VALUES: ReservationExpenseSubTab[] = ['expenses', 'tickets', 'hotels']

function parseRs(raw: string | null): ReservationExpenseSubTab {
  if (raw && RS_VALUES.includes(raw as ReservationExpenseSubTab)) return raw as ReservationExpenseSubTab
  return 'expenses'
}

export default function ReservationExpenseTabPanel() {
  const t = useTranslations('expenses.reservationSubTabs')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'

  const subTab = useMemo(() => parseRs(searchParams.get('rs')), [searchParams])

  const setSubTab = useCallback(
    (next: ReservationExpenseSubTab) => {
      const p = new URLSearchParams(searchParams.toString())
      if (next === 'expenses') {
        p.delete('rs')
      } else {
        p.set('rs', next)
      }
      const q = p.toString()
      router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const tabs: { id: ReservationExpenseSubTab; label: string }[] = [
    { id: 'expenses', label: t('tab.expenses') },
    { id: 'tickets', label: t('tab.tickets') },
    { id: 'hotels', label: t('tab.hotels') }
  ]

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
        <nav className="flex flex-wrap gap-1" aria-label="Reservation expense sections">
          {tabs.map((tab) => {
            const active = subTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700 bg-blue-50/80'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {subTab === 'expenses' && <ReservationExpenseManager />}

      {subTab === 'tickets' && <TicketBookingExpensesAdminTab locale={locale} />}

      {subTab === 'hotels' && <TourHotelBookingExpensesAdminTab locale={locale} />}
    </div>
  )
}
