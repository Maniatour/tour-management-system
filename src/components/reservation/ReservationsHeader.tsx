'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import React from "react"
import { useTranslations } from 'next-intl'
import { Plus, Search, Grid3X3, CalendarDays, AlertCircle, SlidersHorizontal, Trash2, ListChecks, LayoutList, X, BarChart3 } from 'lucide-react'
import AdminPageHubManualButton from '@/components/admin/AdminPageHubManualButton'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import {
  reservationAdminManualDocument,
  reservationAdminManualTitles,
  RESERVATION_ADMIN_MANUAL_SLUG,
} from '@/lib/reservationAdminManualDocument'
import { getCustomerName } from '@/utils/reservationUtils'
import type { Customer } from '@/types/reservation'

interface ReservationsHeaderProps {
  customerIdFromUrl: string | null
  customers: Customer[]
  viewMode: 'card' | 'calendar' | 'list'
  onViewModeChange: (mode: 'card' | 'calendar' | 'list') => void
  searchTerm: string
  onSearchChange: (term: string) => void
  /** 검색어 적용 + 목록 뷰 전환(예약 관리) */
  onSearchSubmit?: () => void
  onAddReservation: () => void
  onActionRequired?: () => void
  actionRequiredCount?: number
  /** 주간 통계 모달 (카드 뷰·날짜 그룹 등) */
  onOpenWeeklyStats?: () => void
  /** 데스크톱 제목줄에 필터 버튼 표시 (클릭 시 호출) */
  onOpenFilter?: () => void
  /** soft-delete(status=deleted) 예약 목록 모달 */
  onOpenDeletedReservations?: () => void
  /** Follow-up 단계별 대기 예약 모달 */
  onOpenFollowUpQueue?: () => void
  followUpQueueCount?: number
  /** 취소 사유 미기록 Follow-up 큐 */
  onOpenCancelReasonQueue?: () => void
  cancelReasonQueueCount?: number
  /** 처리 필요·Follow-up 버튼 hover/focus 시 운영 큐 선로드 */
  onPrefetchOperationalQueue?: () => void
}

type IconHeaderButtonProps = {
  label: string
  onClick: () => void
  icon: React.ReactNode
  className?: string
  count?: number
  onMouseEnter?: () => void
  onFocus?: () => void
}

function IconHeaderButton({
  label,
  onClick,
  icon,
  className = 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  count = 0,
  onMouseEnter,
  onFocus,
}: IconHeaderButtonProps) {
  return (
    <ScheduleHoverTooltip content={label} placement="below">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        aria-label={label}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-medium ${className}`}
      >
        {icon}
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold tabular-nums text-gray-900 shadow-sm ring-1 ring-black/10"
          >
            {count}
          </span>
        )}
      </button>
    </ScheduleHoverTooltip>
  )
}

function ReservationsHeader({
  customerIdFromUrl,
  customers,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  onAddReservation,
  onActionRequired,
  actionRequiredCount = 0,
  onOpenWeeklyStats,
  onOpenFilter,
  onOpenDeletedReservations,
  onOpenFollowUpQueue,
  followUpQueueCount = 0,
  onOpenCancelReasonQueue,
  cancelReasonQueueCount = 0,
  onPrefetchOperationalQueue,
}: ReservationsHeaderProps) {
  const t = useTranslations('reservations')

  const handleOperationalQueuePrefetch = () => {
    onPrefetchOperationalQueue?.()
  }

  const renderActionRequired = () =>
    typeof onActionRequired === 'function' ? (
      <IconHeaderButton
        label={t('actionRequired.button')}
        onClick={onActionRequired}
        onMouseEnter={handleOperationalQueuePrefetch}
        onFocus={handleOperationalQueuePrefetch}
        count={actionRequiredCount}
        className={
          actionRequiredCount > 0
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
        icon={<AlertCircle className="h-4 w-4" aria-hidden />}
      />
    ) : null

  const renderWeeklyStats = () =>
    typeof onOpenWeeklyStats === 'function' ? (
      <IconHeaderButton
        label={t('stats.weeklyStatsOpenModal')}
        onClick={onOpenWeeklyStats}
        className="bg-gray-100 text-gray-700 hover:bg-gray-200"
        icon={<BarChart3 className="h-4 w-4" aria-hidden />}
      />
    ) : null

  const renderFollowUp = () =>
    typeof onOpenFollowUpQueue === 'function' ? (
      <IconHeaderButton
        label={t('followUpPipeline.headerButton')}
        onClick={onOpenFollowUpQueue}
        onMouseEnter={handleOperationalQueuePrefetch}
        onFocus={handleOperationalQueuePrefetch}
        count={followUpQueueCount}
        className={
          followUpQueueCount > 0
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
        icon={<ListChecks className="h-4 w-4" aria-hidden />}
      />
    ) : null

  const renderCancelReasonQueue = () =>
    typeof onOpenCancelReasonQueue === 'function' ? (
      <IconHeaderButton
        label={t('cancelReasonQueue.headerButton')}
        onClick={onOpenCancelReasonQueue}
        count={cancelReasonQueueCount}
        className={
          cancelReasonQueueCount > 0
            ? 'bg-rose-600 text-white hover:bg-rose-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
        icon={<X className="h-4 w-4" aria-hidden />}
      />
    ) : null

  const renderDeleted = () =>
    typeof onOpenDeletedReservations === 'function' ? (
      <IconHeaderButton
        label={t('openDeletedReservationsModal')}
        onClick={onOpenDeletedReservations}
        className="bg-gray-700 text-white hover:bg-gray-800"
        icon={<Trash2 className="h-4 w-4" aria-hidden />}
      />
    ) : null

  const renderAdd = () => (
    <IconHeaderButton
      label={t('addReservation')}
      onClick={onAddReservation}
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      icon={<Plus className="h-4 w-4" aria-hidden />}
    />
  )

  return (
    <div className="space-y-3 md:space-y-4">
      {/* 1줄: 제목·뷰 전환·(모바일) 새 예약 / (데스크톱) 검색~추가 전체 */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-2">
        <div className="flex min-w-0 items-center justify-between gap-2 md:justify-start sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <h1 className="flex-shrink-0 text-xl font-bold text-gray-900 sm:text-2xl">
            {customerIdFromUrl ? (
              <div className="flex items-center space-x-2">
                <span>{t('title')}</span>
                <span className="text-lg text-gray-500">-</span>
                <span className="truncate text-lg text-primary">
                  {getCustomerName(customerIdFromUrl, customers || [])}
                </span>
              </div>
            ) : (
              t('title')
            )}
          </h1>

          <AdminPageHubManualButton
            slug={RESERVATION_ADMIN_MANUAL_SLUG}
            fallbackDoc={reservationAdminManualDocument}
            fallbackTitle={reservationAdminManualTitles}
            storageKey="reservations-page-manual-modal-rect-v1"
          />

          <div className="flex shrink-0 items-center space-x-1">
            <button
              type="button"
              onClick={() => onViewModeChange('card')}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid3X3 className="h-3 w-3" />
              <span className="hidden sm:inline">{t('viewCard')}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('calendar')}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span className="hidden sm:inline">{t('viewCalendar')}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LayoutList className="h-3 w-3" />
              <span className="hidden sm:inline">{t('viewList')}</span>
            </button>
          </div>
          </div>
          <div className="shrink-0 md:hidden">{renderAdd()}</div>
        </div>

        {/* 데스크톱: 검색 · 예약 처리 필요 · Follow-up · 필터 · 삭제 · 새 예약 */}
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex">
          <div className="relative flex w-44 shrink-0 items-center gap-1.5 sm:w-48 lg:w-52">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-[14px] -translate-y-1/2 text-gray-400" />
              <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && typeof onSearchSubmit === 'function') {
                    e.preventDefault()
                    onSearchSubmit()
                  }
                }}
                className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs focus:border-transparent focus:ring-1 focus:ring-ring sm:text-sm"
              />
            </div>
            {typeof onSearchSubmit === 'function' && (
              <button
                type="button"
                onClick={onSearchSubmit}
                title={t('search')}
                aria-label={t('search')}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-700 text-white hover:bg-slate-800"
              >
                <Search className="size-[18px]" aria-hidden />
              </button>
            )}
          </div>
          {renderActionRequired()}
          {renderWeeklyStats()}
          {renderCancelReasonQueue()}
          {renderFollowUp()}
          {typeof onOpenFilter === 'function' && (
            <IconHeaderButton
              label={t('filter')}
              onClick={onOpenFilter}
              className="bg-blue-600 text-white hover:bg-primary/90"
              icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            />
          )}
          {renderDeleted()}
          {renderAdd()}
        </div>
      </div>

      {/* 모바일 2줄: 예약 처리 필요 · Follow-up 단계 · 삭제된 예약 */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {renderActionRequired()}
        {renderWeeklyStats()}
        {renderCancelReasonQueue()}
        {renderFollowUp()}
        {renderDeleted()}
      </div>
    </div>
  )
}

export default React.memo(ReservationsHeader)
