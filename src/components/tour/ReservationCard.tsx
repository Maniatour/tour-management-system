import React from 'react'
import { Check, X, Users, Clock, Building } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'

interface Reservation {
  id: string
  customer_id: string | null
  product_id: string | null
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number | null
  children?: number | null
  infants?: number | null
  status: string | null
  tour_id: string | null
  choices?: string | null
  [key: string]: unknown
}

interface ReservationCardProps {
  reservation: Reservation
  isStaff: boolean
  showActions?: boolean
  showStatus?: boolean
  showTourInfo?: boolean
  onEdit?: (reservation: Reservation) => void
  onUnassign?: (reservationId: string) => void
  onReassign?: (reservationId: string, fromTourId: string) => void
  onEditPickupTime?: (reservation: Reservation) => void
  onEditPickupHotel?: (reservation: Reservation) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
}

export const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  isStaff,
  showActions = false,
  showStatus = false,
  showTourInfo = false,
  onEdit,
  onUnassign,
  onReassign,
  onEditPickupTime,
  onEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  safeJsonParse,
  pickupHotels = []
}) => {
  const customerName = getCustomerName(reservation.customer_id || '')
  const customerLanguage = getCustomerLanguage(reservation.customer_id || '')
  
  // 총 인원수 계산
  const totalPeople = (reservation.adults || 0) + (reservation.children || 0) + (reservation.infants || 0)
  
  // 언어에 따른 국기 코드 결정
  const getFlagCode = (language: string) => {
    if (!language) return 'US' // 기본값은 미국 국기
    const lang = language.toUpperCase()
    return lang === 'KR' || lang === 'KO' ? 'KR' : 'US'
  }
  
  const flagCode = getFlagCode(customerLanguage)

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'recruiting':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getChoiceColor = (choiceName: string) => {
    if (!choiceName) return 'bg-gray-100 text-gray-600'
    
    const choiceLower = choiceName.toLowerCase()
    switch (choiceLower) {
      case 'antelope x canyon':
      case '앤텔롭 x 캐년':
        return 'bg-purple-100 text-purple-800'
      case 'upper antelope':
      case '어퍼 앤텔롭':
        return 'bg-indigo-100 text-indigo-800'
      case 'lower antelope':
      case '로워 앤텔롭':
        return 'bg-pink-100 text-pink-800'
      case 'horseshoe bend':
      case '호스슈 벤드':
        return 'bg-teal-100 text-teal-800'
      case 'grand canyon':
      case '그랜드 캐년':
        return 'bg-orange-100 text-orange-800'
      case 'standard':
      case '기본':
        return 'bg-blue-100 text-blue-800'
      case 'premium':
      case '프리미엄':
        return 'bg-yellow-100 text-yellow-800'
      case 'deluxe':
      case '디럭스':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getSelectedChoices = () => {
    if (!reservation.choices) return []
    
    try {
      const choicesData = safeJsonParse(reservation.choices)
      if (!choicesData || typeof choicesData !== 'object') return []
      
      const selectedChoices: string[] = []
      
      // required 배열에서 선택된 옵션들 찾기
      const choicesObj = choicesData as Record<string, unknown>
      if (choicesObj.required && Array.isArray(choicesObj.required)) {
        (choicesObj.required as Array<Record<string, unknown>>).forEach((choice) => {
          if (choice.options && Array.isArray(choice.options)) {
            (choice.options as Array<Record<string, unknown>>).forEach((option) => {
              if (option.selected || option.is_default) {
                // 영어 이름 우선, 없으면 한국어 이름
                selectedChoices.push((option.name as string) || (option.name_ko as string) || 'Unknown')
              }
            })
          }
        })
      }
      
      return selectedChoices
    } catch (error) {
      console.error('Error parsing choices:', error)
      return []
    }
  }

  const getPickupHotelName = () => {
    if (!reservation.pickup_hotel) return '미정'
    
    // pickup_hotels 테이블에서 호텔 정보 찾기
    const hotelId = reservation.pickup_hotel
    const hotel = pickupHotels.find(h => h.id === hotelId)
    
    if (hotel) {
      return hotel.hotel
    }
    
    // JSON 형태로 저장된 경우 파싱 (fallback)
    // 먼저 JSON인지 확인
    if (typeof reservation.pickup_hotel === 'string' && reservation.pickup_hotel.startsWith('{')) {
      try {
        const hotelData = safeJsonParse(reservation.pickup_hotel)
        if (hotelData && typeof hotelData === 'object') {
          const hotelObj = hotelData as Record<string, unknown>
          return (hotelObj.hotel as string) || (hotelObj.name as string) || '미정'
        }
      } catch (error) {
        console.error('호텔 JSON 파싱 오류:', error)
      }
    }
    
    // 단순 문자열인 경우 그대로 반환
    return reservation.pickup_hotel
  }

  const getPickupLocation = () => {
    if (!reservation.pickup_hotel) return null
    
    // pickup_hotels 테이블에서 픽업 위치 찾기
    const hotelId = reservation.pickup_hotel
    const hotel = pickupHotels.find(h => h.id === hotelId)
    
    if (hotel && hotel.pick_up_location) {
      return hotel.pick_up_location
    }
    
    return null
  }

  const getPickupTime = () => {
    if (!reservation.pickup_time) return '미정'
    
    // 시간에서 초 단위 제거 (HH:MM:SS -> HH:MM)
    const timeStr = reservation.pickup_time
    if (timeStr.includes(':')) {
      const timeParts = timeStr.split(':')
      if (timeParts.length >= 2) {
        return `${timeParts[0]}:${timeParts[1]}`
      }
    }
    
    return timeStr
  }

  return (
    <div 
      className={`p-3 rounded-lg border transition-colors ${
        isStaff 
          ? 'bg-white hover:bg-gray-50 cursor-pointer' 
          : 'bg-gray-50 cursor-not-allowed'
      }`}
      onClick={() => onEdit && isStaff ? onEdit(reservation) : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          {/* 국가 플래그 */}
          <ReactCountryFlag
            countryCode={flagCode || 'US'}
            svg
            style={{
              width: '20px',
              height: '15px'
            }}
          />
          
          {/* 고객 정보 */}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <p className="font-medium text-sm text-gray-900">{customerName}</p>
              {/* 총 인원수 뱃지 */}
              <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                <Users size={12} />
                <span>{totalPeople}</span>
              </div>
              {/* 선택된 Choices 뱃지들 */}
              {getSelectedChoices().map((choiceName, index) => (
                <div key={index} className={`px-2 py-1 rounded-full text-xs font-medium ${getChoiceColor(choiceName)}`}>
                  {choiceName}
                </div>
              ))}
            </div>
         
            
            {/* 픽업 정보 */}
            <div className="mt-1 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span>{getPickupTime()}</span>
                  <span>•</span>
                  <span>{getPickupHotelName()}</span>
                </div>
                {/* 픽업 수정 버튼들 */}
                {isStaff && (onEditPickupTime || onEditPickupHotel) && (
                  <div className="flex items-center space-x-1">
                    {onEditPickupTime && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditPickupTime(reservation)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="픽업 시간 수정"
                      >
                        <Clock size={12} />
                      </button>
                    )}
                    {onEditPickupHotel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditPickupHotel(reservation)
                        }}
                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="픽업 호텔 수정"
                      >
                        <Building size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {getPickupLocation() && (
                <div className="text-xs text-gray-400 mt-1">
                  {getPickupLocation()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 정보 */}
        <div className="flex items-center space-x-2">
          {/* 상태 표시 */}
          {showStatus && reservation.status && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
              {reservation.status}
            </span>
          )}

          {/* 투어 정보 */}
          {showTourInfo && reservation.tour_id && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              투어 배정됨
            </span>
          )}

          {/* 액션 버튼들 */}
          {showActions && isStaff && (
            <div className="flex items-center space-x-1">
              {onUnassign && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnassign(reservation.id)
                  }}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="배정 해제"
                >
                  <X size={14} />
                </button>
              )}
              
              {onReassign && reservation.tour_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (reservation.tour_id) {
                      onReassign(reservation.id, reservation.tour_id)
                    }
                  }}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="다른 투어로 재배정"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
