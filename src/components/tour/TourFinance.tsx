'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import TourExpenseManager from '@/components/TourExpenseManager'
import TipsShareModal from '@/components/TipsShareModal'
import { DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourFinanceProps {
  tour: any
  connectionStatus: { bookings: boolean }
  userRole: string
  onExpenseUpdated: () => void
  /** 결제 기록에서 예약 클릭 시 예약 수정 모달 열기 (투어 상세 페이지에서 전달) */
  onReservationClick?: (reservationId: string) => void
}

export const TourFinance: React.FC<TourFinanceProps> = ({
  tour,
  connectionStatus,
  userRole,
  onExpenseUpdated,
  onReservationClick
}) => {
  const t = useTranslations('tours.tourFinance')
  const [hasPrepaidTip, setHasPrepaidTip] = useState(false)
  const [isTipsShareModalOpen, setIsTipsShareModalOpen] = useState(false)
  const [checkingTip, setCheckingTip] = useState(true)

  // prepaid tip 확인
  useEffect(() => {
    const checkPrepaidTip = async () => {
      if (!tour?.reservation_ids || tour.reservation_ids.length === 0) {
        setHasPrepaidTip(false)
        setCheckingTip(false)
        return
      }

      try {
        const { data: pricingData, error } = await supabase
          .from('reservation_pricing')
          .select('prepayment_tip')
          .in('reservation_id', tour.reservation_ids)

        if (error) {
          console.error('Prepaid tip 확인 오류:', error)
          setHasPrepaidTip(false)
        } else {
          const totalTip = pricingData?.reduce((sum, pricing) => sum + (pricing.prepayment_tip || 0), 0) || 0
          setHasPrepaidTip(totalTip > 0)
        }
      } catch (error) {
        console.error('Prepaid tip 확인 오류:', error)
        setHasPrepaidTip(false)
      } finally {
        setCheckingTip(false)
      }
    }

    if (tour?.id) {
      checkPrepaidTip()
    }
  }, [tour?.id, tour?.reservation_ids])

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings} section={t('section')} />
          </h2>
          
          {/* Tips 쉐어 버튼 (prepaid tip이 있을 때만 표시) */}
          {!checkingTip && hasPrepaidTip && (
            <button
              onClick={() => setIsTipsShareModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              <span>Tips 쉐어</span>
            </button>
          )}
        </div>
        
        {/* 투어 지출 관리 */}
        <TourExpenseManager
          tourId={tour.id}
          tourDate={tour.tour_date}
          productId={tour.product_id}
          submittedBy={userRole === 'admin' ? 'admin@tour.com' : 'guide@tour.com'}
          reservationIds={tour.reservation_ids || []}
          userRole={userRole}
          onExpenseUpdated={onExpenseUpdated}
          tourGuideFee={tour.guide_fee}
          tourAssistantFee={tour.assistant_fee}
        />
      </div>

      {/* Tips 쉐어 모달 */}
      {isTipsShareModalOpen && (
        <TipsShareModal
          isOpen={isTipsShareModalOpen}
          onClose={() => setIsTipsShareModalOpen(false)}
          tourId={tour.id}
          onReservationClick={onReservationClick}
        />
      )}
    </div>
  )
}
