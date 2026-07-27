'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import RechartsContainer from '@/components/ui/RechartsContainer'
import { Plus, Minus, Equal } from 'lucide-react'
import { getStatusLabel } from '@/utils/reservationUtils'
import { BreakdownStatBadges } from '@/components/reservation/BreakdownStatBadges'
import { StatusTransitionByTargetBlock } from '@/components/reservation/StatusTransitionByTargetBlock'
import type { StatusTransitionTargetBucketAgg } from '@/lib/reservationStatusTargetBuckets'

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
  /**
   * 7일: 올해(로컬) 1/1~어제 각 달력일 순(등록−취소) 인원을 요일별로 모은 뒤, 그 요일이 나온 날 수로 나눈 일평균.
   * 월간: 표시 연도 기준 등록 인원만의 요일별 일평균. 연간: 월별 일평균 등록(별 필드).
   */
  avgLineRegistered?: number
  /** 예약건 기준 평균선 */
  avgLineRegisteredCount?: number
}

interface WeeklyStatsPanelProps {
  currentWeek: number
  onWeekChange: (week: number) => void
  onInitialLoadChange: (isInitial: boolean) => void
  isInitialLoad: boolean
  weeklyStats: {
    productStats: Array<{
      name: string
      regPeople: number
      cancelPeople: number
      netPeople: number
      regBookings: number
      cancelBookings: number
      netBookings: number
    }>
    channelStats: Array<{
      name: string
      channelId: string
      favicon_url: string | null
      regPeople: number
      cancelPeople: number
      netPeople: number
      regBookings: number
      cancelBookings: number
      netBookings: number
    }>
    statusStats: Array<{
      statusKey: string
      /** 감사 기반 주간 집계일 때만: 전환 라벨용 원문 상태 */
      transitionFrom?: string
      transitionTo?: string
      regPeople: number
      cancelPeople: number
      netPeople: number
      regBookings: number
      cancelBookings: number
      netBookings: number
    }>
    totalReservations: number
    totalPeople: number
    /** 감사 기반 주간: 확정·대기·취소 도착별 세부 전환 (미사용 시 생략) */
    statusTransitionByTarget?: StatusTransitionTargetBucketAgg[]
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
  /** 모달 안에 임베드될 때 외곽 카드 스타일 완화 */
  embeddedInModal?: boolean
  weekHeaderSummary: StatisticsWeekHeaderSummary
  formatWeekRange: (weekOffset: number) => { display: string }
  /** 통계·감사 집계 확정 전 — 차트 중간 값(잘못된 YTD 평균 등) 표시 방지 */
  weeklyRegCancelChartLoading?: boolean
  /** 7일 탭 YTD 평균선 2차 로드 중 */
  weeklyRegCancelChartYtdRefining?: boolean
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
  regCancelMonthOffset: _regCancelMonthOffset = 0,
  onRegCancelMonthOffsetChange,
  regCancelYearOffset: _regCancelYearOffset = 0,
  onRegCancelYearOffsetChange,
  chartRangeSubtitle = '',
  embeddedInModal = false,
  weekHeaderSummary,
  formatWeekRange,
  weeklyRegCancelChartLoading = false,
  weeklyRegCancelChartYtdRefining = false,
}: WeeklyStatsPanelProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()
  const [productBreakdownExpanded, setProductBreakdownExpanded] = useState(false)
  const [channelBreakdownExpanded, setChannelBreakdownExpanded] = useState(false)
  const [statusBreakdownExpanded, setStatusBreakdownExpanded] = useState(false)
  const [regCancelMetric, setRegCancelMetric] = useState<'people' | 'bookings'>('people')
  const BREAKDOWN_PREVIEW = 3

  const statusUsesTransitionBuckets = weeklyStats.statusTransitionByTarget != null
  const statusBreakdownUsesTransitions = useMemo(
    () =>
      statusUsesTransitionBuckets ||
      weeklyStats.statusStats.some(
        (r) => r.transitionFrom != null && r.transitionFrom !== '' && r.transitionTo != null && r.transitionTo !== ''
      ),
    [weeklyStats.statusStats, statusUsesTransitionBuckets]
  )

  useEffect(() => {
    setProductBreakdownExpanded(false)
    setChannelBreakdownExpanded(false)
    setStatusBreakdownExpanded(false)
  }, [currentWeek])

  type RegCancelChartRow = WeeklyRegCancelDayRow & {
    shortLabel: string
    /** 7일 탭: 툴팁·평균선이 “월요일 평균”처럼 읽히도록 전체 요일명 */
    weekdayLongForAvg?: string
    displayRegistered: number
    displayCancelled: number
    /** 스택 하단(초록): 당일 취소, 막대 높이는 등록에 맞춤 */
    cancelStack: number
    /** 스택 상단(회색): 등록 − 스택에 쓴 취소(겹침 표시) */
    remaining: number
    /** 해당일 순예약(등록−취소) */
    dayNet: number
    /** 반올림 평균 순예약(요일 YTD 등) */
    avgRounded: number
    /** 해당일 순예약 − 반올림 평균 */
    dayVsAvgDelta: number
    avgLine: number
  }

  const metricUnitSuffix = regCancelMetric === 'people' ? t('stats.people') : t('stats.bookingsUnit')

  const formatAxisAvg = useCallback(
    (avg: number) => {
      const n = Number(avg)
      if (!Number.isFinite(n)) return ''
      const r = Math.round(n)
      return locale === 'ko' ? `${r}${metricUnitSuffix}` : `${r} ${metricUnitSuffix}`
    },
    [locale, metricUnitSuffix]
  )

  const formatDayVsAvgDelta = useCallback(
    (delta: number) => {
      const n = Number(delta)
      if (!Number.isFinite(n)) return ''
      const r = Math.round(n)
      const signed = r > 0 ? `+${r}` : String(r)
      return locale === 'ko' ? `${signed}${metricUnitSuffix}` : `${signed} ${metricUnitSuffix}`
    },
    [locale, metricUnitSuffix]
  )

  const formatMetricValue = useCallback(
    (value: number) => {
      const r = Math.round(value)
      return locale === 'ko' ? `${r}${metricUnitSuffix}` : `${r} ${metricUnitSuffix}`
    },
    [locale, metricUnitSuffix]
  )

  const regCancelChartData = useMemo((): RegCancelChartRow[] => {
    const tag = locale === 'ko' ? 'ko-KR' : 'en-US'
    const isPeople = regCancelMetric === 'people'
    return weeklyRegCancelByDay.map((row) => {
      const displayRegistered = isPeople ? row.registeredPeople : row.registeredCount
      const displayCancelled = isPeople ? row.cancelledPeople : row.cancelledCount
      const cancelStack = Math.min(displayCancelled, displayRegistered)
      const remaining = displayRegistered - cancelStack
      const dayNet = displayRegistered - displayCancelled
      const avgLine = isPeople
        ? (row.avgLineRegistered ?? 0)
        : (row.avgLineRegisteredCount ?? 0)
      const avgRounded = Math.round(avgLine)
      const dayVsAvgDelta = dayNet - avgRounded
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
        ...(weekdayLongForAvg ? { weekdayLongForAvg } : {}),
        displayRegistered,
        displayCancelled,
        cancelStack,
        remaining,
        dayNet,
        avgRounded,
        dayVsAvgDelta,
        shortLabel,
        avgLine,
      }
    })
  }, [weeklyRegCancelByDay, locale, regCancelGranularity, regCancelMetric])

  const regCancelPeriodSummary = useMemo(() => {
    if (regCancelChartData.length === 0) return null
    const netTotal = regCancelChartData.reduce((sum, row) => sum + row.dayNet, 0)
    const avgTotal = regCancelChartData.reduce((sum, row) => sum + Math.round(row.avgLine), 0)
    const diff = netTotal - avgTotal
    return { netTotal, avgTotal, diff }
  }, [regCancelChartData])

  const regCancelChartHeightPx = regCancelGranularity === 'month' ? 300 : 240

  return (
    <div
      className={
        embeddedInModal
          ? 'rounded-lg bg-white'
          : 'bg-muted/50 border border-border rounded-lg'
      }
    >
      {/* 주간 네비게이션 헤더 - 초컴팩트 모바일 최적화 */}
      <div className="p-2 sm:p-4 border-b border-border">
        {/* 1줄: 구간 제목·날짜 + 주 이동·접기 (모바일에서도 같은 줄 우선) */}
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-x-4">
            <h3 className="text-sm sm:text-lg font-semibold text-foreground whitespace-nowrap">
              {currentWeek === 0
                ? t('stats.regCancelWeekHeadingRecent')
                : currentWeek < 0
                  ? t('stats.regCancelWeekHeadingPast', { days: Math.abs(currentWeek) * 7 })
                  : t('stats.regCancelWeekHeadingFuture', { days: currentWeek * 7 })}
            </h3>
            <div className="text-xs sm:text-sm text-primary tabular-nums min-w-0">
              {formatWeekRange(currentWeek).display}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(currentWeek - 1)
              }}
              className="px-1.5 py-1 text-xs font-medium text-primary bg-white border border-border rounded hover:bg-muted/50"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(0)
              }}
              className={`px-1.5 py-1 text-xs font-medium rounded ${
                currentWeek === 0 && !isInitialLoad
                  ? 'text-white bg-blue-600 border border-primary'
                  : 'text-primary bg-white border border-border hover:bg-muted/50'
              }`}
            >
              {t('pagination.thisWeek')}
            </button>
            <button
              type="button"
              onClick={() => {
                onInitialLoadChange(false)
                onWeekChange(currentWeek + 1)
              }}
              className="px-1.5 py-1 text-xs font-medium text-primary bg-white border border-border rounded hover:bg-muted/50"
            >
              →
            </button>
          </div>
        </div>

        {/* 2줄: 기간 합계(등록·취소·순) — + / − / = 한 줄에만 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] sm:text-xs leading-snug text-foreground">
          <span className="shrink-0 tabular-nums font-semibold text-primary">
            {weekHeaderSummary.calendarDayCount}
            {t('stats.weekSummaryDays')}:
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

        {/* 3줄: 일평균(등록·취소·순) — 동일 +/−/= 아이콘은 이 줄에만 배치(중복 인상 제거) */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] sm:text-xs leading-snug text-foreground">
          <span className="shrink-0 font-semibold text-foreground/90 tabular-nums" title={t('stats.weekSummaryAvgRowLabel', { days: weekHeaderSummary.calendarDayCount })}>
            {t('stats.weekSummaryAvgShort')}:
          </span>
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200/95 bg-indigo-50/95 pl-1 pr-2 py-0.5 text-indigo-950 shadow-sm ring-1 ring-indigo-100/80"
            title={t('stats.weekSummaryAvgRegTooltip', {
              bookings: weekHeaderSummary.avgRegBookingsPerDay,
              people: weekHeaderSummary.avgRegPeoplePerDay,
            })}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white" aria-hidden>
              <Plus className="h-3 w-3" strokeWidth={2.75} />
            </span>
            <span className="min-w-0 tabular-nums font-medium">
              {t('stats.bookingCountInline', { count: weekHeaderSummary.avgRegBookingsPerDay })}
              <span className="text-indigo-700/85"> · </span>
              {weekHeaderSummary.avgRegPeoplePerDay}
              {locale === 'ko' ? '' : ' '}
              {t('stats.people')}
            </span>
          </span>
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-200/95 bg-violet-50/95 pl-1 pr-2 py-0.5 text-violet-950 shadow-sm ring-1 ring-violet-100/80"
            title={t('stats.weekSummaryAvgCancelTooltip', {
              bookings: weekHeaderSummary.avgCancelBookingsPerDay,
              people: weekHeaderSummary.avgCancelPeoplePerDay,
            })}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white" aria-hidden>
              <Minus className="h-3 w-3" strokeWidth={2.75} />
            </span>
            <span className="min-w-0 tabular-nums font-medium">
              {t('stats.bookingCountInline', { count: weekHeaderSummary.avgCancelBookingsPerDay })}
              <span className="text-violet-700/85"> · </span>
              {weekHeaderSummary.avgCancelPeoplePerDay}
              {locale === 'ko' ? '' : ' '}
              {t('stats.people')}
            </span>
          </span>
          <span
            className={`inline-flex max-w-full items-center gap-1 rounded-full border pl-1 pr-2 py-0.5 shadow-sm ring-1 tabular-nums font-medium ${
              weekHeaderSummary.avgNetBookingsPerDay < 0 || weekHeaderSummary.avgNetPeoplePerDay < 0
                ? 'border-amber-200/90 bg-amber-50/95 text-amber-950 ring-amber-100/80'
                : 'border-cyan-200/95 bg-cyan-50/95 text-cyan-950 ring-cyan-100/80'
            }`}
            title={t('stats.weekSummaryAvgNetTooltip', {
              bookings: weekHeaderSummary.avgNetBookingsPerDay,
              people: weekHeaderSummary.avgNetPeoplePerDay,
            })}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                weekHeaderSummary.avgNetBookingsPerDay < 0 || weekHeaderSummary.avgNetPeoplePerDay < 0
                  ? 'bg-amber-600'
                  : 'bg-cyan-600'
              }`}
              aria-hidden
            >
              <Equal className="h-3 w-3" strokeWidth={2.75} />
            </span>
            <span className="min-w-0">
              {t('stats.bookingCountInline', { count: weekHeaderSummary.avgNetBookingsPerDay })}
              <span
                className={
                  weekHeaderSummary.avgNetBookingsPerDay < 0 || weekHeaderSummary.avgNetPeoplePerDay < 0
                    ? 'text-amber-700/80'
                    : 'text-cyan-800/85'
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

      {/* 주간 통계 아코디언 - 초컴팩트 모바일 최적화 */}
      {(weeklyStats.totalReservations > 0 ||
        weekHeaderSummary.regBookings > 0 ||
        weekHeaderSummary.cancelBookings > 0 ||
        weeklyRegCancelChartLoading) && (
        <div className="p-2 sm:p-4">
          {(regCancelChartData.length > 0 || weeklyRegCancelChartLoading) && (
            <div className="mb-3 sm:mb-4 rounded-lg border border-border bg-white p-2 sm:p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h5 className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {regCancelMetric === 'people'
                    ? t('stats.weeklyRegCancelChartTitlePeople')
                    : t('stats.weeklyRegCancelChartTitleBookings')}
                </h5>
                <div className="flex flex-col items-end gap-1.5">
                  <div
                    className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
                    role="group"
                    aria-label={t('stats.regCancelChartMetricToggleLabel')}
                  >
                    {(['people', 'bookings'] as const).map((metric) => (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => setRegCancelMetric(metric)}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors sm:text-xs ${
                          regCancelMetric === metric
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {metric === 'people'
                          ? t('stats.regCancelChartMetricPeople')
                          : t('stats.regCancelChartMetricBookings')}
                      </button>
                    ))}
                  </div>
                  {regCancelPeriodSummary &&
                  !weeklyRegCancelChartLoading &&
                  !weeklyRegCancelChartYtdRefining ? (
                    <p
                      className="max-w-[min(100%,20rem)] text-right text-[10px] font-medium leading-snug tabular-nums text-slate-700 sm:text-xs"
                      title={t('stats.regCancelChartPeriodSummaryTooltip', {
                        net: regCancelPeriodSummary.netTotal,
                        avg: regCancelPeriodSummary.avgTotal,
                        diff: regCancelPeriodSummary.diff,
                      })}
                    >
                      <span className="text-muted-foreground">{t('stats.regCancelChartPeriodNetLabel')}</span>{' '}
                      <span className="font-bold text-slate-900">
                        {formatMetricValue(regCancelPeriodSummary.netTotal)}
                      </span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{t('stats.regCancelChartPeriodAvgLabel')}</span>{' '}
                      <span className="font-semibold">{formatMetricValue(regCancelPeriodSummary.avgTotal)}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{t('stats.regCancelChartPeriodDiffLabel')}</span>{' '}
                      <span
                        className={
                          regCancelPeriodSummary.diff < 0
                            ? 'font-extrabold text-red-600'
                            : regCancelPeriodSummary.diff > 0
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-500'
                        }
                      >
                        {formatDayVsAvgDelta(regCancelPeriodSummary.diff)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              {onRegCancelGranularityChange && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {(['week', 'month', 'year'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onRegCancelGranularityChange(g)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        regCancelGranularity === g
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border bg-white text-primary hover:bg-muted/50'
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
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelMonthOffsetChange(0)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
                  >
                    {t('pagination.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelMonthOffsetChange((n) => n + 1)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
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
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelYearOffsetChange(0)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
                  >
                    {t('pagination.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegCancelYearOffsetChange((n) => n + 1)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-xs text-primary hover:bg-muted/50"
                  >
                    →
                  </button>
                </div>
              ) : null}
              {weeklyRegCancelChartYtdRefining && !weeklyRegCancelChartLoading ? (
                <p className="mb-1 text-right text-[10px] text-muted-foreground" role="status">
                  {t('stats.weeklyRegCancelChartYtdRefining')}
                </p>
              ) : null}
              <div className="relative">
                {weeklyRegCancelChartLoading ? (
                  <div
                    className="flex items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground"
                    style={{ minHeight: regCancelChartHeightPx + (regCancelGranularity === 'week' ? 20 : 0) }}
                    role="status"
                    aria-live="polite"
                  >
                    {t('stats.weeklyRegCancelChartLoading')}
                  </div>
                ) : (
                  <>
                {regCancelGranularity === 'week' && regCancelChartData.length > 0 ? (
                  <div
                    className="pointer-events-none mb-0.5 flex h-4 items-end pr-2"
                    style={{ paddingLeft: 36 }}
                    aria-hidden
                  >
                    <div
                      className="grid min-w-0 flex-1"
                      style={{
                        gridTemplateColumns: `repeat(${regCancelChartData.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {regCancelChartData.map((row) => {
                        const delta = row.dayVsAvgDelta ?? 0
                        const isBelowAvg = delta < 0
                        return (
                        <div
                          key={row.dateKey}
                          className={`text-center text-[10px] font-bold leading-none tabular-nums ${
                            isBelowAvg
                                ? 'text-red-600 font-extrabold'
                                : delta > 0
                                  ? 'text-slate-800 font-bold'
                                  : 'text-slate-500 font-semibold'
                          }`}
                          title={t('stats.weeklyChartAvgMinusDayNetTooltip', {
                            avg: row.avgRounded ?? 0,
                            day: Math.round(row.dayNet ?? 0),
                            signed: formatDayVsAvgDelta(delta),
                          })}
                        >
                          {formatDayVsAvgDelta(row.dayVsAvgDelta ?? 0)}
                        </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              <RechartsContainer height={regCancelChartHeightPx}>
                <ComposedChart
                    data={regCancelChartData}
                    margin={{
                      top: 26,
                      right: 8,
                      left: 0,
                      bottom:
                        regCancelGranularity === 'week'
                          ? 30
                          : regCancelGranularity === 'month'
                            ? 36
                            : 6,
                    }}
                    barCategoryGap={regCancelGranularity === 'year' ? '22%' : '18%'}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={
                        regCancelGranularity === 'week'
                          ? (props: Record<string, unknown>) => {
                              const x = Number(props.x ?? 0)
                              const y = Number(props.y ?? 0)
                              const payload = props.payload as { value?: string } | undefined
                              const index = Number(props.index ?? 0)
                              const row = regCancelChartData[index]
                              const avg = row?.avgLine ?? 0
                              const avgLine = formatAxisAvg(avg)
                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text
                                    x={0}
                                    y={0}
                                    dy={12}
                                    textAnchor="middle"
                                    fill="#4b5563"
                                    fontSize={10}
                                  >
                                    {payload?.value ?? ''}
                                  </text>
                                  <text
                                    x={0}
                                    y={0}
                                    dy={26}
                                    textAnchor="middle"
                                    fill="#111827"
                                    fontSize={11}
                                    fontWeight={600}
                                  >
                                    {avgLine}
                                  </text>
                                </g>
                              )
                            }
                          : { fontSize: regCancelGranularity === 'month' ? 8 : 10 }
                      }
                      interval={0}
                      angle={regCancelGranularity === 'month' ? -40 : 0}
                      textAnchor={regCancelGranularity === 'month' ? 'end' : 'middle'}
                      height={regCancelGranularity === 'week' ? 54 : regCancelGranularity === 'month' ? 64 : 48}
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
                              {regCancelMetric === 'people'
                                ? t('stats.weeklyChartTooltipNet', {
                                    people: Math.round(d.dayNet ?? 0),
                                  })
                                : t('stats.weeklyChartTooltipNetBookings', {
                                    count: Math.round(d.dayNet ?? 0),
                                  })}
                            </p>
                            <p className="text-gray-800 mt-0.5 font-medium">
                              {d.weekdayLongForAvg
                                ? regCancelGranularity === 'week'
                                  ? regCancelMetric === 'people'
                                    ? t('stats.weeklyChartTooltipAvgLineWeekdayYtdNet', {
                                        weekday: d.weekdayLongForAvg,
                                        people: Math.round(d.avgLine ?? 0),
                                      })
                                    : t('stats.weeklyChartTooltipAvgLineWeekdayYtdNetBookings', {
                                        weekday: d.weekdayLongForAvg,
                                        count: Math.round(d.avgLine ?? 0),
                                      })
                                  : regCancelMetric === 'people'
                                    ? t('stats.weeklyChartTooltipAvgLineWeekday', {
                                        weekday: d.weekdayLongForAvg,
                                        people: Math.round((d.avgLine ?? 0) * 10) / 10,
                                      })
                                    : t('stats.weeklyChartTooltipAvgLineWeekdayBookings', {
                                        weekday: d.weekdayLongForAvg,
                                        count: Math.round((d.avgLine ?? 0) * 10) / 10,
                                      })
                                : regCancelGranularity === 'week'
                                  ? regCancelMetric === 'people'
                                    ? t('stats.weeklyChartTooltipAvgLineYtdNet', {
                                        people: Math.round(d.avgLine ?? 0),
                                      })
                                    : t('stats.weeklyChartTooltipAvgLineYtdNetBookings', {
                                        count: Math.round(d.avgLine ?? 0),
                                      })
                                  : regCancelMetric === 'people'
                                    ? t('stats.weeklyChartTooltipAvgLine', {
                                        people: Math.round((d.avgLine ?? 0) * 10) / 10,
                                      })
                                    : t('stats.weeklyChartTooltipAvgLineBookings', {
                                        count: Math.round((d.avgLine ?? 0) * 10) / 10,
                                      })}
                            </p>
                            {regCancelGranularity === 'week' ? (
                              <p
                                className={`mt-0.5 font-semibold ${
                                  (d.dayVsAvgDelta ?? 0) < 0 ? 'text-red-600' : 'text-slate-700'
                                }`}
                              >
                                {regCancelMetric === 'people'
                                  ? t('stats.weeklyChartAvgMinusDayNetTooltip', {
                                      avg: d.avgRounded ?? Math.round(d.avgLine ?? 0),
                                      day: Math.round(d.dayNet ?? 0),
                                      signed: formatDayVsAvgDelta(d.dayVsAvgDelta ?? 0),
                                    })
                                  : t('stats.weeklyChartAvgMinusDayNetTooltipBookings', {
                                      avg: d.avgRounded ?? Math.round(d.avgLine ?? 0),
                                      day: Math.round(d.dayNet ?? 0),
                                      signed: formatDayVsAvgDelta(d.dayVsAvgDelta ?? 0),
                                    })}
                              </p>
                            ) : null}
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={8} />
                    {/* 스택 하단: 당일 취소 처리(updated_at) — 초록 */}
                    <Bar
                      stackId="regCancel"
                      dataKey="cancelStack"
                      name={
                        regCancelMetric === 'people'
                          ? t('stats.weeklyChartCancelledPeople')
                          : t('stats.weeklyChartCancelledBookings')
                      }
                      fill="#16a34a"
                      radius={[0, 0, 4, 4]}
                      maxBarSize={48}
                    >
                      <LabelList
                        dataKey="cancelStack"
                        position="center"
                        content={((props: Record<string, unknown>) => {
                          const idx = Number(props.index ?? 0)
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
                                {metricUnitSuffix}
                              </text>
                            ) : null
                          /** 회색(등록−취소) 구간이 없을 때 총등록 라벨은 초록 막대 위에 표시 */
                          const topWhenAllCancel =
                            row &&
                            row.remaining === 0 &&
                            row.displayRegistered > 0 ? (
                              <text
                                key="reg-top"
                                x={cx}
                                y={y - 6}
                                textAnchor="middle"
                                className="fill-gray-950 text-[11px] font-bold"
                              >
                                {row.displayRegistered}
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
                        }) as any}
                      />
                    </Bar>
                    {/* 스택 상단: 등록 − 취소 — 회색, 막대 전체 높이 = 등록 인원 */}
                    <Bar
                      stackId="regCancel"
                      dataKey="remaining"
                      name={
                        regCancelMetric === 'people'
                          ? t('stats.weeklyChartNetPeople')
                          : t('stats.weeklyChartNetBookings')
                      }
                      fill="#d4d4d8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    >
                      <LabelList
                        dataKey="remaining"
                        content={((props: Record<string, unknown>) => {
                          const idx = Number(props.index ?? 0)
                          const row = regCancelChartData[idx]
                          const v = Number(props.value ?? 0)
                          const h = Number(props.height ?? 0)
                          const x = Number(props.x ?? 0)
                          const y = Number(props.y ?? 0)
                          const w = Number(props.width ?? 0)
                          const total = row?.displayRegistered ?? 0
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
                                {metricUnitSuffix}
                              </text>
                            ) : null
                          /** 회색 구간이 있을 때만 상단 총등록 (전부 취소인 날은 초록 막대에서 표시) */
                          const topLabel =
                            total > 0 && row && row.remaining > 0 ? (
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
                        }) as any}
                      />
                    </Bar>
                    <Line
                      type="linear"
                      dataKey="avgLine"
                      name={
                        regCancelGranularity === 'week'
                          ? t('stats.regCancelAvgLineWeekYtdNet')
                          : t('stats.regCancelAvgLineRegistered')
                      }
                      stroke="#1f2937"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#1f2937' }}
                      connectNulls
                      isAnimationActive={false}
                      legendType="plainline"
                    />
                  </ComposedChart>
              </RechartsContainer>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* 상품별: 등록·취소·순 */}
            <div className="rounded border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
              <h5 className="mb-1.5 flex items-center text-xs font-semibold text-gray-800">
                <svg className="mr-1 h-3 w-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {t('stats.byProduct')}
              </h5>
              <div className="space-y-0.5">
                {(productBreakdownExpanded
                  ? weeklyStats.productStats
                  : weeklyStats.productStats.slice(0, BREAKDOWN_PREVIEW)
                ).map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between gap-1 rounded bg-gray-50 px-1.5 py-1 text-[11px] sm:text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-gray-800">{row.name}</span>
                    <div className="flex min-w-0 max-w-[min(100%,18rem)] shrink-0 flex-wrap items-center justify-end sm:max-w-[55%]">
                      <BreakdownStatBadges
                        regBookings={row.regBookings}
                        regPeople={row.regPeople}
                        cancelBookings={row.cancelBookings}
                        cancelPeople={row.cancelPeople}
                        groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {weeklyStats.productStats.length > BREAKDOWN_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setProductBreakdownExpanded((v) => !v)}
                  className="mt-1 w-full rounded border border-gray-200 bg-white py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  {productBreakdownExpanded
                    ? t('stats.breakdownCollapse')
                    : t('stats.breakdownExpand', {
                        count: weeklyStats.productStats.length - BREAKDOWN_PREVIEW,
                      })}
                </button>
              ) : null}
            </div>

            {/* 채널별: 등록·취소·순 */}
            <div className="rounded border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
              <h5 className="mb-1.5 flex items-center text-xs font-semibold text-gray-800">
                <svg className="mr-1 h-3 w-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {t('stats.byChannel')}
              </h5>
              <div className="space-y-0.5">
                {(channelBreakdownExpanded
                  ? weeklyStats.channelStats
                  : weeklyStats.channelStats.slice(0, BREAKDOWN_PREVIEW)
                ).map((channelInfo) => (
                  <div
                    key={channelInfo.channelId}
                    className="flex items-center justify-between gap-1 rounded bg-gray-50 px-1.5 py-1 text-[11px] sm:text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      {channelInfo.favicon_url ? (
                        <img
                          src={channelInfo.favicon_url}
                          alt=""
                          className="h-3 w-3 shrink-0 rounded object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              const fallback = document.createElement('div')
                              fallback.className =
                                'flex h-3 w-3 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400'
                              fallback.innerHTML = '🌐'
                              parent.appendChild(fallback)
                            }
                          }}
                        />
                      ) : (
                        <div className="flex h-3 w-3 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">
                          🌐
                        </div>
                      )}
                      <span className="min-w-0 truncate text-gray-800">{channelInfo.name}</span>
                    </div>
                    <div className="flex min-w-0 max-w-[min(100%,18rem)] shrink-0 flex-wrap items-center justify-end sm:max-w-[55%]">
                      <BreakdownStatBadges
                        regBookings={channelInfo.regBookings}
                        regPeople={channelInfo.regPeople}
                        cancelBookings={channelInfo.cancelBookings}
                        cancelPeople={channelInfo.cancelPeople}
                        groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {weeklyStats.channelStats.length > BREAKDOWN_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setChannelBreakdownExpanded((v) => !v)}
                  className="mt-1 w-full rounded border border-gray-200 bg-white py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  {channelBreakdownExpanded
                    ? t('stats.breakdownCollapse')
                    : t('stats.breakdownExpand', {
                        count: weeklyStats.channelStats.length - BREAKDOWN_PREVIEW,
                      })}
                </button>
              ) : null}
            </div>

            {/* 상태별: 등록·취소·순 */}
            <div className="rounded border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
              <h5 className="mb-1.5 flex items-center text-xs font-semibold text-gray-800">
                <svg className="mr-1 h-3 w-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {statusBreakdownUsesTransitions ? t('stats.byStatusTransitions') : t('stats.byStatus')}
              </h5>
              {weeklyStats.statusTransitionByTarget != null ? (
                <StatusTransitionByTargetBlock buckets={weeklyStats.statusTransitionByTarget} compact />
              ) : (
                <>
                  <div className="space-y-0.5">
                    {(statusBreakdownExpanded
                      ? weeklyStats.statusStats
                      : weeklyStats.statusStats.slice(0, BREAKDOWN_PREVIEW)
                    ).map((row) => (
                      <div
                        key={row.statusKey}
                        className="flex items-center justify-between gap-1 rounded bg-gray-50 px-1.5 py-1 text-[11px] sm:text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-gray-800">
                          {row.transitionFrom != null &&
                          row.transitionFrom !== '' &&
                          row.transitionTo != null &&
                          row.transitionTo !== ''
                            ? `${getStatusLabel(row.transitionFrom, t)} → ${getStatusLabel(row.transitionTo, t)}`
                            : getStatusLabel(row.statusKey, t)}
                        </span>
                        <div className="flex min-w-0 max-w-[min(100%,18rem)] shrink-0 flex-wrap items-center justify-end sm:max-w-[55%]">
                          <BreakdownStatBadges
                            regBookings={row.regBookings}
                            regPeople={row.regPeople}
                            cancelBookings={row.cancelBookings}
                            cancelPeople={row.cancelPeople}
                            groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {weeklyStats.statusStats.length > BREAKDOWN_PREVIEW ? (
                    <button
                      type="button"
                      onClick={() => setStatusBreakdownExpanded((v) => !v)}
                      className="mt-1 w-full rounded border border-gray-200 bg-white py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {statusBreakdownExpanded
                        ? t('stats.breakdownCollapse')
                        : t('stats.breakdownExpand', {
                            count: weeklyStats.statusStats.length - BREAKDOWN_PREVIEW,
                          })}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
