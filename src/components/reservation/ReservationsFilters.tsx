'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ReservationsFiltersProps {
  isFiltersCollapsed?: boolean
  onToggleFilters?: () => void
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
  /** 모달 열림 상태 (제어 모드, 모바일 행 버튼과 동기화용) */
  filterModalOpen?: boolean
  onFilterModalOpenChange?: (open: boolean) => void
}

export default function ReservationsFilters({
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
  onReset,
  filterModalOpen: controlledOpen,
  onFilterModalOpenChange
}: ReservationsFiltersProps) {
  const t = useTranslations('reservations')
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined && onFilterModalOpenChange !== undefined
  const modalOpen = isControlled ? controlledOpen : internalOpen
  const setModalOpen = isControlled ? onFilterModalOpenChange! : setInternalOpen

  const openModal = () => setModalOpen(true)
  const closeModal = () => setModalOpen(false)

  const filterContent = (
    <>
      {/* 상태, 채널, 시작일, 종료일 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">{t('filters.allStatus')}</option>
            <option value="pending">{t('filters.pending')}</option>
            <option value="confirmed">{t('filters.confirmed')}</option>
            <option value="completed">{t('filters.completed')}</option>
            <option value="cancelled">{t('filters.cancelled')}</option>
            <option value="recruiting">{t('filters.recruiting')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">채널</label>
          <select
            value={selectedChannel}
            onChange={(e) => onChannelChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">{t('filters.allChannel')}</option>
            {channels?.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">종료일</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
      {/* 정렬, 그룹화, 페이지당 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('sorting.label')}</label>
          <div className="flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="created_at">{t('sorting.registrationDate')}</option>
              <option value="tour_date">{t('sorting.tourDate')}</option>
              <option value="customer_name">{t('sorting.customerName')}</option>
              <option value="product_name">{t('sorting.productName')}</option>
            </select>
            <button
              type="button"
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('pagination.itemsPerPage')}</label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value={10}>10{t('pagination.itemsPerPage')}</option>
            <option value={20}>20{t('pagination.itemsPerPage')}</option>
            <option value={50}>50{t('pagination.itemsPerPage')}</option>
            <option value={100}>100{t('pagination.itemsPerPage')}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onGroupByDateChange(!groupByDate)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            groupByDate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {groupByDate ? t('grouping.on') : t('grouping.off')}
        </button>
        <button
          type="button"
          onClick={() => { onReset(); closeModal(); }}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {t('pagination.reset')}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* 데스크톱 필터 버튼: 제목줄에 배치된 경우(제어 모드)에는 여기서 숨김 */}
      {!isControlled && (
        <div className="hidden md:block">
          <button
            type="button"
            onClick={openModal}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>필터</span>
          </button>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>필터</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {filterContent}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={closeModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              적용
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
