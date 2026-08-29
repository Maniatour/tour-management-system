import { ArrowLeft, Edit, Trash2, Copy, Printer, Mail, DollarSign, RotateCcw, FileText, X, GripVertical, Users, Smartphone, UserCheck, History, Headphones } from 'lucide-react'
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
  onEditClick?: () => void
  onCopyTour?: () => void
  onDeleteTour?: () => void | Promise<void>
  /** 삭제됨(soft delete) 투어를 예정 상태로 되돌릴 때 (스태프 전용) */
  onRestoreTour?: () => void | Promise<void>
  onPrintReceipts?: () => void
  onPrintTipEnvelopes?: () => void
  onPrintBalanceEnvelopes?: () => void
  /** 투어 정보(팀/픽업/부킹) Letter 인쇄 */
  onPrintTourInfo?: () => void
  /** 모달 닫기 (modal-toolbar 전용) */
  onCloseModal?: () => void
  /** 우천 시 L → X 일괄 전환 (modal-toolbar 전용) */
  onConvertLowerToX?: () => void
  convertingLowerToX?: boolean
  /** modal-toolbar: 일반투어 여부 */
  isPrivateTour?: boolean
  /** modal-toolbar: 최대 수용 인원 */
  maxParticipants?: number
  /** 가이드/어시스턴트 스케줄 컨펌 SMS·앱 알림 발송 */
  onSendGuideScheduleConfirm?: () => void
  /** 가이드/어시스턴트 스케줄 부여 SMS 발송 (확정/거절 링크) */
  onSendGuideScheduleAssignment?: () => void
  /** 가이드 스케줄 배정·컨펌 상세 기록 */
  onViewAssignmentHistory?: () => void
  /** 나레이션 재생 히스토리 */
  onViewNarrationHistory?: () => void
  /** page: 전체 페이지 헤더, modal-toolbar: 모달 고정 툴바만 */
  variant?: 'page' | 'modal-toolbar'
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
  getTotalPeopleNonCancelled,
  getTotalCancelledPeople,
  onToggleTourStatusDropdown,
  onToggleAssignmentStatusDropdown,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  onEditClick,
  onCopyTour,
  onDeleteTour,
  onRestoreTour,
  onPrintReceipts,
  onPrintTipEnvelopes,
  onPrintBalanceEnvelopes,
  onPrintTourInfo,
  onCloseModal,
  onConvertLowerToX,
  convertingLowerToX = false,
  isPrivateTour = false,
  maxParticipants,
  onSendGuideScheduleConfirm,
  onSendGuideScheduleAssignment,
  onViewAssignmentHistory,
  onViewNarrationHistory,
  variant = 'page',
}: TourHeaderProps) {
  const embeddedInModal = variant === 'modal-toolbar'
  const router = useRouter()
  const t = useTranslations('tours.tourHeader')
  const tInfo = useTranslations('tours.tourInfo')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  const resolvedMaxParticipants =
    typeof maxParticipants === 'number' && Number.isFinite(maxParticipants) ? maxParticipants : 12
  
  // 모달 상태 관리
  const [showStatusModal, setShowStatusModal] = useState(false)

  return (
    <div
      className={
        variant === 'modal-toolbar'
          ? 'bg-gray-50/80'
          : embeddedInModal
            ? 'border-b border-gray-100 bg-white'
            : 'border-b bg-white shadow-sm'
      }
    >
      <div
        className={
          variant === 'modal-toolbar'
            ? 'px-3 py-2'
            : embeddedInModal
              ? 'px-3 py-2 sm:px-4'
              : 'px-2 py-2 sm:px-6 sm:py-4'
        }
      >
        {variant === 'modal-toolbar' ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <GripVertical
                className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block"
                aria-hidden
              />
              <p
                className="min-w-0 max-w-[min(100%,28rem)] truncate text-sm font-semibold text-gray-900 sm:max-w-xs lg:max-w-md"
                title={
                  tour.tour_date && productName
                    ? `${tour.tour_date} - ${productName}`
                    : productName || tour.tour_date || ''
                }
              >
                {tour.tour_date && productName
                  ? `${tour.tour_date} - ${productName}`
                  : productName || tour.tour_date || 'Tour Detail'}
              </p>
              {onConvertLowerToX ? (
                <button
                  type="button"
                  onClick={onConvertLowerToX}
                  disabled={convertingLowerToX}
                  className="inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  title={
                    params.locale === 'ko'
                      ? 'Lower Antelope 우천 폐쇄 시 X Canyon으로 전환 (인원당 $10 할인)'
                      : 'Switch Lower Antelope to X Canyon ($10 off per person)'
                  }
                  data-no-drag
                >
                  {convertingLowerToX ? '...' : 'L > X'}
                </button>
              ) : null}
              {!isPrivateTour ? (
                <button
                  type="button"
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                  title={tInfo('regularTourTooltip')}
                  data-no-drag
                >
                  {tInfo('regularTour')}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                title={tInfo('maxParticipantsTooltip', { count: resolvedMaxParticipants })}
                data-no-drag
              >
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums">
                  {resolvedMaxParticipants}
                  {params.locale === 'ko' ? '명' : ''}
                </span>
              </button>
              {onPrintTourInfo ? (
                <button
                  type="button"
                  onClick={onPrintTourInfo}
                  className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                  title={params.locale === 'ko' ? '투어 정보 인쇄' : 'Print tour info'}
                >
                  <FileText className="h-4 w-4" />
                </button>
              ) : null}
              {onSendGuideScheduleAssignment ? (
                <button
                  type="button"
                  onClick={onSendGuideScheduleAssignment}
                  className="rounded-md border border-violet-200 bg-violet-50 p-1.5 text-violet-700 hover:bg-violet-100"
                  title={params.locale === 'ko' ? '가이드·어시 스케줄 부여 SMS' : 'Send schedule assignment SMS'}
                  data-no-drag
                >
                  <UserCheck className="h-4 w-4" />
                </button>
              ) : null}
              {onSendGuideScheduleConfirm ? (
                <button
                  type="button"
                  onClick={onSendGuideScheduleConfirm}
                  className="rounded-md border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100"
                  title={params.locale === 'ko' ? '가이드·어시 스케줄 컨펌 발송' : 'Send schedule confirm'}
                  data-no-drag
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              ) : null}
              {onViewAssignmentHistory ? (
                <button
                  type="button"
                  onClick={onViewAssignmentHistory}
                  className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-slate-700 hover:bg-slate-100"
                  title={params.locale === 'ko' ? '배정·컨펌 기록' : 'Assignment history'}
                  data-no-drag
                >
                  <History className="h-4 w-4" />
                </button>
              ) : null}
              {onViewNarrationHistory ? (
                <button
                  type="button"
                  onClick={onViewNarrationHistory}
                  className="rounded-md border border-sky-200 bg-sky-50 p-1.5 text-sky-700 hover:bg-sky-100"
                  title={params.locale === 'ko' ? '나레이션 재생 히스토리' : 'Narration history'}
                  data-no-drag
                >
                  <Headphones className="h-4 w-4" />
                </button>
              ) : null}
              {onPrintReceipts ? (
                <button
                  type="button"
                  onClick={onPrintReceipts}
                  className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                  title={params.locale === 'ko' ? '영수증 일괄 인쇄' : 'Print receipts'}
                >
                  <Printer className="h-4 w-4" />
                </button>
              ) : null}
              {onPrintTipEnvelopes ? (
                <button
                  type="button"
                  onClick={onPrintTipEnvelopes}
                  className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                  title={params.locale === 'ko' ? '팁 봉투 인쇄' : 'Print tip envelopes'}
                >
                  <Mail className="h-4 w-4" />
                </button>
              ) : null}
              {onPrintBalanceEnvelopes ? (
                <button
                  type="button"
                  onClick={onPrintBalanceEnvelopes}
                  className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                  title={params.locale === 'ko' ? 'Balance 봉투 인쇄' : 'Print balance envelopes'}
                >
                  <DollarSign className="h-4 w-4" />
                </button>
              ) : null}
              <div className="max-w-[88px] flex-shrink-0 sm:max-w-none">
                <TourSunriseTime tourDate={tour.tour_date} />
              </div>
            </div>
            <StatusManagement
              tour={tour}
              showTourStatusDropdown={showTourStatusDropdown}
              showAssignmentStatusDropdown={showAssignmentStatusDropdown}
              tourStatusOptions={tourStatusOptions}
              assignmentStatusOptions={assignmentStatusOptions}
              getTotalAssignedPeople={getTotalAssignedPeople}
              getTotalPeopleNonCancelled={getTotalPeopleNonCancelled}
              getTotalCancelledPeople={getTotalCancelledPeople}
              onToggleTourStatusDropdown={onToggleTourStatusDropdown}
              onToggleAssignmentStatusDropdown={onToggleAssignmentStatusDropdown}
              onUpdateTourStatus={onUpdateTourStatus}
              onUpdateAssignmentStatus={onUpdateAssignmentStatus}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              getAssignmentStatusColor={getAssignmentStatusColor}
              getAssignmentStatusText={getAssignmentStatusText}
              locale={params.locale}
              {...(onEditClick ? { onEditClick } : {})}
              {...(onCopyTour ? { onCopyTour } : {})}
              {...(onDeleteTour ? { onDeleteTour } : {})}
              {...(onRestoreTour ? { onRestoreTour } : {})}
              {...(onCloseModal ? { onCloseModal } : {})}
            />
            <div className="hidden items-center gap-3 lg:flex">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(true)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${getStatusColor(tour.tour_status)} hover:opacity-80`}
                >
                  {t('tour')}: {getStatusText(tour.tour_status, params.locale)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(true)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${getAssignmentStatusColor(tour)} hover:opacity-80`}
                >
                  {t('assignment')}: {getAssignmentStatusText(tour, params.locale)}
                </button>
              </div>
              <div className="rounded-lg border border-border bg-white px-3 py-1.5 text-center text-xs">
                <div className="font-semibold text-primary tabular-nums">
                  {getTotalAssignedPeople} / {getTotalPeopleNonCancelled} / {getTotalCancelledPeople}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={onCopyTour}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={14} className="inline mr-1" />
                  {t('copy')}
                </button>
                {onRestoreTour ? (
                  <button
                    type="button"
                    onClick={onRestoreTour}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100"
                  >
                    <RotateCcw size={14} className="inline mr-1" />
                    {params.locale === 'ko' ? '복구' : 'Restore'}
                  </button>
                ) : (
                  <button
                    onClick={onDeleteTour}
                    className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={14} className="inline mr-1" />
                    {t('delete')}
                  </button>
                )}
                <button
                  onClick={onEditClick}
                  className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15"
                >
                  <Edit size={14} className="inline mr-1" />
                  {t('edit')}
                </button>
                {onCloseModal ? (
                  <button
                    type="button"
                    onClick={onCloseModal}
                    className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label={params.locale === 'ko' ? '닫기' : 'Close'}
                    title={params.locale === 'ko' ? '닫기' : 'Close'}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {!embeddedInModal ? (
              <button
                onClick={() => router.push(`/${params.locale}/admin/tours`)}
                className="flex-shrink-0 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 sm:p-2"
              >
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                {!embeddedInModal ? (
                  <h1 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900 sm:text-xl">
                    {productName || 'Tour Detail'}
                  </h1>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-gray-600 sm:text-sm">
                    <span>
                      {params.locale === 'ko' ? '투어 ID' : 'Tour ID'}: {tour.id}
                    </span>
                    <span className="hidden sm:inline">|</span>
                    <span>
                      {params.locale === 'ko' ? '날짜' : 'Date'}: {tour.tour_date || ''}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                      {getStatusText(tour.tour_status, params.locale)}
                    </span>
                  </div>
                )}
                <div className="max-w-[80px] flex-shrink-0 min-w-0 sm:max-w-none">
                  <TourSunriseTime tourDate={tour.tour_date} />
                </div>
                {onPrintTourInfo && (
                  <button
                    type="button"
                    onClick={onPrintTourInfo}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
                    title={params.locale === 'ko' ? '투어 정보 인쇄 (팀/픽업/부킹)' : 'Print tour info'}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                )}
                {onSendGuideScheduleAssignment && (
                  <button
                    type="button"
                    onClick={onSendGuideScheduleAssignment}
                    className="p-2 rounded-lg hover:bg-violet-50 text-violet-700 flex-shrink-0"
                    title={params.locale === 'ko' ? '가이드·어시 스케줄 부여 SMS' : 'Send schedule assignment SMS'}
                  >
                    <UserCheck className="w-5 h-5" />
                  </button>
                )}
                {onSendGuideScheduleConfirm && (
                  <button
                    type="button"
                    onClick={onSendGuideScheduleConfirm}
                    className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-700 flex-shrink-0"
                    title={params.locale === 'ko' ? '가이드·어시 스케줄 컨펌 발송' : 'Send schedule confirm'}
                  >
                    <Smartphone className="w-5 h-5" />
                  </button>
                )}
                {onViewAssignmentHistory && (
                  <button
                    type="button"
                    onClick={onViewAssignmentHistory}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-700 flex-shrink-0"
                    title={params.locale === 'ko' ? '배정·컨펌 기록' : 'Assignment history'}
                  >
                    <History className="w-5 h-5" />
                  </button>
                )}
                {onViewNarrationHistory && (
                  <button
                    type="button"
                    onClick={onViewNarrationHistory}
                    className="p-2 rounded-lg hover:bg-sky-50 text-sky-700 flex-shrink-0"
                    title={params.locale === 'ko' ? '나레이션 재생 히스토리' : 'Narration history'}
                  >
                    <Headphones className="w-5 h-5" />
                  </button>
                )}
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
                {onPrintTipEnvelopes && (
                  <button
                    type="button"
                    onClick={onPrintTipEnvelopes}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
                    title={params.locale === 'ko' ? '팁 봉투 인쇄' : 'Print tip envelopes'}
                  >
                    <Mail className="w-5 h-5" />
                  </button>
                )}
                {onPrintBalanceEnvelopes && (
                  <button
                    type="button"
                    onClick={onPrintBalanceEnvelopes}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
                    title={params.locale === 'ko' ? 'Balance 봉투 인쇄' : 'Print balance envelopes'}
                  >
                    <DollarSign className="w-5 h-5" />
                  </button>
                )}
              </div>
              {!embeddedInModal ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:text-sm">
                  <span>{params.locale === 'ko' ? '투어 ID' : 'Tour ID'}: {tour.id}</span>
                  <span className="hidden sm:inline">|</span>
                  <span>{params.locale === 'ko' ? '날짜' : 'Date'}: {tour.tour_date || ''}</span>
                  <span className="hidden sm:inline">|</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                    {getStatusText(tour.tour_status, params.locale)}
                  </span>
                </div>
              ) : null}
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
            getTotalPeopleNonCancelled={getTotalPeopleNonCancelled}
            getTotalCancelledPeople={getTotalCancelledPeople}
            onToggleTourStatusDropdown={onToggleTourStatusDropdown}
            onToggleAssignmentStatusDropdown={onToggleAssignmentStatusDropdown}
            onUpdateTourStatus={onUpdateTourStatus}
            onUpdateAssignmentStatus={onUpdateAssignmentStatus}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            getAssignmentStatusColor={getAssignmentStatusColor}
            getAssignmentStatusText={getAssignmentStatusText}
            locale={params.locale}
            {...(onEditClick ? { onEditClick } : {})}
            {...(onCopyTour ? { onCopyTour } : {})}
            {...(onDeleteTour ? { onDeleteTour } : {})}
            {...(onRestoreTour ? { onRestoreTour } : {})}
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
            <div className="text-center bg-primary/5 rounded-lg px-4 py-3 border border-border">
              <div className="text-xl font-bold text-primary flex items-center justify-center gap-2">
                {getTotalAssignedPeople} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span> / {getTotalPeopleNonCancelled} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span> / {getTotalCancelledPeople} <span className={params.locale === 'ko' ? '' : 'hidden'}>명</span>
              </div>
              <div className="text-xs text-primary mt-1">
                {t('assignedFull')} / {t('total')} / {t('cancelled')}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button 
                onClick={onCopyTour}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
              >
                <Copy size={16} />
                <span>{t('copy')}</span>
              </button>
              {onRestoreTour ? (
                <button
                  type="button"
                  onClick={onRestoreTour}
                  className="px-4 py-2 text-emerald-800 bg-emerald-100 rounded-lg hover:bg-emerald-200 flex items-center space-x-2"
                >
                  <RotateCcw size={16} />
                  <span>{params.locale === 'ko' ? '복구' : 'Restore'}</span>
                </button>
              ) : (
                <button 
                  onClick={onDeleteTour}
                  className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center space-x-2"
                >
                  <Trash2 size={16} />
                  <span>{t('delete')}</span>
                </button>
              )}
              <button 
                onClick={onEditClick}
                className="px-4 py-2 text-primary bg-primary/10 rounded-lg hover:bg-blue-200 flex items-center space-x-2"
              >
                <Edit size={16} />
                <span>{t('edit')}</span>
              </button>
            </div>
          </div>
        </div>
        )}
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
