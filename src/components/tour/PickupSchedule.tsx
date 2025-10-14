import React from 'react'
import { ChevronDown, ChevronUp, MapPin, Map } from 'lucide-react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface PickupScheduleProps {
  assignedReservations: Array<{
    id: string
    customer_id: string | null
    pickup_hotel: string | null
    pickup_time: string | null
    adults: number | null
    children?: number | null
    infants?: number | null
  }>
  pickupHotels: Array<{
    id: string
    hotel: string
    pick_up_location?: string
    google_maps_link?: string
  }>
  expandedSections: Set<string>
  connectionStatus: { reservations: boolean }
  onToggleSection: (sectionId: string) => void
  onAutoGenerate: () => void
  getPickupHotelNameOnly: (hotelId: string) => string
  getCustomerName: (customerId: string) => string
  openGoogleMaps: (link: string) => void
}

export const PickupSchedule: React.FC<PickupScheduleProps> = ({
  assignedReservations,
  pickupHotels,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onAutoGenerate,
  getPickupHotelNameOnly,
  getCustomerName,
  openGoogleMaps
}) => {
  const renderPickupSchedule = () => {
    if (assignedReservations.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">배정된 예약이 없습니다.</p>
          <p className="text-xs">예약을 배정하면 픽업 스케줄이 표시됩니다.</p>
        </div>
      )
    }

    // 호텔별로 그룹화
    const groupedByHotel = assignedReservations.reduce((acc: Record<string, Array<{ id: string; customer_id: string | null; pickup_time: string | null; adults: number | null; children?: number | null; infants?: number | null }>>, reservation) => {
      const hotelName = getPickupHotelNameOnly(reservation.pickup_hotel || '')
      if (!acc[hotelName]) {
        acc[hotelName] = []
      }
      acc[hotelName].push(reservation)
      return acc
    }, {} as Record<string, any[]>)

    return Object.entries(groupedByHotel).map(([hotelName, reservations]) => {
      const totalPeople = reservations.reduce((sum: number, res) => sum + ((res.adults || 0) + (res.children || 0) + (res.infants || 0)), 0)
      const hotelInfo = pickupHotels.find((h) => h.hotel === hotelName)
      
      // 가장 빠른 픽업 시간 찾기
      const pickupTimes = reservations.map((r) => r.pickup_time).filter(Boolean)
      const earliestTime = pickupTimes.length > 0 ? 
        (pickupTimes.sort()[0] || '').substring(0, 5) : '08:00'
      
      return (
        <div key={hotelName} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-600">{earliestTime}</span>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-sm">{hotelName} ({totalPeople}명)</span>
            </div>
            {hotelInfo?.link && (
              <button
                onClick={() => openGoogleMaps(hotelInfo.link || '')}
                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                title="구글 맵에서 보기"
              >
                <Map size={16} />
              </button>
            )}
          </div>
          {hotelInfo && (
            <div className="text-xs text-gray-500 mb-2">
              {hotelInfo.pick_up_location}
            </div>
          )}
          <div className="space-y-1">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-600">
                  {getCustomerName(reservation.customer_id || '')}
                </div>
                <div className="text-xs text-gray-500">
                  {reservation.total_people || 0}인
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer mb-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => onToggleSection('pickup-schedule')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            픽업 스케줄
            <ConnectionStatusLabel status={connectionStatus.reservations} section="예약" />
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onAutoGenerate()
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              자동생성
            </button>
            {expandedSections.has('pickup-schedule') ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        
        {expandedSections.has('pickup-schedule') && (
          <div className="space-y-2">
            {renderPickupSchedule()}
          </div>
        )}
      </div>
    </div>
  )
}
