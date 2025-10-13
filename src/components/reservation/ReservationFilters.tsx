'use client'

import { useCallback } from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ReservationFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedStatus: string
  onStatusChange: (value: string) => void
  selectedChannel: string
  onChannelChange: (value: string) => void
  sortBy: string
  onSortByChange: (value: string) => void
  sortOrder: 'asc' | 'desc'
  onSortOrderToggle: () => void
  groupByDate: boolean
  onGroupByDateToggle: () => void
  dateRange: { start: string; end: string }
  onDateRangeChange: (field: 'start' | 'end', value: string) => void
  onClearFilters: () => void
  channels: Array<{ id: string; name: string }>
  onAddReservation: () => void
}

export default function ReservationFilters({
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedChannel,
  onChannelChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  groupByDate,
  onGroupByDateToggle,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  channels,
  onAddReservation
}: ReservationFiltersProps) {
  const t = useTranslations('reservations')

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value)
  }, [onSearchChange])

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(e.target.value)
  }, [onStatusChange])

  const handleChannelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChannelChange(e.target.value)
  }, [onChannelChange])

  const handleSortByChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortByChange(e.target.value)
  }, [onSortByChange])

  const handleDateRangeChange = useCallback((field: 'start' | 'end') => (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateRangeChange(field, e.target.value)
  }, [onDateRangeChange])

  return (
    <div className="space-y-4">
      {/* 검색 및 추가 버튼 */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="예약번호, 고객명, 다른 이름(영문명 등), 특별요청, 상품명으로 검색..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
          />
        </div>
        <button
          onClick={onAddReservation}
          className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center space-x-1 text-xs sm:text-sm flex-shrink-0"
        >
          <span className="hidden sm:inline">{t('addReservation')}</span>
          <span className="sm:hidden">추가</span>
        </button>
      </div>

      {/* 필터 옵션들 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 상태 필터 */}
        <select
          value={selectedStatus}
          onChange={handleStatusChange}
          className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        >
          <option value="all">모든 상태</option>
          <option value="confirmed">확정</option>
          <option value="pending">대기</option>
          <option value="cancelled">취소</option>
          <option value="completed">완료</option>
        </select>

        {/* 채널 필터 */}
        <select
          value={selectedChannel}
          onChange={handleChannelChange}
          className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        >
          <option value="all">모든 채널</option>
          {channels.map(channel => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>

        {/* 정렬 기준 */}
        <select
          value={sortBy}
          onChange={handleSortByChange}
          className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        >
          <option value="created_at">생성일</option>
          <option value="tour_date">투어일</option>
          <option value="customer_name">고객명</option>
          <option value="product_name">상품명</option>
        </select>

        {/* 정렬 순서 */}
        <button
          onClick={onSortOrderToggle}
          className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-xs sm:text-sm flex items-center justify-center"
        >
          {sortOrder === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}
        </button>

        {/* 날짜별 그룹화 */}
        <button
          onClick={onGroupByDateToggle}
          className={`px-2 py-1.5 border rounded-md text-xs sm:text-sm ${
            groupByDate 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          날짜별 그룹화
        </button>

        {/* 필터 초기화 */}
        <button
          onClick={onClearFilters}
          className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-xs sm:text-sm"
        >
          필터 초기화
        </button>
      </div>

      {/* 날짜 범위 필터 */}
      <div className="flex items-center space-x-2">
        <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">날짜 범위:</label>
        <input
          type="date"
          value={dateRange.start}
          onChange={handleDateRangeChange('start')}
          className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        />
        <span className="text-gray-500">~</span>
        <input
          type="date"
          value={dateRange.end}
          onChange={handleDateRangeChange('end')}
          className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        />
      </div>
    </div>
  )
}
