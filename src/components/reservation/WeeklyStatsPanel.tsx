'use client'

import React, { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStatusLabel } from '@/utils/reservationUtils'

export type WeeklyRegCancelDayRow = {
  dateKey: string
  registeredPeople: number
  registeredCount: number
  cancelledPeople: number
  cancelledCount: number
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
  /** 일별 등록·취소 인원 차트 (현재 주간 구간) */
  weeklyRegCancelByDay?: WeeklyRegCancelDayRow[]
  isWeeklyStatsCollapsed: boolean
  onToggleStatsCollapsed: () => void
  groupedReservations: Record<string, unknown[]>
  formatWeekRange: (weekOffset: number) => { display: string }
}

export default function WeeklyStatsPanel({
  currentWeek,
  onWeekChange,
  onInitialLoadChange,
  isInitialLoad,
  weeklyStats,
  weeklyRegCancelByDay = [],
  isWeeklyStatsCollapsed,
  onToggleStatsCollapsed,
  groupedReservations,
  formatWeekRange
}: WeeklyStatsPanelProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()

  const regCancelChartData = useMemo(() => {
    const tag = locale === 'ko' ? 'ko-KR' : 'en-US'
    const lvOpts = {
      timeZone: 'America/Los_Angeles',
      weekday: 'short' as const,
      month: 'numeric' as const,
      day: 'numeric' as const,
    }
    return weeklyRegCancelByDay.map((row) => ({
      ...row,
      shortLabel: new Date(`${row.dateKey}T12:00:00`).toLocaleDateString(tag, lvOpts),
    }))
  }, [weeklyRegCancelByDay, locale])

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg">
      {/* 주간 네비게이션 헤더 - 초컴팩트 모바일 최적화 */}
      <div className="p-2 sm:p-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          {/* 제목과 통계 정보 - 한 줄에 압축 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <h3 className="text-sm sm:text-lg font-semibold text-blue-900 whitespace-nowrap">
                {currentWeek === 0 ? '최근 7일' : 
                 currentWeek < 0 ? `${Math.abs(currentWeek) * 7}일 전` : 
                 `${currentWeek * 7}일 후`}
              </h3>
              <div className="text-xs sm:text-sm text-blue-700 whitespace-nowrap">
                {formatWeekRange(currentWeek).display}
              </div>
            </div>
            
            {/* 통계 정보 - 한 줄에 압축 */}
            <div className="mt-1 flex items-center space-x-3 text-xs">
              <span className="text-blue-600">
                <span className="font-semibold">{Object.keys(groupedReservations).length}일</span>
              </span>
              <span className="text-blue-600">
                <span className="font-semibold">{Object.values(groupedReservations).flat().length}예약</span>
              </span>
              <span className="text-green-600">
                <span className="font-semibold">{weeklyStats.totalPeople}{t('stats.people')}</span>
              </span>
              <span className="text-green-600">
                <span className="font-semibold">{Math.round(weeklyStats.totalPeople / Math.max(Object.keys(groupedReservations).length, 1))}/일</span>
              </span>
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
            {weeklyStats.totalReservations > 0 && (
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
      {weeklyStats.totalReservations > 0 && !isWeeklyStatsCollapsed && (
        <div className="p-2 sm:p-4">
          {regCancelChartData.length > 0 && (
            <div className="mb-3 sm:mb-4 rounded-lg border border-blue-200 bg-white p-2 sm:p-3 shadow-sm">
              <h5 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('stats.weeklyRegCancelChartTitle')}
              </h5>
              <div className="h-[220px] w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regCancelChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      height={48}
                    />
                    <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as WeeklyRegCancelDayRow & { shortLabel: string }
                        return (
                          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                            <p className="font-semibold text-gray-900 mb-1">{d.shortLabel}</p>
                            <p className="text-blue-700">
                              {t('stats.weeklyChartTooltipReg', {
                                count: d.registeredCount,
                                people: d.registeredPeople,
                              })}
                            </p>
                            <p className="text-rose-700">
                              {t('stats.weeklyChartTooltipCancel', {
                                count: d.cancelledCount,
                                people: d.cancelledPeople,
                              })}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    <Bar
                      dataKey="registeredPeople"
                      name={t('stats.weeklyChartRegisteredPeople')}
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                    <Bar
                      dataKey="cancelledPeople"
                      name={t('stats.weeklyChartCancelledPeople')}
                      fill="#e11d48"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
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
