import { X } from 'lucide-react'

interface PickupHotelModalProps {
  isOpen: boolean
  selectedReservation: any
  hotelSearchTerm: string
  filteredHotels: any[]
  onSearchChange: (term: string) => void
  onHotelSelect: (hotelId: string) => void
  onCancel: () => void
  getCustomerName: (customerId: string) => string
}

export default function PickupHotelModal({
  isOpen,
  selectedReservation,
  hotelSearchTerm,
  filteredHotels,
  onSearchChange,
  onHotelSelect,
  onCancel,
  getCustomerName
}: PickupHotelModalProps) {
  if (!isOpen || !selectedReservation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            픽업 호텔 변경
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {getCustomerName(selectedReservation.customer_id || '')}님의 픽업 호텔을 선택해주세요.
          </p>
          
          {/* 검색 입력 필드 */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="호텔명 또는 픽업 위치로 검색..."
              value={hotelSearchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredHotels.length > 0 ? (
              filteredHotels.map((hotel: any) => (
                <button
                  key={hotel.id}
                  onClick={() => onHotelSelect(hotel.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedReservation.pickup_hotel === hotel.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{hotel.hotel}</div>
                  {hotel.pick_up_location && (
                    <div className="text-xs text-gray-500 mt-1">{hotel.pick_up_location}</div>
                  )}
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">검색 결과가 없습니다.</p>
                <p className="text-xs mt-1">다른 검색어를 시도해보세요.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
