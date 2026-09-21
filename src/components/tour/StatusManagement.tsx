import React, { useState } from 'react'
import { Calendar, Copy, Trash2, Edit, RotateCcw, UserCheck, X } from 'lucide-react'
import TourSunriseTime from '@/components/TourSunriseTime'
import { TourStatusModal } from './modals/TourStatusModal'

interface StatusManagementProps {
  tour: any
  showTourStatusDropdown: boolean
  showAssignmentStatusDropdown: boolean
  tourStatusOptions: Array<{ value: string; label: string; color: string }>
  assignmentStatusOptions: Array<{ value: string; label: string; color: string }>
  getTotalAssignedPeople: number
  getTotalPeopleNonCancelled: number
  getTotalCancelledPeople: number
  onToggleTourStatusDropdown: () => void
  onToggleAssignmentStatusDropdown: () => void
  onUpdateTourStatus: (status: string) => Promise<void>
  onUpdateAssignmentStatus: (status: string) => Promise<void>
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null, locale: string) => string
  getAssignmentStatusColor: (tour: any) => string
  getAssignmentStatusText: (tour: any, locale: string) => string
  locale: string
  onEditClick?: () => void
  onCopyTour?: () => void
  onDeleteTour?: () => void | Promise<void>
  onRestoreTour?: () => void | Promise<void>
  onCloseModal?: () => void
  /** 모달 툴바에서는 일출을 이 한 줄에 포함 */
  showSunrise?: boolean
  /** 데스크톱 툴바가 나타나는 브레이크포인트까지 표시 */
  hideFromBreakpoint?: 'sm' | 'lg'
}

const iconBtnClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md'

export const StatusManagement: React.FC<StatusManagementProps> = ({
  tour,
  showTourStatusDropdown: _showTourStatusDropdown,
  showAssignmentStatusDropdown: _showAssignmentStatusDropdown,
  tourStatusOptions: _tourStatusOptions,
  assignmentStatusOptions: _assignmentStatusOptions,
  getTotalAssignedPeople,
  getTotalPeopleNonCancelled,
  getTotalCancelledPeople,
  onToggleTourStatusDropdown: _onToggleTourStatusDropdown,
  onToggleAssignmentStatusDropdown: _onToggleAssignmentStatusDropdown,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  locale,
  onEditClick,
  onCopyTour,
  onDeleteTour,
  onRestoreTour,
  onCloseModal,
  showSunrise = false,
  hideFromBreakpoint = 'sm',
}) => {
  const [showStatusModal, setShowStatusModal] = useState(false)
  const tourStatusLabel = getStatusText(tour.tour_status, locale)
  const assignmentStatusLabel = getAssignmentStatusText(tour, locale)
  const tourAria = locale === 'ko' ? `투어: ${tourStatusLabel}` : `Tour: ${tourStatusLabel}`
  const assignmentAria =
    locale === 'ko' ? `배정: ${assignmentStatusLabel}` : `Assignment: ${assignmentStatusLabel}`

  return (
    <div className={hideFromBreakpoint === 'lg' ? 'lg:hidden' : 'sm:hidden'}>
      <div className="flex w-full min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {showSunrise ? (
        <TourSunriseTime tourDate={tour.tour_date} compact className="shrink-0" />
      ) : null}

      <button
        type="button"
        onClick={() => setShowStatusModal(true)}
        className={`inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold leading-none ${getStatusColor(tour.tour_status)} hover:opacity-80`}
        title={tourAria}
        aria-label={tourAria}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="max-w-[4.5rem] truncate">{tourStatusLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => setShowStatusModal(true)}
        className={`inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold leading-none ${getAssignmentStatusColor(tour)} hover:opacity-80`}
        title={assignmentAria}
        aria-label={assignmentAria}
      >
        <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="max-w-[4.5rem] truncate">{assignmentStatusLabel}</span>
      </button>

      <div
        className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-primary/5 px-1.5 text-[11px] font-semibold tabular-nums text-primary"
        title={
          locale === 'ko'
            ? '배정 / 전체 / 취소'
            : 'Assigned / Total / Cancelled'
        }
      >
        {getTotalAssignedPeople}/{getTotalPeopleNonCancelled}/{getTotalCancelledPeople}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onCopyTour}
          className={`${iconBtnClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          title={locale === 'ko' ? '복사' : 'Copy'}
          aria-label={locale === 'ko' ? '복사' : 'Copy'}
        >
          <Copy size={14} />
        </button>
        {onRestoreTour ? (
          <button
            type="button"
            onClick={onRestoreTour}
            className={`${iconBtnClass} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}
            title={locale === 'ko' ? '투어 복구' : 'Restore tour'}
            aria-label={locale === 'ko' ? '투어 복구' : 'Restore tour'}
          >
            <RotateCcw size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onDeleteTour}
            className={`${iconBtnClass} bg-red-100 text-red-700 hover:bg-red-200`}
            title={locale === 'ko' ? '삭제' : 'Delete'}
            aria-label={locale === 'ko' ? '삭제' : 'Delete'}
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onEditClick}
          className={`${iconBtnClass} bg-primary/10 text-primary hover:bg-blue-200`}
          title={locale === 'ko' ? '수정' : 'Edit'}
          aria-label={locale === 'ko' ? '수정' : 'Edit'}
        >
          <Edit size={14} />
        </button>
        {onCloseModal ? (
          <button
            type="button"
            onClick={onCloseModal}
            className={`${iconBtnClass} bg-gray-100 text-gray-600 hover:bg-gray-200`}
            aria-label={locale === 'ko' ? '닫기' : 'Close'}
            title={locale === 'ko' ? '닫기' : 'Close'}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      </div>

      <TourStatusModal
        isOpen={showStatusModal}
        tour={tour}
        currentTourStatus={tour.tour_status}
        currentAssignmentStatus={tour.assignment_status}
        locale={locale}
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
