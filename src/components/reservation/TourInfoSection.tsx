'use client'

import type { ReactNode } from 'react'

interface PickupHotel {
  id: string
  hotel: string
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
  /** true이면 지난 날짜도 선택 가능 (super 계정용) */
  allowPastDate?: boolean
  /** 3번째 줄 채널 영역 (예: 채널 선택 버튼) */
  channelSlot?: ReactNode
}

export default function TourInfoSection({
  formData,
  setFormData,
  pickupHotels,
  sanitizeTimeInput,
  t,
  allowPastDate = false,
  channelSlot
}: TourInfoSectionProps) {
  // 날짜 범위: allowPastDate면 3년 전~3년 후, 아니면 오늘~3년 후
  const today = new Date()
  const todayString = today.toISOString().split('T')[0] // YYYY-MM-DD 형식
  const threeYearsLater = new Date(today)
  threeYearsLater.setFullYear(today.getFullYear() + 3)
  const maxDateString = threeYearsLater.toISOString().split('T')[0] // YYYY-MM-DD 형식
  const threeYearsAgo = new Date(today)
  threeYearsAgo.setFullYear(today.getFullYear() - 3)
  const minDateString = allowPastDate ? threeYearsAgo.toISOString().split('T')[0] : todayString

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
            min={minDateString}
            max={maxDateString}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.tourTime')}</label>
          <input
            type="time"
            value={formData.tourTime}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, tourTime: sanitizeTimeInput(e.target.value) }))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
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
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          />
        </div>
      </div>

      {/* 4번째 줄: 픽업 호텔 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.pickUpHotel')}</label>
        <div className="relative pickup-hotel-dropdown">
          <input
            type="text"
            value={formData.pickUpHotelSearch}
            onChange={(e) => {
              setFormData((prev: any) => ({ ...prev, pickUpHotelSearch: e.target.value, showPickupHotelDropdown: true }))
            }}
            onFocus={() => setFormData((prev: any) => ({ ...prev, showPickupHotelDropdown: true }))}
            placeholder="픽업 호텔을 검색하세요"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          />

          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {formData.showPickupHotelDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {pickupHotels
                .filter(hotel =>
                  hotel.is_active && (
                    hotel.hotel.toLowerCase().includes(formData.pickUpHotelSearch.toLowerCase()) ||
                    hotel.pick_up_location.toLowerCase().includes(formData.pickUpHotelSearch.toLowerCase())
                  )
                )
                .map((hotel) => (
                  <div
                    key={hotel.id}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setFormData((prev: any) => ({
                        ...prev,
                        pickUpHotel: hotel.id,
                        pickUpHotelSearch: `${hotel.hotel} - ${hotel.pick_up_location}`,
                        showPickupHotelDropdown: false
                      }))
                    }}
                  >
                    <div className="font-medium text-gray-900">{hotel.hotel}</div>
                    <div className="text-sm text-gray-600">{hotel.pick_up_location}</div>
                  </div>
                ))}
              {pickupHotels.filter(hotel =>
                hotel.is_active && (
                  hotel.hotel.toLowerCase().includes(formData.pickUpHotelSearch.toLowerCase()) ||
                  hotel.pick_up_location.toLowerCase().includes(formData.pickUpHotelSearch.toLowerCase())
                )
              ).length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-center">
                  검색 결과가 없습니다
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
