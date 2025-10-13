'use client'

import { Grid3X3, Calendar } from 'lucide-react'

interface EmptyStateProps {
  viewMode: 'card' | 'calendar'
  dateRange: { start: string; end: string }
  groupByDate: boolean
}

export default function EmptyState({ viewMode, dateRange, groupByDate }: EmptyStateProps) {
  const Icon = viewMode === 'calendar' ? Calendar : Grid3X3
  const title = groupByDate ? '선택한 기간에 예약이 없습니다' : '선택한 조건에 예약이 없습니다'
  
  const message = dateRange.start && dateRange.end ? 
    `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
    '현재 선택한 필터 조건에 해당하는 예약이 없습니다.'

  return (
    <div className="text-center py-16">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <Icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6">{message}</p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• 다른 날짜 범위를 선택해보세요</p>
          <p>• 필터 조건을 변경해보세요</p>
          <p>• 새로운 예약을 등록해보세요</p>
        </div>
      </div>
    </div>
  )
}
