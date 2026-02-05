'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Grid3X3, CalendarDays } from 'lucide-react'
import { getCustomerName } from '@/utils/reservationUtils'
import type { Customer } from '@/types/reservation'

interface ReservationsHeaderProps {
  customerIdFromUrl: string | null
  customers: Customer[]
  viewMode: 'card' | 'calendar'
  onViewModeChange: (mode: 'card' | 'calendar') => void
  searchTerm: string
  onSearchChange: (term: string) => void
  onAddReservation: () => void
}

export default function ReservationsHeader({
  customerIdFromUrl,
  customers,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  onAddReservation
}: ReservationsHeaderProps) {
  const t = useTranslations('reservations')

  return (
    <div className="space-y-4">
      {/* 첫 번째 줄: 타이틀과 액션 버튼들 */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex-shrink-0">
            {customerIdFromUrl ? (
              <div className="flex items-center space-x-2">
                <span>{t('title')}</span>
                <span className="text-lg text-gray-500">-</span>
                <span className="text-lg text-blue-600">
                  {getCustomerName(customerIdFromUrl, customers || [])}
                </span>
              </div>
            ) : (
              t('title')
            )}
          </h1>
          
          {/* 뷰 전환 버튼 - 제목 바로 오른쪽에 배치 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onViewModeChange('card')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                viewMode === 'card' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid3X3 className="w-3 h-3" />
              <span className="hidden sm:inline">카드</span>
            </button>
            <button
              onClick={() => onViewModeChange('calendar')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                viewMode === 'calendar' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span className="hidden sm:inline">달력</span>
            </button>
          </div>
        </div>
        
        {/* 검색창과 새예약 추가 버튼 */}
        <div className="flex items-center space-x-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value)
              }}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
          <button
            onClick={onAddReservation}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t('addReservation')}</span>
            <span className="sm:hidden">추가</span>
          </button>
        </div>
      </div>
    </div>
  )
}
