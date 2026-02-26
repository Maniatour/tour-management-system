import { ArrowLeft, Edit, Trash2, Copy, Printer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TourSunriseTime from '@/components/TourSunriseTime'
import { StatusManagement } from '@/components/tour/StatusManagement'
import { TourStatusModal } from './modals/TourStatusModal'
import { useTranslations } from 'next-intl'

interface TourHeaderProps {
  tour: any
  product: any
  params: { locale: string }
  showTourStatusDropdown: boolean
  showAssignmentStatusDropdown: boolean
  tourStatusOptions: Array<{ value: string; label: string; color: string }>
  assignmentStatusOptions: Array<{ value: string; label: string; color: string }>
  getTotalAssignedPeople: number
  getTotalPeopleFiltered: number
  getTotalPeopleAll: number
  onToggleTourStatusDropdown: () => void
  onToggleAssignmentStatusDropdown: () => void
  onUpdateTourStatus: (status: string) => Promise<void>
  onUpdateAssignmentStatus: (status: string) => Promise<void>
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null, locale: string) => string
  getAssignmentStatusColor: (tour: any) => string
  getAssignmentStatusText: (tour: any, locale: string) => string
  onEditClick?: () => void
  onPrintReceipts?: () => void
}

export default function TourHeader({
  tour,
  product,
  params,
  showTourStatusDropdown,
  showAssignmentStatusDropdown,
  tourStatusOptions,
  assignmentStatusOptions,
  getTotalAssignedPeople,
  getTotalPeopleFiltered,
  getTotalPeopleAll,
  onToggleTourStatusDropdown,
  onToggleAssignmentStatusDropdown,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  onEditClick,
  onPrintReceipts
}: TourHeaderProps) {
  const router = useRouter()
  const t = useTranslations('tours.tourHeader')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  const dateLocale = params.locale === 'ko' ? 'ko-KR' : 'en-US'
  
  // 모달 상태 관리
  const [showStatusModal, setShowStatusModal] = useState(false)

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="px-2 sm:px-6 py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.push(`/${params.locale}/admin/tours`)}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              {/* 모바일: 뒤로가기와 제목·일출을 한 줄에 배치 */}
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate min-w-0">
                  {productName || 'Tour Detail'}
                </h1>
                {/* 일출 시간 (박스 넘침 방지) */}
                <div className="flex-shrink-0 min-w-0 max-w-[80px] sm:max-w-none">
                  <TourSunriseTime tourDate={tour.tour_date} />
                </div>
                {onPrintReceipts && (
                  <button
                    type="button"
                    onClick={onPrintReceipts}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
                    title={params.locale === 'ko' ? '영수증 일괄 인쇄' : 'Print receipts'}
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                <span>{params.locale === 'ko' ? '투어 ID' : 'Tour ID'}: {tour.id}</span>
                <span className="hidden sm:inline">|</span>
                <span>{params.locale === 'ko' ? '날짜' : 'Date'}: {tour.tour_date || ''}</span>
                <span className="hidden sm:inline">|</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                  {getStatusText(tour.tour_status, params.locale)}
                </span>
              </div>
            </div>
          </div>
          
          {/* 모바일 요약/액션 (아이콘) */}
          <StatusManagement
            tour={tour}
            showTourStatusDropdown={showTourStatusDropdown}
            showAssignmentStatusDropdown={showAssignmentStatusDropdown}
            tourStatusOptions={tourStatusOptions}
            assignmentStatusOptions={assignmentStatusOptions}
            getTotalAssignedPeople={getTotalAssignedPeople}
            getTotalPeopleFiltered={getTotalPeopleFiltered}
            getTotalPeopleAll={getTotalPeopleAll}
            onToggleTourStatusDropdown={onToggleTourStatusDropdown}
            onToggleAssignmentStatusDropdown={onToggleAssignmentStatusDropdown}
            onUpdateTourStatus={onUpdateTourStatus}
            onUpdateAssignmentStatus={onUpdateAssignmentStatus}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            getAssignmentStatusColor={getAssignmentStatusColor}
            getAssignmentStatusText={getAssignmentStatusText}
            locale={params.locale}
            onEditClick={onEditClick}
          />

          {/* 데스크톱 요약/액션 */}
          <div className="hidden sm:flex items-center space-x-6">
            {/* 투어 상태 버튼들 - 왼쪽 배치 */}
            <div className="flex space-x-3">
              {/* 투어 Status 버튼 */}
              <button 
                type="button"
                onClick={() => setShowStatusModal(true)}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center min-w-[120px] ${getStatusColor(tour.tour_status)} hover:opacity-80 transition-opacity cursor-pointer`}
              >
                {t('tour')}: {getStatusText(tour.tour_status, params.locale)}
              </button>
              
              {/* 배정 Status 버튼 */}
              <button 
                type="button"
                onClick={() => setShowStatusModal(true)}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center min-w-[120px] ${getAssignmentStatusColor(tour)} hover:opacity-80 transition-opacity cursor-pointer`}
              >
                {t('assignment')}: {getAssignmentStatusText(tour, params.locale)}
              </button>
            </div>
            
            {/* 총 배정 인원 표시 */}
            <div className="text-center bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
              <div className="text-xl font-bold text-blue-600 flex items-center justify-center gap-2">
                {getTotalAssignedPeople} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span> / {getTotalPeopleFiltered} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span> ({Math.max(getTotalPeopleAll - getTotalPeopleFiltered, 0)} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span>)
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {t('assignedFull')} / {t('total')} / {t('cancelledPending')}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
                <Copy size={16} />
                <span>{t('copy')}</span>
              </button>
              <button className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center space-x-2">
                <Trash2 size={16} />
                <span>{t('delete')}</span>
              </button>
              <button 
                onClick={onEditClick}
                className="px-4 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 flex items-center space-x-2"
              >
                <Edit size={16} />
                <span>{t('edit')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 상태 변경 모달 */}
      <TourStatusModal
        isOpen={showStatusModal}
        tour={tour}
        currentTourStatus={tour.tour_status}
        currentAssignmentStatus={tour.assignment_status}
        locale={params.locale}
        onClose={() => setShowStatusModal(false)}
        onUpdateTourStatus={onUpdateTourStatus}
        onUpdateAssignmentStatus={onUpdateAssignmentStatus}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusText={getAssignmentStatusText}
      />
    </div>
  )
}
