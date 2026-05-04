'use client'

import React, { useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'

/** @deprecated 레거시 — 예약 관리는 WeeklyStatsPanel 사용 */
interface WeeklyStatsProps {
  weeklyStats: {
    productStats: Array<{
      name: string
      regPeople: number
      cancelPeople: number
      netPeople: number
    }>
    channelStats: Array<{
      name: string
      channelId: string
      favicon_url: string | null
      regPeople: number
      cancelPeople: number
      netPeople: number
    }>
    statusStats: Array<{
      statusKey: string
      regPeople: number
      cancelPeople: number
      netPeople: number
    }>
    totalReservations: number
    totalPeople: number
  }
  isCollapsed: boolean
  onToggleCollapse: () => void
  currentWeek: number
  onWeekChange: (week: number) => void
  formatWeekRange: (weekOffset: number) => { display: string }
}

export default function WeeklyStats({
  weeklyStats,
  isCollapsed,
  onToggleCollapse,
  currentWeek,
  onWeekChange,
  formatWeekRange,
}: WeeklyStatsProps) {
  const handleWeekChange = useCallback(
    (week: number) => {
      onWeekChange(week)
    },
    [onWeekChange]
  )

  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse()
  }, [onToggleCollapse])

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => handleWeekChange(currentWeek - 1)}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800"
          >
            ← 이전 주
          </button>
          <button
            type="button"
            onClick={() => handleWeekChange(0)}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
          >
            이번 주
          </button>
          <button
            type="button"
            onClick={() => handleWeekChange(currentWeek + 1)}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800"
          >
            다음 주 →
          </button>
          <span className="text-sm font-medium text-gray-700">{formatWeekRange(currentWeek).display}</span>
        </div>
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800"
        >
          <span>주간 통계</span>
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-sm font-medium text-blue-600">총 예약 수</div>
              <div className="text-2xl font-bold text-blue-800">{weeklyStats.totalReservations}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-sm font-medium text-green-600">총 인원</div>
              <div className="text-2xl font-bold text-green-800">{weeklyStats.totalPeople}</div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">상품별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.productStats.slice(0, 5).map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-600">{row.name}</span>
                  <span className="font-medium text-gray-800">
                    +{row.regPeople} / -{row.cancelPeople} / {row.netPeople}명
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">채널별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.channelStats.slice(0, 5).map((ch) => (
                <div key={ch.channelId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    {ch.favicon_url ? (
                      <Image src={ch.favicon_url} alt="" width={16} height={16} className="rounded" />
                    ) : null}
                    <span className="truncate text-gray-600">{ch.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">
                    +{ch.regPeople} / -{ch.cancelPeople} / {ch.netPeople}명
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">상태별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.statusStats.map((row) => (
                <div key={row.statusKey} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{row.statusKey}</span>
                  <span className="font-medium text-gray-800">
                    +{row.regPeople} / -{row.cancelPeople} / {row.netPeople}명
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
