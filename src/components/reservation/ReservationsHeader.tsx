'use client'

import React from "react"
import { useTranslations } from 'next-intl'
import { Plus, Search, Grid3X3, CalendarDays, AlertCircle, SlidersHorizontal, List, LayoutTemplate, Trash2, ListChecks } from 'lucide-react'
import { getCustomerName } from '@/utils/reservationUtils'
import type { Customer } from '@/types/reservation'

interface ReservationsHeaderProps {
  customerIdFromUrl: string | null
  customers: Customer[]
  viewMode: 'card' | 'calendar'
  onViewModeChange: (mode: 'card' | 'calendar') => void
  searchTerm: string
  onSearchChange: (term: string) => void
  onAddReservation: () => void
  onActionRequired?: () => void
  actionRequiredCount?: number
  /** 데스크톱 제목줄에 필터 버튼 표시 (클릭 시 호출) */
  onOpenFilter?: () => void
  /** 카드 뷰일 때만 사용: 상세 / 간단 카드 전환  */
  cardLayout?: 'standard' | 'simple'
  onCardLayoutChange?: (layout: 'standard' | 'simple') => void
  /** soft-delete(status=deleted) 예약 목록 모달 */
  onOpenDeletedReservations?: () => void
  /** Follow-up 단계별 대기 예약 모달 */
  onOpenFollowUpQueue?: () => void
  followUpQueueCount?: number
}

export default function ReservationsHeader({
  customerIdFromUrl,
  customers,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  onAddReservation,
  onActionRequired,
  actionRequiredCount = 0,
  onOpenFilter,
  cardLayout = 'standard',
  onCardLayoutChange,
  onOpenDeletedReservations,
  onOpenFollowUpQueue,
  followUpQueueCount = 0,
}: ReservationsHeaderProps) {
  const t = useTranslations('reservations')

  const renderActionRequired = () =>
    typeof onActionRequired === 'function' ? (
      <button
        type="button"
        onClick={onActionRequired}
        className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
          actionRequiredCount > 0
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title={t('actionRequired.button')}
      >
        <AlertCircle size={16} />
        <span className="hidden sm:inline">{t('actionRequired.button')}</span>
        {actionRequiredCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
            {actionRequiredCount}
          </span>
        )}
      </button>
    ) : null

  const renderFollowUp = () =>
    typeof onOpenFollowUpQueue === 'function' ? (
      <button
        type="button"
        onClick={onOpenFollowUpQueue}
        className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
          followUpQueueCount > 0
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title={t('followUpPipeline.headerButton')}
      >
        <ListChecks size={16} />
        <span className="hidden sm:inline">{t('followUpPipeline.headerButton')}</span>
        {followUpQueueCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-xs tabular-nums">
            {followUpQueueCount}
          </span>
        )}
      </button>
    ) : null

  const renderDeleted = () =>
    typeof onOpenDeletedReservations === 'function' ? (
      <button
        type="button"
        onClick={onOpenDeletedReservations}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-700 text-white hover:bg-gray-800 md:h-auto md:w-auto md:gap-1.5 md:px-3 md:py-1.5 text-sm font-medium"
        title={t('openDeletedReservationsModal')}
        aria-label={t('openDeletedReservationsModal')}
      >
        <Trash2 className="h-[1.125rem] w-[1.125rem] shrink-0 md:h-4 md:w-4" aria-hidden />
        <span className="hidden md:inline">{t('openDeletedReservationsModal')}</span>
      </button>
    ) : null

  const renderAdd = () => (
    <button
      type="button"
      onClick={onAddReservation}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 md:h-auto md:w-auto md:gap-1.5 md:px-3 md:py-1.5 text-sm font-medium"
      title={t('addReservation')}
      aria-label={t('addReservation')}
    >
      <Plus className="h-[1.125rem] w-[1.125rem] shrink-0 md:h-4 md:w-4" aria-hidden />
      <span className="hidden md:inline">{t('addReservation')}</span>
    </button>
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
                <span className="truncate text-lg text-blue-600">
                  {getCustomerName(customerIdFromUrl, customers || [])}
                </span>
              </div>
            ) : (
              t('title')
            )}
          </h1>

          <div className="flex shrink-0 items-center space-x-1">
            <button
              type="button"
              onClick={() => onViewModeChange('card')}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === 'card' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid3X3 className="h-3 w-3" />
              <span className="hidden sm:inline">{t('viewCard')}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('calendar')}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span className="hidden sm:inline">{t('viewCalendar')}</span>
            </button>
            {viewMode === 'card' && typeof onCardLayoutChange === 'function' && (
              <div className="ml-1 flex items-center space-x-1 border-l border-gray-200 pl-2">
                <button
                  type="button"
                  onClick={() => onCardLayoutChange('simple')}
                  className={`flex items-center justify-center rounded-md p-1.5 text-xs transition-colors ${
                    cardLayout === 'simple'
                      ? 'bg-slate-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={t('viewCardSimple')}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onCardLayoutChange('standard')}
                  className={`flex items-center justify-center rounded-md p-1.5 text-xs transition-colors ${
                    cardLayout === 'standard'
                      ? 'bg-slate-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={t('viewCardStandard')}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          </div>
          <div className="shrink-0 md:hidden">{renderAdd()}</div>
        </div>

        {/* 데스크톱: 검색 · 예약 처리 필요 · Follow-up · 필터 · 삭제 · 새 예약 */}
        <div className="hidden max-w-2xl flex-1 items-center justify-end gap-2 md:flex">
          <div className="relative min-w-[12rem] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-[14px] -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value)
              }}
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs focus:border-transparent focus:ring-1 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          {renderActionRequired()}
          {renderFollowUp()}
          {typeof onOpenFilter === 'function' && (
            <button
              type="button"
              onClick={onOpenFilter}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <SlidersHorizontal size={16} />
              <span>{t('filter')}</span>
            </button>
          )}
          {renderDeleted()}
          {renderAdd()}
        </div>
      </div>

      {/* 모바일 2줄: 예약 처리 필요 · Follow-up 단계 · 삭제된 예약 */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {renderActionRequired()}
        {renderFollowUp()}
        {renderDeleted()}
      </div>
    </div>
  )
}
