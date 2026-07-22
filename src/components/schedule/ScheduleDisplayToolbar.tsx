'use client'

import { MapPin, RotateCcw, Users } from 'lucide-react'

export type ScheduleDisplayToolbarProps = {
  locale: string
  dateRangeLabel: string
  displayDayCount: number
  selectedProductCount: number
  selectedTeamCount: number
  isRefreshing: boolean
  onRefresh: () => void
}

export default function ScheduleDisplayToolbar({
  locale,
  dateRangeLabel,
  displayDayCount,
  selectedProductCount,
  selectedTeamCount,
  isRefreshing,
  onRefresh,
}: ScheduleDisplayToolbarProps) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-y-2 min-h-10 sm:min-h-11 mb-2">
      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium tabular-nums"
          title={locale === 'ko' ? '표시 중인 상품' : 'Visible products'}
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {selectedProductCount}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium tabular-nums"
          title={locale === 'ko' ? '표시 중인 팀원' : 'Visible team members'}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          {selectedTeamCount}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-2">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap text-center">
          {dateRangeLabel}
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({displayDayCount}
            {locale === 'ko' ? '일' : ' days'})
          </span>
        </h3>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-2 sm:text-xs"
          title={locale === 'ko' ? '데이터 새로고침' : 'Refresh data'}
          aria-label={locale === 'ko' ? '데이터 새로고침' : 'Refresh data'}
        >
          <RotateCcw
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden
          />
          <span className="hidden sm:inline">{locale === 'ko' ? '새로고침' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  )
}
