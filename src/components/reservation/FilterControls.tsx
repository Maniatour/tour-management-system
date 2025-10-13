'use client'

import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface FilterControlsProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedStatus: string
  onStatusChange: (value: string) => void
  selectedChannel: string
  onChannelChange: (value: string) => void
  dateRange: { start: string; end: string }
  onDateRangeChange: (range: { start: string; end: string }) => void
  sortBy: 'created_at' | 'tour_date' | 'customer_name' | 'product_name'
  onSortByChange: (value: 'created_at' | 'tour_date' | 'customer_name' | 'product_name') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
  groupByDate: boolean
  onGroupByDateChange: (value: boolean) => void
  itemsPerPage: number
  onItemsPerPageChange: (value: number) => void
  channels: Array<{ id: string; name: string }>
  onAddReservation: () => void
  onReset: () => void
}

export default function FilterControls({
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedChannel,
  onChannelChange,
  dateRange,
  onDateRangeChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  groupByDate,
  onGroupByDateChange,
  itemsPerPage,
  onItemsPerPageChange,
  channels,
  onAddReservation,
  onReset
}: FilterControlsProps) {
  const t = useTranslations('reservations')

  return (
    <div className="space-y-4">
      {/* 헤더 - 모바일 최적화 */}
      <div className="space-y-4">
        {/* 첫 번째 줄: 타이틀과 액션 버튼들 */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex-shrink-0">
              {t('title')}
            </h1>
          </div>
          
          {/* 검색창과 새예약 추가 버튼 */}
          <div className="flex items-center space-x-2 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="예약번호, 고객명, 다른 이름(영문명 등), 특별요청, 상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={onAddReservation}
              className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center space-x-1 text-xs sm:text-sm flex-shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t('addReservation')}</span>
              <span className="sm:hidden">추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-4">
        {/* 고급 필터 - 모바일 최적화 */}
        <div className="space-y-3">
          {/* 첫 번째 줄: 상태, 채널, 시작일, 종료일 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
              <option value="recruiting">모집중</option>
            </select>
            
            <select
              value={selectedChannel}
              onChange={(e) => onChannelChange(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">모든 채널</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
            
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="시작일"
            />
            
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="종료일"
            />
          </div>
          
          {/* 두 번째 줄: 정렬, 그룹화, 페이지당, 초기화 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap">정렬:</label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
                className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs flex-1"
              >
                <option value="created_at">등록일</option>
                <option value="tour_date">투어 날짜</option>
                <option value="customer_name">고객명</option>
                <option value="product_name">상품명</option>
              </select>
              <button
                onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <button
              onClick={() => onGroupByDateChange(!groupByDate)}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                groupByDate 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {groupByDate ? '그룹화 ON' : '그룹화 OFF'}
            </button>
            
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            
            <button
              onClick={onReset}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
