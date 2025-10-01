'use client'

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
}

export default function TourInfoSection({
  formData,
  setFormData,
  pickupHotels,
  sanitizeTimeInput,
  t
}: TourInfoSectionProps) {
  return (
    <>
      {/* 두 번째 행: 투어 날짜, 투어 시간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourDate')}</label>
          <input
            type="date"
            value={formData.tourDate}
            onChange={(e) => setFormData({ ...formData, tourDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
             
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourTime')}</label>
          <input
            type="time"
            value={formData.tourTime}
            onChange={(e) => setFormData({ ...formData, tourTime: sanitizeTimeInput(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 세 번째 행: 픽업 호텔, 픽업 시간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.pickUpHotel')}</label>
          <div className="relative pickup-hotel-dropdown">
            <input
              type="text"
              value={formData.pickUpHotelSearch}
              onChange={(e) => {
                setFormData({ ...formData, pickUpHotelSearch: e.target.value, showPickupHotelDropdown: true })
              }}
              onFocus={() => setFormData({ ...formData, showPickupHotelDropdown: true })}
              placeholder="픽업 호텔을 검색하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* 드롭다운 화살표 */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* 드롭다운 메뉴 */}
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
                        setFormData({
                          ...formData,
                          pickUpHotel: hotel.id,
                          pickUpHotelSearch: `${hotel.hotel} - ${hotel.pick_up_location}`,
                          showPickupHotelDropdown: false
                        })
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
             
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.pickUpTime')}</label>
          <input
            type="time"
            value={formData.pickUpTime}
            onChange={(e) => setFormData({ ...formData, pickUpTime: sanitizeTimeInput(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </>
  )
}
