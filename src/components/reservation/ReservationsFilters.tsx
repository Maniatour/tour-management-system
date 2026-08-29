'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import React, { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ADMIN_RESERVATION_PICKUP_HOTEL_UNSET } from '@/lib/adminReservationListFetch'
import { getPickupHotelPrimaryName } from '@/utils/pickupHotelUtils'
import { resolveProductInternalName } from '@/utils/reservationUtils'

type FilterSelectOption = { value: string; label: string; searchText?: string }

function SearchableFilterSelect({
  id,
  label,
  value,
  onChange,
  allOptionLabel,
  extraOptions = [],
  options,
  searchPlaceholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  allOptionLabel: string
  extraOptions?: FilterSelectOption[]
  options: FilterSelectOption[]
  searchPlaceholder: string
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return options
    return options.filter((option) =>
      `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(q)
    )
  }, [options, q])
  const selected =
    extraOptions.find((option) => option.value === value) ||
    options.find((option) => option.value === value)
  const selectedMissingFromFiltered =
    Boolean(selected) &&
    value !== 'all' &&
    !extraOptions.some((option) => option.value === value) &&
    !filtered.some((option) => option.value === value)

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        {...BROWSER_AUTOFILL_OFF_PROPS}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="mb-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-transparent focus:ring-1 focus:ring-ring"
      />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-transparent focus:ring-1 focus:ring-ring"
      >
        <option value="all">{allOptionLabel}</option>
        {extraOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {selectedMissingFromFiltered && selected ? (
          <option value={selected.value}>{selected.label}</option>
        ) : null}
        {filtered.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ReservationsFiltersProps {
  isFiltersCollapsed?: boolean
  onToggleFilters?: () => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  selectedChannel: string
  onChannelChange: (channel: string) => void
  channels: Array<{ id: string; name: string }>
  selectedPickupHotel: string
  onPickupHotelChange: (hotelId: string) => void
  pickupHotels: Array<{
    id: string
    hotel?: string | null
    internal_name?: string | null
    pick_up_location?: string | null
  }>
  selectedProduct: string
  onProductChange: (productId: string) => void
  products: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }>
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
  /** 리스트 뷰: 정렬·날짜 그룹은 고정(등록일 최신순)이므로 필터에서 숨김 */
  listViewActive?: boolean
  /** 모달 열림 상태 (제어 모드, 모바일 행 버튼과 동기화용) */
  filterModalOpen?: boolean
  onFilterModalOpenChange?: (open: boolean) => void
}

function ReservationsFilters({
  selectedStatus,
  onStatusChange,
  selectedChannel,
  onChannelChange,
  channels,
  selectedPickupHotel,
  onPickupHotelChange,
  pickupHotels,
  selectedProduct,
  onProductChange,
  products,
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
  listViewActive = false,
  filterModalOpen: controlledOpen,
  onFilterModalOpenChange
}: ReservationsFiltersProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined && onFilterModalOpenChange !== undefined
  const modalOpen = isControlled ? controlledOpen : internalOpen
  const setModalOpen = isControlled ? onFilterModalOpenChange! : setInternalOpen

  const openModal = () => setModalOpen(true)
  const closeModal = () => setModalOpen(false)

  const pickupHotelOptions = useMemo(
    () =>
      [...pickupHotels]
        .map((hotel) => {
          const name = getPickupHotelPrimaryName({
            hotel: String(hotel.hotel ?? '').trim(),
            internal_name: hotel.internal_name,
          })
          const location = String(hotel.pick_up_location ?? '').trim()
          return {
            value: hotel.id,
            label: location ? `${name} — ${location}` : name || hotel.id,
            searchText: `${hotel.hotel ?? ''} ${hotel.internal_name ?? ''} ${location}`,
          }
        })
        .sort((a, b) => a.label.localeCompare(b.label, locale.startsWith('en') ? 'en' : 'ko')),
    [pickupHotels, locale]
  )

  const productOptions = useMemo(
    () =>
      [...products]
        .map((product) => ({
          value: product.id,
          label: resolveProductInternalName(product) || product.id,
          searchText: `${product.name ?? ''} ${product.name_ko ?? ''} ${product.name_en ?? ''}`,
        }))
        .filter((option) => option.label && option.label !== 'Unknown')
        .sort((a, b) => a.label.localeCompare(b.label, locale.startsWith('en') ? 'en' : 'ko')),
    [products, locale]
  )

  const filterContent = (
    <>
      {/* 상태, 채널, 시작일, 종료일 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('filtersStatusLabel')}</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
          >
            <option value="all">{t('filters.allStatus')}</option>
            <option value="pending">{t('filters.pending')}</option>
            <option value="confirmed">{t('filters.confirmed')}</option>
            <option value="completed">{t('filters.completed')}</option>
            <option value="cancelled">{t('filters.cancelled')}</option>
            <option value="no_show">{t('filters.no_show')}</option>
            <option value="deleted">{t('filters.deleted')}</option>
            <option value="recruiting">{t('filters.recruiting')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('filtersChannelLabel')}</label>
          <select
            value={selectedChannel}
            onChange={(e) => onChannelChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
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
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('filtersEndDate')}</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
          />
        </div>
      </div>
      <SearchableFilterSelect
        id="reservations-filter-pickup-hotel"
        label={t('filtersPickupHotelLabel')}
        value={selectedPickupHotel}
        onChange={onPickupHotelChange}
        allOptionLabel={t('filters.allPickupHotels')}
        extraOptions={[
          { value: ADMIN_RESERVATION_PICKUP_HOTEL_UNSET, label: t('filters.pickupHotelUnset') },
        ]}
        options={pickupHotelOptions}
        searchPlaceholder={t('filters.pickupHotelSearch')}
      />
      <SearchableFilterSelect
        id="reservations-filter-product"
        label={t('filtersProductLabel')}
        value={selectedProduct}
        onChange={onProductChange}
        allOptionLabel={t('filters.allProducts')}
        options={productOptions}
        searchPlaceholder={t('filters.productSearch')}
      />
      {/* 정렬, 그룹화, 페이지당 */}
      {listViewActive ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">{t('listView.sortHint')}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('pagination.itemsPerPage')}</label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
            >
              <option value={10}>10{t('pagination.itemsPerPage')}</option>
              <option value={20}>20{t('pagination.itemsPerPage')}</option>
              <option value={50}>50{t('pagination.itemsPerPage')}</option>
              <option value={100}>100{t('pagination.itemsPerPage')}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onReset()
                closeModal()
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {t('pagination.reset')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('sorting.label')}</label>
              <div className="flex gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => onSortByChange(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
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
                groupByDate ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
      )}
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
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t('filter')}</span>
          </button>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('filter')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {filterContent}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={closeModal}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              {t('apply')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default React.memo(ReservationsFilters)
