'use client'

import React, { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, Minus, Equal } from 'lucide-react'
import { getStatusLabel } from '@/utils/reservationUtils'

/** 통계 패널 상단 — 선택 주(달력 일수) 등록·취소·순 및 일평균 */
export type StatisticsWeekHeaderSummary = {
  calendarDayCount: number
  regBookings: number
  regPeople: number
  cancelBookings: number
  cancelPeople: number
  netBookings: number
  netPeople: number
  avgRegBookingsPerDay: number
  avgRegPeoplePerDay: number
  avgCancelBookingsPerDay: number
  avgCancelPeoplePerDay: number
  avgNetBookingsPerDay: number
  avgNetPeoplePerDay: number
}

export type WeeklyRegCancelDayRow = {
  dateKey: string
  registeredPeople: number
  registeredCount: number
  cancelledPeople: number
  cancelledCount: number
  /** 요일(7일·월) 또는 연간 월별 일평균 등록 — 표시 구간에 포함된 연도만 반영 */
  avgLineRegistered?: number
}

interface WeeklyStatsPanelProps {
  currentWeek: number
  onWeekChange: (week: number) => void
  onInitialLoadChange: (isInitial: boolean) => void
  isInitialLoad: boolean
  weeklyStats: {
    productStats: Array<[string, number]>
    channelStats: Array<{
      name: string
      count: number
      favicon_url: string | null
      channelId: string
    }>
    statusStats: Array<[string, number]>
    totalReservations: number
    totalPeople: number
  }
  /** 일별 등록·취소 인원 차트 (7일·월간·연간 구간은 부모에서 집계) */
  weeklyRegCancelByDay?: WeeklyRegCancelDayRow[]
  regCancelGranularity?: 'week' | 'month' | 'year'
  onRegCancelGranularityChange?: (g: 'week' | 'month' | 'year') => void
  regCancelMonthOffset?: number
  onRegCancelMonthOffsetChange?: (v: React.SetStateAction<number>) => void
  regCancelYearOffset?: number
  onRegCancelYearOffsetChange?: (v: React.SetStateAction<number>) => void
  /** 차트에 적용 중인 날짜 구간(로컬) */
  chartRangeSubtitle?: string
  isWeeklyStatsCollapsed: boolean
  onToggleStatsCollapsed: () => void
  weekHeaderSummary: StatisticsWeekHeaderSummary
  formatWeekRange: (weekOffset: number) => { display: string }
}

export default function WeeklyStatsPanel({
  currentWeek,
  onWeekChange,
  onInitialLoadChange,
  isInitialLoad,
  weeklyStats,
  weeklyRegCancelByDay = [],
  regCancelGranularity = 'week',
  onRegCancelGranularityChange,
  regCancelMonthOffset = 0,
  onRegCancelMonthOffsetChange,
  regCancelYearOffset = 0,
  onRegCancelYearOffsetChange,
  chartRangeSubtitle = '',
  isWeeklyStatsCollapsed,
  onToggleStatsCollapsed,
  weekHeaderSummary,
  formatWeekRange
}: WeeklyStatsPanelProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()

  type RegCancelChartRow = WeeklyRegCancelDayRow & {
    shortLabel: string
    /** 7일 탭: 툴팁·평균선이 “월요일 평균”처럼 읽히도록 전체 요일명 */
    weekdayLongForAvg?: string
    /** 스택 하단(초록): 당일 취소 처리 인원(updated_at), 막대 높이는 등록 인원에 맞춤 */
    cancelStackPeople: number
    /** 스택 상단(회색): 등록 인원 − 스택에 쓴 취소(겹침 표시) */
    remainingPeople: number
    avgLineRegistered: number
  }

  const regCancelChartData = useMemo((): RegCancelChartRow[] => {
    const tag = locale === 'ko' ? 'ko-KR' : 'en-US'
    return weeklyRegCancelByDay.map((row) => {
      const cancelStackPeople = Math.min(row.cancelledPeople, row.registeredPeople)
      const remainingPeople = row.registeredPeople - cancelStackPeople
      let shortLabel: string
      let weekdayLongForAvg: string | undefined
      if (/^\d{4}-\d{2}$/.test(row.dateKey)) {
        const [y, m] = row.dateKey.split('-').map(Number)
        shortLabel = new Date(y, m - 1, 1).toLocaleDateString(tag, { year: 'numeric', month: 'short' })
      } else if (/^\d{4}$/.test(row.dateKey)) {
        shortLabel = locale === 'ko' ? `${row.dateKey}년` : row.dateKey
      } else if (regCancelGranularity === 'week' && /^\d{4}-\d{2}-\d{2}$/.test(row.dateKey)) {
        const dt = new Date(`${row.dateKey}T12:00:00`)
        weekdayLongForAvg = dt.toLocaleDateString(tag, { weekday: 'long' })
        const wdShort = dt.toLocaleDateString(tag, { weekday: 'short' })
        const md = dt.toLocaleDateString(tag, { month: 'numeric', day: 'numeric' })
        shortLabel = locale === 'ko' ? `${wdShort} (${md})` : `${wdShort} ${md}`
      } else {
        shortLabel = new Date(`${row.dateKey}T12:00:00`).toLocaleDateString(tag, {
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        })
      }
      return {
        ...row,
        weekdayLongForAvg,
        cancelStackPeople,
        remainingPeople,
        shortLabel,
        avgLineRegistered: row.avgLineRegistered ?? 0,
      }
    })
  }, [weeklyRegCancelByDay, locale, regCancelGranularity])

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg">
      {/* 주간 네비게이션 헤더 - 초컴팩트 모바일 최적화 */}
      <div className="p-2 sm:p-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          {/* 제목과 통계 정보 - 한 줄에 압축 */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-blue-800/90">
              {t('stats.statsSectionLabel')}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-x-4">
              <h3 className="text-sm sm:text-lg font-semibold text-blue-900 whitespace-nowrap">
                {currentWeek === 0
                  ? t('stats.regCancelWeekHeadingRecent')
                  : currentWeek < 0
                    ? t('stats.regCancelWeekHeadingPast', { days: Math.abs(currentWeek) * 7 })
                    : t('stats.regCancelWeekHeadingFuture', { days: currentWeek * 7 })}
              </h3>
              <div className="text-xs sm:text-sm text-blue-700 whitespace-nowrap">
                {formatWeekRange(currentWeek).display}
              </div>
            </div>
            
            {/* 통계 주간: 등록(+)·취소(−)·순(=) 뱃지 + 일평균 */}
            <div className="mt-1.5 space-y-1.5 text-[11px] sm:text-xs leading-snug text-blue-900">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="tabular-nums font-semibold text-blue-800">
                  {weekHeaderSummary.calendarDayCount}
                  {t('stats.weekSummaryDays')}
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50/95 pl-1 pr-2 py-0.5 text-emerald-950 shadow-sm ring-1 ring-emerald-100/80"
                  title={t('stats.weekSummaryReg', {
                    bookings: weekHeaderSummary.regBookings,
                    people: weekHeaderSummary.regPeople,
                  })}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden>
                    <Plus className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0 tabular-nums font-medium">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.regBookings })}
                    <span className="text-emerald-700/80"> · </span>
                    {weekHeaderSummary.regPeople}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200/90 bg-rose-50/95 pl-1 pr-2 py-0.5 text-rose-950 shadow-sm ring-1 ring-rose-100/80"
                  title={t('stats.weekSummaryCancel', {
                    bookings: weekHeaderSummary.cancelBookings,
                    people: weekHeaderSummary.cancelPeople,
                  })}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white" aria-hidden>
                    <Minus className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0 tabular-nums font-medium">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.cancelBookings })}
                    <span className="text-rose-700/80"> · </span>
                    {weekHeaderSummary.cancelPeople}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border pl-1 pr-2 py-0.5 shadow-sm ring-1 tabular-nums font-medium ${
                    weekHeaderSummary.netBookings < 0 || weekHeaderSummary.netPeople < 0
                      ? 'border-amber-200/90 bg-amber-50/95 text-amber-950 ring-amber-100/80'
                      : 'border-sky-200/90 bg-sky-50/95 text-sky-950 ring-sky-100/80'
                  }`}
                  title={t('stats.weekSummaryNet', {
                    bookings: weekHeaderSummary.netBookings,
                    people: weekHeaderSummary.netPeople,
                  })}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                      weekHeaderSummary.netBookings < 0 || weekHeaderSummary.netPeople < 0
                        ? 'bg-amber-600'
                        : 'bg-sky-600'
                    }`}
                    aria-hidden
                  >
                    <Equal className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.netBookings })}
                    <span
                      className={
                        weekHeaderSummary.netBookings < 0 || weekHeaderSummary.netPeople < 0
                          ? 'text-amber-700/80'
                          : 'text-sky-700/80'
                      }
                    >
                      {' '}
                      ·{' '}
                    </span>
                    {weekHeaderSummary.netPeople}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-blue-200/45 pt-1.5">
                <span className="shrink-0 tabular-nums font-semibold text-blue-800/95">
                  {t('stats.weekSummaryAvgRowLabel', {
                    days: weekHeaderSummary.calendarDayCount,
                  })}
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50/95 pl-1 pr-2 py-0.5 text-emerald-950 shadow-sm ring-1 ring-emerald-100/80"
                  title={t('stats.weekSummaryAvgRegTooltip', {
                    bookings: weekHeaderSummary.avgRegBookingsPerDay,
                    people: weekHeaderSummary.avgRegPeoplePerDay,
                  })}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden>
                    <Plus className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0 tabular-nums font-medium">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.avgRegBookingsPerDay })}
                    <span className="text-emerald-700/80"> · </span>
                    {weekHeaderSummary.avgRegPeoplePerDay}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200/90 bg-rose-50/95 pl-1 pr-2 py-0.5 text-rose-950 shadow-sm ring-1 ring-rose-100/80"
                  title={t('stats.weekSummaryAvgCancelTooltip', {
                    bookings: weekHeaderSummary.avgCancelBookingsPerDay,
                    people: weekHeaderSummary.avgCancelPeoplePerDay,
                  })}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white" aria-hidden>
                    <Minus className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0 tabular-nums font-medium">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.avgCancelBookingsPerDay })}
                    <span className="text-rose-700/80"> · </span>
                    {weekHeaderSummary.avgCancelPeoplePerDay}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border pl-1 pr-2 py-0.5 shadow-sm ring-1 tabular-nums font-medium ${
                    weekHeaderSummary.avgNetBookingsPerDay < 0 ||
                    weekHeaderSummary.avgNetPeoplePerDay < 0
                      ? 'border-amber-200/90 bg-amber-50/95 text-amber-950 ring-amber-100/80'
                      : 'border-sky-200/90 bg-sky-50/95 text-sky-950 ring-sky-100/80'
                  }`}
                  title={t('stats.weekSummaryAvgNetTooltip', {
                    bookings: weekHeaderSummary.avgNetBookingsPerDay,
                    people: weekHeaderSummary.avgNetPeoplePerDay,
                  })}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                      weekHeaderSummary.avgNetBookingsPerDay < 0 ||
                      weekHeaderSummary.avgNetPeoplePerDay < 0
                        ? 'bg-amber-600'
                        : 'bg-sky-600'
                    }`}
                    aria-hidden
                  >
                    <Equal className="h-3 w-3" strokeWidth={2.75} />
                  </span>
                  <span className="min-w-0">
                    {t('stats.bookingCountInline', { count: weekHeaderSummary.avgNetBookingsPerDay })}
                    <span
                      className={
                        weekHeaderSummary.avgNetBookingsPerDay < 0 ||
                        weekHeaderSummary.avgNetPeoplePerDay < 0
                          ? 'text-amber-700/80'
                          : 'text-sky-700/80'
                      }
                    >
                      {' '}
                      ·{' '}
                    </span>
                    {weekHeaderSummary.avgNetPeoplePerDay}
                    {locale === 'ko' ? '' : ' '}
                    {t('stats.people')}
                  </span>
                </span>
              </div>
            </div>
          </div>
          
          {/* 네비게이션 버튼들 - 초컴팩트 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(currentWeek - 1)
              }}
              className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
            >
              ←
            </button>
            
            <button
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(0)
              }}
              className={`px-1.5 py-1 text-xs font-medium rounded ${
                currentWeek === 0 && !isInitialLoad
                  ? 'text-white bg-blue-600 border border-blue-600'
                  : 'text-blue-700 bg-white border border-blue-300 hover:bg-blue-50'
              }`}
            >
              {t('pagination.thisWeek')}
            </button>
            
            <button
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(currentWeek + 1)
              }}
              className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
            >
              →
            </button>
            
            {/* 아코디언 화살표 */}
            {(weeklyStats.totalReservations > 0 ||
              weekHeaderSummary.regBookings > 0 ||
              weekHeaderSummary.cancelBookings > 0) && (
              <button
                onClick={onToggleStatsCollapsed}
                className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
              >
                <svg 
                  className={`w-3 h-3 transition-transform ${isWeeklyStatsCollapsed ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 주간 통계 아코디언 - 초컴팩트 모바일 최적화 */}
      {(weeklyStats.totalReservations > 0 ||
        weekHeaderSummary.regBookings > 0 ||
        weekHeaderSummary.cancelBookings > 0) &&
        !isWeeklyStatsCollapsed && (
        <div className="p-2 sm:p-4">
          {regCancelChartData.length > 0 && (
            <div className="mb-3 sm:mb-4 rounded-lg border border-blue-200 bg-white p-2 sm:p-3 shadow-sm">
              <h5 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('stats.weeklyRegCancelChartTitle')}
              </h5>
              {onRegCancelGranularityChange && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {(['week', 'month', 'year'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onRegCancelGranularityChange(g)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        regCancelGranularity === g
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {g === 'week'
                        ? t('stats.regCancelTabWeek')
                        : g === 'month'
                          ? t('stats.regCancelTabMonth')
                          : t('stats.regCancelTabYear')}
                    </button>
                  ))}
                </div>
              )}
              {chartRangeSubtitle ? (
                <p className="mb-2 text-[10px] text-gray-600 sm:text-xs">{chartRangeSubtitle}</p>
              ) : null}
              {regCancelGranularity === 'month' && onRegCancelMonthOffsetChange ? (
                <div className="mb-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRegCancelMonthOffsetChange((n) => n - 1)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelMonthOffsetChange(0)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    {t('pagination.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelMonthOffsetChange((n) => n + 1)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    →
                  </button>
                </div>
              ) : null}
              {regCancelGranularity === 'year' && onRegCancelYearOffsetChange ? (
                <div className="mb-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRegCancelYearOffsetChange((n) => n - 1)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelYearOffsetChange(0)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    {t('pagination.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelYearOffsetChange((n) => n + 1)}
                    className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    →
                  </button>
                </div>
              ) : null}
              <div
                className={`w-full min-h-[210px] ${regCancelGranularity === 'month' ? 'h-[300px]' : 'h-[240px]'}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={regCancelChartData}
                    margin={{
                      top: 26,
                      right: 8,
                      left: 0,
                      bottom: regCancelGranularity === 'month' ? 36 : 6,
                    }}
                    barCategoryGap={regCancelGranularity === 'year' ? '22%' : '18%'}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: regCancelGranularity === 'month' ? 8 : 10 }}
                      interval={0}
                      angle={regCancelGranularity === 'month' ? -40 : 0}
                      textAnchor={regCancelGranularity === 'month' ? 'end' : 'middle'}
                      height={regCancelGranularity === 'month' ? 64 : 48}
                    />
                    <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as RegCancelChartRow
                        const tagHead = locale === 'ko' ? 'ko-KR' : 'en-US'
                        let heading = d.shortLabel
                        if (
                          regCancelGranularity === 'week' &&
                          d.weekdayLongForAvg &&
                          /^\d{4}-\d{2}-\d{2}$/.test(d.dateKey)
                        ) {
                          heading = new Date(`${d.dateKey}T12:00:00`).toLocaleDateString(tagHead, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        }
                        return (
                          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                            <p className="font-semibold text-gray-900 mb-1">{heading}</p>
                            <p className="text-gray-900 font-medium">
                              {t('stats.weeklyChartTooltipReg', {
                                count: d.registeredCount,
                                people: d.registeredPeople,
                              })}
                            </p>
                            <p className="text-emerald-800">
                              {t('stats.weeklyChartTooltipCancel', {
                                count: d.cancelledCount,
                                people: d.cancelledPeople,
                              })}
                            </p>
                            <p className="text-gray-600 mt-0.5">
                              {t('stats.weeklyChartTooltipNet', {
                                people: d.remainingPeople,
                              })}
                            </p>
                            <p className="text-gray-800 mt-0.5 font-medium">
                              {d.weekdayLongForAvg
                                ? t('stats.weeklyChartTooltipAvgLineWeekday', {
                                    weekday: d.weekdayLongForAvg,
                                    people: Math.round((d.avgLineRegistered ?? 0) * 10) / 10,
                                  })
                                : t('stats.weeklyChartTooltipAvgLine', {
                                    people: Math.round((d.avgLineRegistered ?? 0) * 10) / 10,
                                  })}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={8} />
                    {/* 스택 하단: 당일 취소 처리(updated_at) — 초록 */}
                    <Bar
                      stackId="regCancel"
                      dataKey="cancelStackPeople"
                      name={t('stats.weeklyChartCancelledPeople')}
                      fill="#16a34a"
                      radius={[0, 0, 4, 4]}
                      maxBarSize={48}
                    >
                      <LabelList
                        dataKey="cancelStackPeople"
                        position="center"
                        content={(props: {
                          x?: string | number
                          y?: string | number
                          width?: string | number
                          height?: string | number
                          value?: string | number
                          index?: number
                        }) => {
                          const idx = props.index ?? 0
                          const row = regCancelChartData[idx]
                          const v = Number(props.value ?? 0)
                          const h = Number(props.height ?? 0)
                          const x = Number(props.x ?? 0)
                          const y = Number(props.y ?? 0)
                          const w = Number(props.width ?? 0)
                          const cx = x + w / 2
                          const mid =
                            v > 0 && h >= 16 ? (
                              <text
                                key="cancel-mid"
                                x={cx}
                                y={y + h / 2}
                                dy="0.35em"
                                textAnchor="middle"
                                className="fill-gray-950 text-[10px] font-bold"
                              >
                                {v}
                                {t('stats.people')}
                              </text>
                            ) : null
                          /** 회색(등록−취소) 구간이 없을 때 총등록 라벨은 초록 막대 위에 표시 */
                          const topWhenAllCancel =
                            row &&
                            row.remainingPeople === 0 &&
                            row.registeredPeople > 0 ? (
                              <text
                                key="reg-top"
                                x={cx}
                                y={y - 6}
                                textAnchor="middle"
                                className="fill-gray-950 text-[11px] font-bold"
                              >
                                {row.registeredPeople}
                                {t('stats.people')}
                              </text>
                            ) : null
                          if (!mid && !topWhenAllCancel) return null
                          return (
                            <g>
                              {topWhenAllCancel}
                              {mid}
                            </g>
                          )
                        }}
                      />
                    </Bar>
                    {/* 스택 상단: 등록 − 취소 — 회색, 막대 전체 높이 = 등록 인원 */}
                    <Bar
                      stackId="regCancel"
                      dataKey="remainingPeople"
                      name={t('stats.weeklyChartNetPeople')}
                      fill="#d4d4d8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    >
                      <LabelList
                        dataKey="remainingPeople"
                        content={(props: {
                          x?: string | number
                          y?: string | number
                          width?: string | number
                          height?: string | number
                          value?: string | number
                          index?: number
                        }) => {
                          const idx = props.index ?? 0
                          const row = regCancelChartData[idx]
                          const v = Number(props.value ?? 0)
                          const h = Number(props.height ?? 0)
                          const x = Number(props.x ?? 0)
                          const y = Number(props.y ?? 0)
                          const w = Number(props.width ?? 0)
                          const total = row?.registeredPeople ?? 0
                          const centerLabel =
                            v > 0 && h >= 16 ? (
                              <text
                                key="mid"
                                x={x + w / 2}
                                y={y + h / 2}
                                dy="0.35em"
                                textAnchor="middle"
                                className="fill-gray-950 text-[10px] font-bold"
                              >
                                {v}
                                {t('stats.people')}
                              </text>
                            ) : null
                          /** 회색 구간이 있을 때만 상단 총등록 (전부 취소인 날은 초록 막대에서 표시) */
                          const topLabel =
                            total > 0 && row && row.remainingPeople > 0 ? (
                              <text
                                key="top"
                                x={x + w / 2}
                                y={y - 6}
                                textAnchor="middle"
                                className="fill-gray-950 text-[11px] font-bold"
                              >
                                {total}
                                {t('stats.people')}
                              </text>
                            ) : null
                          if (!centerLabel && !topLabel) return null
                          return (
                            <g>
                              {topLabel}
                              {centerLabel}
                            </g>
                          )
                        }}
                      />
                    </Bar>
                    <Line
                      type="linear"
                      dataKey="avgLineRegistered"
                      name={
                        regCancelGranularity === 'week'
                          ? t('stats.regCancelAvgLineRegisteredWeekday')
                          : t('stats.regCancelAvgLineRegistered')
                      }
                      stroke="#1f2937"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#1f2937' }}
                      connectNulls
                      isAnimationActive={false}
                      legendType="plainline"
                    >
                      {regCancelGranularity === 'week' ? (
                        <LabelList
                          dataKey="avgLineRegistered"
                          position="top"
                          offset={6}
                          className="fill-gray-700 text-[10px] font-medium"
                          formatter={(v: number | string) => {
                            const n = Number(v)
                            if (!Number.isFinite(n) || n <= 0) return ''
                            const r = Math.round(n * 10) / 10
                            return Number.isInteger(r) ? String(r) : r.toFixed(1)
                          }}
                        />
                      ) : null}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* 상품별 인원 통계 */}
            <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
              <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                <svg className="w-3 h-3 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {t('stats.byProduct')}
              </h5>
              <div className="space-y-0.5">
                {weeklyStats.productStats.slice(0, 3).map(([productName, count]) => (
                  <div key={productName} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                    <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{productName}</span>
                    <span className="font-semibold bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                      {count}{t('stats.people')}
                    </span>
                  </div>
                ))}
                {weeklyStats.productStats.length > 3 && (
                  <div className="text-xs text-gray-500 text-center py-0.5">
                    +{weeklyStats.productStats.length - 3}개
                  </div>
                )}
              </div>
            </div>
            
            {/* 채널별 인원 통계 */}
            <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
              <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                <svg className="w-3 h-3 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {t('stats.byChannel')}
              </h5>
              <div className="space-y-0.5">
                {weeklyStats.channelStats.slice(0, 3).map((channelInfo) => (
                  <div key={channelInfo.channelId} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                    <div className="flex items-center space-x-1 flex-1 mr-1">
                      {channelInfo.favicon_url ? (
                        <Image 
                          src={channelInfo.favicon_url} 
                          alt={`${channelInfo.name} favicon`} 
                          width={12}
                          height={12}
                          className="rounded flex-shrink-0"
                          style={{ width: 'auto', height: 'auto' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              const fallback = document.createElement('div')
                              fallback.className = 'h-3 w-3 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                              fallback.innerHTML = '🌐'
                              parent.appendChild(fallback)
                            }
                          }}
                        />
                      ) : (
                        <div className="h-3 w-3 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                          🌐
                        </div>
                      )}
                      <span className="text-gray-700 truncate text-xs">{channelInfo.name}</span>
                    </div>
                    <span className="font-semibold bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs">
                      {channelInfo.count}{t('stats.people')}
                    </span>
                  </div>
                ))}
                {weeklyStats.channelStats.length > 3 && (
                  <div className="text-xs text-gray-500 text-center py-0.5">
                    +{weeklyStats.channelStats.length - 3}개
                  </div>
                )}
              </div>
            </div>
            
            {/* 상태별 인원 통계 */}
            <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
              <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                <svg className="w-3 h-3 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('stats.byStatus')}
              </h5>
              <div className="space-y-0.5">
                {weeklyStats.statusStats.map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                    <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{getStatusLabel(status, t)}</span>
                    <span className="font-semibold bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
                      {count}{t('stats.people')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
