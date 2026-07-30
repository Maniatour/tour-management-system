'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import TourExpenseManager, { type TourExpenseManagerHandle } from '@/components/TourExpenseManager'
import TipsShareModal from '@/components/TipsShareModal'
import { DollarSign, Folder, Plus, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { useTourDetailSectionChrome } from './TourDetailModalChromeContext'

interface TourFinanceProps {
  tour: any
  connectionStatus: { bookings: boolean }
  userRole: string
  /** 지출 등록·검수 시 DB `submitted_by` / `checked_by`에 저장할 실제 로그인 이메일 */
  userEmail?: string | null
  onExpenseUpdated: () => void
  /** 결제 기록에서 예약 클릭 시 예약 수정 모달 열기 (투어 상세 페이지에서 전달) */
  onReservationClick?: (reservationId: string) => void
}

export const TourFinance: React.FC<TourFinanceProps> = ({
  tour,
  connectionStatus,
  userRole,
  userEmail,
  onExpenseUpdated,
  onReservationClick,
}) => {
  const chrome = useTourDetailSectionChrome()
  const t = useTranslations('tours.tourFinance')
  const tExpense = useTranslations('tours.tourExpense')
  const expenseManagerRef = useRef<TourExpenseManagerHandle>(null)
  const tourFeesCancelled = isTourCancelled(tour?.tour_status)
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
      <div className={chrome.shellPadding}>
        <div className={`flex items-center justify-between gap-2 ${chrome.headerMargin}`}>
          <h2 className={`${chrome.sectionTitle} flex items-center min-w-0`}>
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings} section={t('section')} />
          </h2>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => expenseManagerRef.current?.openOptionManagement()}
              className={`${chrome.iconButton} bg-gray-600 text-white hover:bg-gray-700`}
              title="선택지 관리"
              aria-label="선택지 관리"
            >
              <Settings size={chrome.iconSize} />
            </button>
            <button
              type="button"
              onClick={() => expenseManagerRef.current?.openAddExpense()}
              className={`${chrome.iconButton} bg-primary text-primary-foreground hover:bg-primary/90`}
              title={tExpense('addExpense')}
              aria-label={tExpense('addExpense')}
            >
              <Plus size={chrome.iconSize} />
            </button>
            {userRole !== 'team_member' && (
              <button
                type="button"
                onClick={() => expenseManagerRef.current?.toggleDriveImporter()}
                className={`${chrome.iconButton} bg-primary text-primary-foreground hover:bg-primary/90`}
                title="구글 드라이브에서 영수증 가져오기"
                aria-label="구글 드라이브에서 영수증 가져오기"
              >
                <Folder size={chrome.iconSize} />
              </button>
            )}
            {!checkingTip && hasPrepaidTip && (
              <button
                type="button"
                onClick={() => setIsTipsShareModalOpen(true)}
                className={`inline-flex items-center gap-1 ${chrome.textActionButton} font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors shrink-0`}
              >
                <DollarSign className={chrome.compact ? 'w-3 h-3' : 'w-4 h-4'} />
                <span>Tips 쉐어</span>
              </button>
            )}
          </div>
        </div>

        <TourExpenseManager
          ref={expenseManagerRef}
          tourId={tour.id}
          tourDate={tour.tour_date}
          productId={tour.product_id}
          submittedBy={userEmail?.trim() ?? ''}
          reservationIds={tour.reservation_ids || []}
          userRole={userRole}
          onExpenseUpdated={onExpenseUpdated}
          tourGuideFee={tourFeesCancelled ? 0 : tour.guide_fee}
          tourAssistantFee={tourFeesCancelled ? 0 : tour.assistant_fee}
          tourStatus={tour?.tour_status}
          compact={chrome.compact}
          hideTitle
        />
      </div>

      {/* Tips 쉐어 모달 */}
      {isTipsShareModalOpen && (
        <TipsShareModal
          isOpen={isTipsShareModalOpen}
          onClose={() => setIsTipsShareModalOpen(false)}
          tourId={tour.id}
          {...(onReservationClick ? { onReservationClick } : {})}
        />
      )}
    </div>
  )
}
