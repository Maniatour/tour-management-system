'use client'

import { useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'

interface WeeklyStatsProps {
  weeklyStats: {
    productStats: Array<[string, number]>
    channelStats: Array<{ name: string; count: number; favicon_url: string | null; channelId: string }>
    statusStats: Array<[string, number]>
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
  formatWeekRange
}: WeeklyStatsProps) {
  const handleWeekChange = useCallback((week: number) => {
    onWeekChange(week)
  }, [onWeekChange])

  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse()
  }, [onToggleCollapse])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleWeekChange(currentWeek - 1)}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            ← 이전 주
          </button>
          <button
            onClick={() => handleWeekChange(0)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            이번 주
          </button>
          <button
            onClick={() => handleWeekChange(currentWeek + 1)}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            다음 주 →
          </button>
          <span className="text-sm font-medium text-gray-700">
            {formatWeekRange(currentWeek).display}
          </span>
        </div>
        <button
          onClick={handleToggleCollapse}
          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800"
        >
          <span>주간 통계</span>
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* 통계 내용 */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* 전체 요약 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">총 예약 수</div>
              <div className="text-2xl font-bold text-blue-800">{weeklyStats.totalReservations}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600 font-medium">총 인원</div>
              <div className="text-2xl font-bold text-green-800">{weeklyStats.totalPeople}</div>
            </div>
          </div>

          {/* 상품별 통계 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">상품별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.productStats.slice(0, 5).map(([productName, count]) => (
                <div key={productName} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 truncate">{productName}</span>
                  <span className="font-medium text-gray-800">{count}명</span>
                </div>
              ))}
            </div>
          </div>

          {/* 채널별 통계 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">채널별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.channelStats.slice(0, 5).map((channel) => (
                <div key={channel.channelId} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    {channel.favicon_url && (
                      <Image
                        src={channel.favicon_url}
                        alt={channel.name}
                        width={16}
                        height={16}
                        className="rounded"
                      />
                    )}
                    <span className="text-gray-600 truncate">{channel.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">{channel.count}명</span>
                </div>
              ))}
            </div>
          </div>

          {/* 상태별 통계 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">상태별 인원</h4>
            <div className="space-y-1">
              {weeklyStats.statusStats.map(([status, count]) => (
                <div key={status} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{status}</span>
                  <span className="font-medium text-gray-800">{count}명</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
