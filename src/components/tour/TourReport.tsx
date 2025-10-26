import React from 'react'
import { Plus, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ConnectionStatusLabel } from './TourUIComponents'
import TourReportSection from '@/components/TourReportSection'

interface TourReportProps {
  tour: any
  product: any
  connectionStatus: { bookings: boolean }
  isStaff: boolean
  userRole: string
  params: { locale: string }
}

export const TourReport: React.FC<TourReportProps> = ({
  tour,
  product,
  connectionStatus,
  isStaff,
  userRole,
  params
}) => {
  const t = useTranslations('tours.tourReport')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  
  const handleCreateReport = () => {
    // 투어 리포트 작성 모드로 전환
    const reportSection = document.querySelector('[data-tour-report-section]')
    if (reportSection) {
      const createButton = reportSection.querySelector('[data-create-report]') as HTMLButtonElement
      if (createButton) createButton.click()
    }
  }

  const handleViewReports = () => {
    // 투어 리포트 목록 모드로 전환
    const reportSection = document.querySelector('[data-tour-report-section]')
    if (reportSection) {
      const viewButton = reportSection.querySelector('[data-view-reports]') as HTMLButtonElement
      if (viewButton) viewButton.click()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings} section={t('section')} />
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={handleCreateReport}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">작성</span>
            </Button>
            <Button
              onClick={handleViewReports}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">목록</span>
            </Button>
          </div>
        </div>
        <div data-tour-report-section>
          <TourReportSection
            tourId={tour.id}
            tourName={productName || ''}
            tourDate={tour.tour_date}
            canCreateReport={isStaff}
            canEditReport={isStaff}
            canDeleteReport={userRole === 'admin'}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  )
}
