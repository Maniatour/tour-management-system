'use client'

import React from 'react'
import { Grid3X3, Calendar } from 'lucide-react'

interface ReservationsEmptyStateProps {
  hasSearchTerm: boolean
  searchTerm: string
  hasDateRange: boolean
  dateRangeStart?: string
  dateRangeEnd?: string
  onClearSearch?: () => void
  variant?: 'grid' | 'calendar'
}

export default function ReservationsEmptyState({
  hasSearchTerm,
  searchTerm,
  hasDateRange,
  dateRangeStart,
  dateRangeEnd,
  onClearSearch,
  variant = 'grid'
}: ReservationsEmptyStateProps) {
  const Icon = variant === 'calendar' ? Calendar : Grid3X3

  return (
    <div className="text-center py-16">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <Icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {hasSearchTerm
            ? `"${searchTerm}" 검색 결과가 없습니다`
            : variant === 'calendar'
            ? '선택한 기간에 예약이 없습니다'
            : '선택한 조건에 예약이 없습니다'}
        </h3>
        <p className="text-gray-500 mb-6">
          {hasSearchTerm
            ? '다른 검색어를 입력하거나 필터 조건을 변경해보세요.'
            : hasDateRange && dateRangeStart && dateRangeEnd
            ? `${new Date(dateRangeStart).toLocaleDateString('ko-KR')} ~ ${new Date(dateRangeEnd).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.`
            : '현재 선택한 필터 조건에 해당하는 예약이 없습니다.'}
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          {hasSearchTerm ? (
            <>
              <p>• 다른 검색어를 입력해보세요</p>
              <p>• 필터 조건을 변경해보세요</p>
              {onClearSearch && (
                <button
                  onClick={onClearSearch}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  검색어 지우기
                </button>
              )}
            </>
          ) : (
            <>
              <p>• 다른 날짜 범위를 선택해보세요</p>
              <p>• 필터 조건을 변경해보세요</p>
              <p>• 새로운 예약을 등록해보세요</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
