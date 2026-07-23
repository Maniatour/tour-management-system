'use client'

import type { ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import ScheduleDisplayTourList from '@/components/schedule/ScheduleDisplayTourList'
import { ScheduleDisplayCalendarNav, type ScheduleDisplayCalendarTourSummary } from '@/components/schedule/ScheduleDisplayCalendar'
import ScheduleDisplayStatusFilterModal from '@/components/schedule/ScheduleDisplayStatusFilterModal'
import { getScheduleDisplayThreeWeekDateRange } from '@/lib/scheduleDisplayCalendarMeta'
import type { OfficeScheduleDayStaffChip } from '@/lib/officeScheduleDayStaff'
import type { ScheduleDisplayStatusFilterId } from '@/lib/scheduleDisplayStatusFilter'

type TourLike = { id: string; tour_date?: string | null; tour_status?: string | null; product_id?: string | null }

export type ScheduleDisplayAsidePanelProps<T extends TourLike = TourLike> = {
  locale: string
  gridPanel: ReactNode
  displayCalendarWeekStart: Date
  onDisplayCalendarWeekStartChange: (weekStart: Date) => void
  displayCalendarStatusFilter: Set<ScheduleDisplayStatusFilterId>
  onDisplayCalendarStatusFilterChange: (filter: Set<ScheduleDisplayStatusFilterId>) => void
  displayStatusFilterModalOpen: boolean
  onDisplayStatusFilterModalOpenChange: (open: boolean) => void
  displayToursByDate: Map<string, T[]>
  displayCalendarVisibleTourCount: number
  displayCalendarStatusFilterActiveCount: number
  getTourDisplayCalendarSummary: (tour: T) => ScheduleDisplayCalendarTourSummary
  officeStaffByDate?: Record<string, OfficeScheduleDayStaffChip[]>
  onTourClick: (tour: T) => void
  onAssignStaff: (tour: T) => void
  onAssignVehicle: (tour: T) => void
  footerSlot?: ReactNode
}

export default function ScheduleDisplayAsidePanel<T extends TourLike>({
  locale,
  gridPanel,
  displayCalendarWeekStart,
  onDisplayCalendarWeekStartChange,
  displayCalendarStatusFilter,
  onDisplayCalendarStatusFilterChange,
  displayStatusFilterModalOpen,
  onDisplayStatusFilterModalOpenChange,
  displayToursByDate,
  displayCalendarVisibleTourCount,
  displayCalendarStatusFilterActiveCount,
  getTourDisplayCalendarSummary,
  officeStaffByDate,
  onTourClick,
  onAssignStaff,
  onAssignVehicle,
  footerSlot,
}: ScheduleDisplayAsidePanelProps<T>) {
  const { start: calRangeStart, end: calRangeEnd } =
    getScheduleDisplayThreeWeekDateRange(displayCalendarWeekStart)

  const statusFilterButton = (
    <button
      type="button"
      onClick={() => onDisplayStatusFilterModalOpenChange(true)}
      className="relative inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
      aria-label={locale === 'ko' ? '투어 상태 필터' : 'Tour status filter'}
      title={locale === 'ko' ? '투어 상태 필터' : 'Tour status filter'}
    >
      <ListFilter className="h-3.5 w-3.5" aria-hidden />
      <span>{locale === 'ko' ? '상태' : 'Status'}</span>
      <span className="tabular-nums text-muted-foreground">
        ({displayCalendarStatusFilterActiveCount})
      </span>
    </button>
  )

  return (
    <div className="flex w-full flex-col gap-0 bg-slate-50 lg:h-full lg:min-h-0 lg:flex-row">
      <div className="min-w-0 w-full p-2 sm:p-3 lg:min-h-0 lg:w-1/2 lg:flex-none lg:shrink-0 lg:overflow-auto">
        {gridPanel}
      </div>
      <aside className="flex w-full min-w-0 flex-col border-t border-border bg-white lg:h-full lg:min-h-0 lg:max-h-full lg:flex-1 lg:overflow-hidden lg:border-l lg:border-t-0">
        <div className="shrink-0 border-b border-border bg-white px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 lg:flex-nowrap lg:whitespace-nowrap">
              <h2 className="shrink-0 text-sm font-semibold text-foreground">
                {locale === 'ko' ? '다가오는 투어' : 'Upcoming tours'}
              </h2>
              <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {calRangeStart} ~ {calRangeEnd}
                <span className="ml-1">({displayCalendarVisibleTourCount})</span>
              </p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              {statusFilterButton}
              <ScheduleDisplayCalendarNav
                locale={locale}
                weekStart={displayCalendarWeekStart}
                onWeekStartChange={onDisplayCalendarWeekStartChange}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 lg:hidden">
            {statusFilterButton}
            <ScheduleDisplayCalendarNav
              locale={locale}
              weekStart={displayCalendarWeekStart}
              onWeekStartChange={onDisplayCalendarWeekStartChange}
            />
          </div>
        </div>
        <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <ScheduleDisplayTourList
            toursByDate={displayToursByDate}
            getTourSummary={getTourDisplayCalendarSummary}
            locale={locale}
            weekStart={displayCalendarWeekStart}
            {...(officeStaffByDate ? { officeStaffByDate } : {})}
            onTourClick={onTourClick}
            onAssignStaff={onAssignStaff}
            onAssignVehicle={onAssignVehicle}
          />
        </div>
      </aside>
      <ScheduleDisplayStatusFilterModal
        open={displayStatusFilterModalOpen}
        onOpenChange={onDisplayStatusFilterModalOpenChange}
        locale={locale}
        selected={displayCalendarStatusFilter}
        onApply={onDisplayCalendarStatusFilterChange}
      />
      {footerSlot}
    </div>
  )
}
