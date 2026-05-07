'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

interface ReservationsLoadingSpinnerProps {
  loadingProgress: {
    current: number
    total: number
  }
  /** 기본: 예약 데이터(카탈로그) 로딩 문구. 예약 관리 목록 단계 등에서 덮어쓸 때 사용 */
  headline?: string
}

export default function ReservationsLoadingSpinner({
  loadingProgress,
  headline,
}: ReservationsLoadingSpinnerProps) {
  const t = useTranslations('reservations')
  const title = headline ?? t('loadingReservationData')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          {loadingProgress.total > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                {loadingProgress.current} / {loadingProgress.total} {t('reservationsLoading')}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500">
                {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% {t('completed')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
