import React from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import TourExpenseManager from '@/components/TourExpenseManager'

interface TourFinanceProps {
  tour: any
  connectionStatus: { bookings: boolean }
  userRole: string
  onExpenseUpdated: () => void
}

export const TourFinance: React.FC<TourFinanceProps> = ({
  tour,
  connectionStatus,
  userRole,
  onExpenseUpdated
}) => {
  const t = useTranslations('tours.tourFinance')
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
          {t('title')}
          <ConnectionStatusLabel status={connectionStatus.bookings} section={t('section')} />
        </h2>
        
        {/* 투어 지출 관리 */}
        <TourExpenseManager
          tourId={tour.id}
          tourDate={tour.tour_date}
          productId={tour.product_id}
          submittedBy={userRole === 'admin' ? 'admin@tour.com' : 'guide@tour.com'}
          reservationIds={tour.reservation_ids || []}
          userRole={userRole}
          onExpenseUpdated={onExpenseUpdated}
        />
      </div>
    </div>
  )
}
