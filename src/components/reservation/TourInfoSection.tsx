'use client'

import type { ReactNode } from 'react'
import {
  formatPickupHotelFormLabel,
  getPickupHotelPrimaryName,
} from '@/utils/pickupHotelUtils'

interface PickupHotel {
  id: string
  hotel: string
  internal_name?: string | null
  pick_up_location: string
  is_active: boolean | null
}

interface TourInfoSectionProps {
  formData: {
    tourDate: string
    tourTime: string
    pickUpHotelSearch: string
    showPickupHotelDropdown: boolean
    pickUpHotel: string
    pickUpTime: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  pickupHotels: PickupHotel[]
  sanitizeTimeInput: (value: string) => string
  t: (key: string) => string
  /** 3번째 줄 채널 영역 (예: 채널 선택 버튼) */
  channelSlot?: ReactNode
}

function isCatalogPickupHotelId(hotelId: string, pickupHotels: PickupHotel[]): boolean {
  const id = hotelId.trim()
  if (!id) return false
  return pickupHotels.some((h) => h.id === id)
}

function matchesPickupHotelSearch(hotel: PickupHotel, query: string): boolean {
  const q = query.toLowerCase()
  return (
    hotel.hotel.toLowerCase().includes(q) ||
    hotel.pick_up_location.toLowerCase().includes(q) ||
    Boolean(hotel.internal_name?.toLowerCase().includes(q))
  )
}

export default function TourInfoSection({
  formData,
  setFormData,
  pickupHotels,
  sanitizeTimeInput,
  t,
  channelSlot
}: TourInfoSectionProps) {
  const hasPickupValue =
    Boolean(formData.pickUpHotel?.trim()) || Boolean(formData.pickUpHotelSearch?.trim())
  const isUnnormalizedPickupHotel =
    hasPickupValue && !isCatalogPickupHotelId(formData.pickUpHotel, pickupHotels)

  const selectedCatalogHotel = pickupHotels.find((h) => h.id === formData.pickUpHotel)
  const selectedLabel = selectedCatalogHotel
    ? formatPickupHotelFormLabel(selectedCatalogHotel)
    : null
  const showRichSelectedLabel =
    Boolean(selectedCatalogHotel) &&
    !formData.showPickupHotelDropdown &&
    formData.pickUpHotelSearch === selectedLabel

  const filteredHotels = pickupHotels.filter(
    (hotel) => hotel.is_active && matchesPickupHotelSearch(hotel, formData.pickUpHotelSearch)
  )

  return (
    <>
      {/* 2번째 줄: 투어 날짜, 투어 시간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.tourDate')}</label>
          <input
            type="date"
            value={formData.tourDate}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, tourDate: e.target.value }))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-xs"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.tourTime')}</label>
          <input
            type="time"
            value={formData.tourTime}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, tourTime: sanitizeTimeInput(e.target.value) }))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-xs"
          />
        </div>
      </div>

      {/* 3번째 줄: 채널, 픽업 시간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          {channelSlot}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.pickUpTime')}</label>
          <input
            type="time"
            value={formData.pickUpTime}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, pickUpTime: sanitizeTimeInput(e.target.value) }))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-xs"
          />
        </div>
      </div>

      {/* 4번째 줄: 픽업 호텔 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
          <span>{t('form.pickUpHotel')}</span>
          {isUnnormalizedPickupHotel && (
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"
              title={t('form.pickUpHotelUnnormalizedHint')}
            >
              {t('form.pickUpHotelUnnormalized')}
            </span>
          )}
        </label>
        <div className="relative pickup-hotel-dropdown">
          <input
            type="text"
            value={formData.pickUpHotelSearch}
            onChange={(e) => {
              const value = e.target.value
              setFormData((prev: any) => {
                const selected = pickupHotels.find((h) => h.id === prev.pickUpHotel)
                const currentLabel = selected ? formatPickupHotelFormLabel(selected) : null
                // 카탈로그 선택 라벨을 그대로 유지 중이면 ID 유지, 그 외(미등록·직접 수정)는 자유 텍스트 저장
                const keepCatalogId = Boolean(selected && value === currentLabel)
                return {
                  ...prev,
                  pickUpHotelSearch: value,
                  pickUpHotel: keepCatalogId ? prev.pickUpHotel : value,
                  showPickupHotelDropdown: true
                }
              })
            }}
            onFocus={() => setFormData((prev: any) => ({ ...prev, showPickupHotelDropdown: true }))}
            placeholder="픽업 호텔을 검색하세요"
            className={`w-full px-2 py-1.5 pr-8 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-xs ${
              isUnnormalizedPickupHotel
                ? 'border-amber-300 bg-amber-50/40'
                : 'border-gray-300'
            } ${showRichSelectedLabel ? 'text-transparent caret-transparent' : ''}`}
          />

          {showRichSelectedLabel && selectedCatalogHotel && (
            <div className="absolute inset-y-0 left-0 right-8 flex items-center px-2 pointer-events-none text-xs truncate">
              <span className="font-bold text-gray-900 shrink-0">
                {getPickupHotelPrimaryName(selectedCatalogHotel)}
              </span>
              {selectedCatalogHotel.pick_up_location?.trim() && (
                <span className="text-gray-600 truncate">
                  <span className="text-gray-400"> - </span>
                  {selectedCatalogHotel.pick_up_location.trim()}
                </span>
              )}
            </div>
          )}

          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {formData.showPickupHotelDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredHotels.map((hotel) => (
                  <div
                    key={hotel.id}
                    className="px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setFormData((prev: any) => ({
                        ...prev,
                        pickUpHotel: hotel.id,
                        pickUpHotelSearch: formatPickupHotelFormLabel(hotel),
                        showPickupHotelDropdown: false
                      }))
                    }}
                  >
                    <div className="font-bold text-gray-900">{getPickupHotelPrimaryName(hotel)}</div>
                    <div className="text-sm text-gray-600">{hotel.pick_up_location}</div>
                  </div>
              ))}
              {filteredHotels.length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-center">
                  검색 결과가 없습니다
                  {isUnnormalizedPickupHotel && formData.pickUpHotelSearch.trim() && (
                    <div className="mt-1 text-amber-700 text-[11px]">
                      {t('form.pickUpHotelUnnormalizedSaveAsTyped')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {isUnnormalizedPickupHotel && (
          <p className="mt-1 text-[11px] text-amber-700">
            {t('form.pickUpHotelUnnormalizedHint')}
          </p>
        )}
      </div>
    </>
  )
}
