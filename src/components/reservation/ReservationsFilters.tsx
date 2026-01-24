'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

interface ReservationsFiltersProps {
  isFiltersCollapsed: boolean
  onToggleFilters: () => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  selectedChannel: string
  onChannelChange: (channel: string) => void
  channels: Array<{ id: string; name: string }>
  dateRange: { start: string; end: string }
  onDateRangeChange: (range: { start: string; end: string }) => void
  sortBy: 'created_at' | 'tour_date' | 'customer_name' | 'product_name'
  onSortByChange: (sortBy: 'created_at' | 'tour_date' | 'customer_name' | 'product_name') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (order: 'asc' | 'desc') => void
  groupByDate: boolean
  onGroupByDateChange: (group: boolean) => void
  itemsPerPage: number
  onItemsPerPageChange: (items: number) => void
  onReset: () => void
}

export default function ReservationsFilters({
  isFiltersCollapsed,
  onToggleFilters,
  selectedStatus,
  onStatusChange,
  selectedChannel,
  onChannelChange,
  channels,
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
  onReset
}: ReservationsFiltersProps) {
  const t = useTranslations('reservations')

  return (
    <div className="space-y-4">
      {/* 필터 접기/펼치기 버튼 */}
      <button
        onClick={onToggleFilters}
        className="flex items-center justify-between w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">필터</span>
        <ChevronDown 
          className={`w-4 h-4 text-gray-600 transition-transform ${isFiltersCollapsed ? '' : 'rotate-180'}`}
        />
      </button>

      {/* 고급 필터 - 모바일 최적화 */}
      {!isFiltersCollapsed && (
        <div className="space-y-3">
          {/* 첫 번째 줄: 상태, 채널, 시작일, 종료일 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">{t('filters.allStatus')}</option>
              <option value="pending">{t('filters.pending')}</option>
              <option value="confirmed">{t('filters.confirmed')}</option>
              <option value="completed">{t('filters.completed')}</option>
              <option value="cancelled">{t('filters.cancelled')}</option>
              <option value="recruiting">{t('filters.recruiting')}</option>
            </select>
            
            <select
              value={selectedChannel}
              onChange={(e) => onChannelChange(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">{t('filters.allChannel')}</option>
              {channels?.map((channel) => (
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
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap">{t('sorting.label')}</label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
                className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs flex-1"
              >
                <option value="created_at">{t('sorting.registrationDate')}</option>
                <option value="tour_date">{t('sorting.tourDate')}</option>
                <option value="customer_name">{t('sorting.customerName')}</option>
                <option value="product_name">{t('sorting.productName')}</option>
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
              {groupByDate ? t('grouping.on') : t('grouping.off')}
            </button>
            
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
            >
              <option value={10}>10{t('pagination.itemsPerPage')}</option>
              <option value={20}>20{t('pagination.itemsPerPage')}</option>
              <option value={50}>50{t('pagination.itemsPerPage')}</option>
              <option value={100}>100{t('pagination.itemsPerPage')}</option>
            </select>
            
            <button
              onClick={onReset}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              {t('pagination.reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
