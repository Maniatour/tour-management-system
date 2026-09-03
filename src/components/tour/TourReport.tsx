import React from 'react'
import { Plus, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import TourReportSection from '@/components/TourReportSection'
import { useTourDetailSectionChrome } from './TourDetailModalChromeContext'

interface TourReportProps {
  tour: any
  product: any
  connectionStatus: { bookings: boolean }
  isStaff: boolean
  userRole: string
  params: { locale: string }
  highlightReportId?: string | null
}

export const TourReport: React.FC<TourReportProps> = ({
  tour,
  product,
  connectionStatus,
  isStaff,
  userRole,
  params,
  highlightReportId = null,
}) => {
  const chrome = useTourDetailSectionChrome()
  const t = useTranslations('tours.tourReport')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  
  const handleCreateReport = () => {
    const reportSection = document.querySelector('[data-tour-report-section]')
    if (reportSection) {
      const createButton = reportSection.querySelector('[data-create-report]') as HTMLButtonElement
      if (createButton) createButton.click()
    }
  }

  const handleViewReports = () => {
    const reportSection = document.querySelector('[data-tour-report-section]')
    if (reportSection) {
      const viewButton = reportSection.querySelector('[data-view-reports]') as HTMLButtonElement
      if (viewButton) viewButton.click()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className={chrome.shellPadding}>
        <div className={`flex items-center justify-between ${chrome.headerMargin}`}>
          <h2 className={`${chrome.sectionTitle} flex items-center`}>
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings} section={t('section')} />
          </h2>
          <div className="flex gap-1">
            {chrome.compact ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateReport}
                  className={`${chrome.iconButton} bg-primary text-primary-foreground hover:bg-primary/90`}
                  title="작성"
                  aria-label="작성"
                >
                  <Plus size={chrome.iconSize} />
                </button>
                <button
                  type="button"
                  onClick={handleViewReports}
                  className={`${chrome.iconButton} border border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
                  title="목록"
                  aria-label="목록"
                >
                  <Eye size={chrome.iconSize} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCreateReport}
                  className={`inline-flex items-center gap-1 ${chrome.textActionButton} bg-primary text-primary-foreground hover:bg-primary/90`}
                >
                  <Plus size={chrome.iconSize} />
                  <span>작성</span>
                </button>
                <button
                  type="button"
                  onClick={handleViewReports}
                  className={`inline-flex items-center gap-1 ${chrome.textActionButton} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
                >
                  <Eye size={chrome.iconSize} />
                  <span>목록</span>
                </button>
              </>
            )}
          </div>
        </div>
        <div data-tour-report-section>
          <TourReportSection
            tourId={tour.id}
            productId={tour.product_id ?? product?.id}
            tourName={productName || ''}
            tourDate={tour.tour_date}
            canCreateReport={isStaff}
            canEditReport={isStaff}
            canDeleteReport={userRole === 'admin'}
            showHeader={false}
            highlightReportId={highlightReportId}
          />
        </div>
      </div>
    </div>
  )
}
