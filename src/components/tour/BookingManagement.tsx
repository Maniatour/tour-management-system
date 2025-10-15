import React from 'react'
import { Plus, Hotel } from 'lucide-react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface LocalTicketBooking {
  id: string
  reservation_id?: string | null
  status?: string | null
  company?: string | null
  category?: string | null
  time?: string | null
  ea?: number | null
  rn_number?: string | null
}

interface LocalTourHotelBooking {
  id: string
  reservation_id?: string | null
  status?: string | null
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
}

interface BookingManagementProps {
  ticketBookings: LocalTicketBooking[]
  tourHotelBookings: LocalTourHotelBooking[]
  filteredTicketBookings: LocalTicketBooking[]
  showTicketBookingDetails: boolean
  loadingStates: { bookings: boolean }
  connectionStatus: { bookings: boolean; hotelBookings: boolean }
  isStaff: boolean
  onAddTicketBooking: () => void
  onAddTourHotelBooking: () => void
  onEditTicketBooking: (booking: LocalTicketBooking) => void
  onEditTourHotelBooking: (booking: LocalTourHotelBooking) => void
  onToggleTicketBookingDetails: () => void
}

export const BookingManagement: React.FC<BookingManagementProps> = ({
  ticketBookings,
  tourHotelBookings,
  filteredTicketBookings,
  showTicketBookingDetails,
  loadingStates,
  connectionStatus,
  isStaff,
  onAddTicketBooking,
  onAddTourHotelBooking,
  onEditTicketBooking,
  onEditTourHotelBooking,
  onToggleTicketBookingDetails
}) => {
  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'Confirm'
      case 'pending':
        return 'Pending'
      case 'cancelled':
        return 'Cancelled'
      case 'completed':
        return 'Completed'
      default:
        return status || 'Unknown'
    }
  }

  const getHotelStatusText = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '확정'
      case 'pending':
        return '대기'
      case 'cancelled':
        return '취소'
      case 'completed':
        return '완료'
      default:
        return status || '미정'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            부킹 관리
            <ConnectionStatusLabel status={connectionStatus.bookings && connectionStatus.hotelBookings} section="부킹" />
            {loadingStates.bookings && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 ml-2"></div>
            )}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={onAddTicketBooking}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
            >
              <Plus size={12} />
              <span>입장권</span>
            </button>
            <button
              onClick={onAddTourHotelBooking}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center space-x-1"
            >
              <Plus size={12} />
              <span>호텔</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* 입장권 부킹 목록 */}
          {ticketBookings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  입장권 부킹 ({filteredTicketBookings.length})
                  {!showTicketBookingDetails && ticketBookings.length > filteredTicketBookings.length && 
                    ` / 전체 ${ticketBookings.length}`
                  }
                </h3>
                <button
                  onClick={onToggleTicketBookingDetails}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  {showTicketBookingDetails ? '간단히 보기' : '상세 보기'}
                </button>
              </div>
              <div className="space-y-1">
                {filteredTicketBookings.map((booking: LocalTicketBooking) => (
                  <div 
                    key={booking.id} 
                    className={`p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${isStaff ? '' : 'cursor-not-allowed'}`}
                    onClick={() => onEditTicketBooking(booking)}
                  >
                    {/* 첫 번째 줄: company와 status */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🎫</span>
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {booking.company || 'N/A'}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>
                    
                    {/* 두 번째 줄: 카테고리, 시간, 인원, RN# */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-700">
                          {booking.category || 'N/A'}
                        </span>
                        <span>
                          {booking.time ? booking.time.substring(0, 5) : 'N/A'}
                        </span>
                        <span>
                          {booking.ea || 0}명
                        </span>
                        {booking.rn_number && (
                          <span>
                            #{booking.rn_number}
                          </span>
                        )}
                      </div>
                      {/* 오른쪽 아래: 금액 */}
                      {booking.expense && booking.expense > 0 && (
                        <span className="font-semibold text-green-600">
                          ${booking.expense.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 투어 호텔 부킹 목록 */}
          {tourHotelBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">투어 호텔 부킹 ({tourHotelBookings.length})</h3>
              <div className="space-y-2">
                {tourHotelBookings.map((booking: LocalTourHotelBooking) => (
                  <div 
                    key={booking.id} 
                    className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${isStaff ? '' : 'cursor-not-allowed'}`}
                    onClick={() => onEditTourHotelBooking(booking)}
                  >
                    {/* 호텔 부킹 제목과 예약번호 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Hotel className="h-3 w-3 text-blue-600" />
                        <span className="font-medium text-sm">
                          {booking.hotel} ({booking.room_type}, {booking.rooms}개)
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {booking.rn_number || booking.booking_reference || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {/* 체크인/체크아웃 같은 줄에 배치 */}
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">체크인:</span>
                          <span className="font-medium">{booking.check_in_date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">체크아웃:</span>
                          <span className="font-medium">{booking.check_out_date}</span>
                        </div>
                      </div>
                      
                      {/* 상태 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">상태:</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(booking.status)}`}>
                            {getHotelStatusText(booking.status)}
                          </span>
                        </div>
                        {/* 오른쪽 아래: 금액 */}
                        {booking.total_cost && booking.total_cost > 0 && (
                          <span className="font-semibold text-green-600">
                            ${booking.total_cost.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 부킹이 없는 경우 */}
          {ticketBookings.length === 0 && tourHotelBookings.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <Hotel className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">등록된 부킹이 없습니다.</p>
              <p className="text-xs">위 버튼을 클릭하여 부킹을 추가하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
