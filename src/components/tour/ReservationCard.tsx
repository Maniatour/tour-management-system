import React, { useState, useEffect, useCallback } from 'react'
import { Check, X, Users, Clock, Building, DollarSign } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { SimplePickupEditModal } from './modals/SimplePickupEditModal'

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
  channel_id?: string | null
  choices?: string | null
  [key: string]: unknown
}

interface PaymentRecord {
  id: string
  reservation_id: string
  payment_status: 'pending' | 'confirmed' | 'rejected'
  amount: number
  payment_method: string
  note?: string
  submit_on: string
  amount_krw?: number
}

interface ReservationPricing {
  id: string
  reservation_id: string
  balance_amount: number
  total_amount: number
  paid_amount: number
  currency: string
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
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getChannelInfo?: (channelId: string) => Promise<{ name: string; favicon?: string } | null | undefined>
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
  getCustomerName,
  getCustomerLanguage,
  getChannelInfo,
  safeJsonParse,
  pickupHotels = []
}) => {
  const customerName = getCustomerName(reservation.customer_id || '')
  const customerLanguage = getCustomerLanguage(reservation.customer_id || '')
  
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [showPaymentRecords, setShowPaymentRecords] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [reservationPricing, setReservationPricing] = useState<ReservationPricing | null>(null)
  const [loadingPricing, setLoadingPricing] = useState(false)
  const [showSimplePickupModal, setShowSimplePickupModal] = useState(false)
  const [channelInfo, setChannelInfo] = useState<{ name: string; favicon?: string } | null>(null)
  const [loadingChannel, setLoadingChannel] = useState(false)
  
  // 채널 정보 가져오기
  const fetchChannelInfo = useCallback(async () => {
    if (!getChannelInfo || !reservation.channel_id) return
    
    setLoadingChannel(true)
    try {
      const info = await getChannelInfo(reservation.channel_id)
      setChannelInfo(info || null)
    } catch (error) {
      console.error('채널 정보 조회 오류:', error)
      setChannelInfo(null)
    } finally {
      setLoadingChannel(false)
    }
  }, [getChannelInfo, reservation.channel_id])

  // 예약 가격 정보 가져오기
  const fetchReservationPricing = useCallback(async () => {
    if (!isStaff) return
    
    setLoadingPricing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/reservation-pricing?reservation_id=${reservation.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        // 404 오류는 데이터가 없는 것으로 처리
        if (response.status === 404) {
          setReservationPricing(null)
          return
        }
        throw new Error('예약 가격 정보를 불러올 수 없습니다.')
      }

      const data = await response.json()
      setReservationPricing(data.pricing || null)
    } catch (error) {
      console.error('예약 가격 정보 조회 오류:', error)
    } finally {
      setLoadingPricing(false)
    }
  }, [isStaff, reservation.id])

  // 컴포넌트 마운트 시 가격 정보와 채널 정보 가져오기
  useEffect(() => {
    if (isStaff) {
      fetchReservationPricing()
    }
    fetchChannelInfo()
  }, [isStaff, reservation.id, fetchReservationPricing, fetchChannelInfo])

  // 입금 내역 가져오기
  const fetchPaymentRecords = async () => {
    if (!isStaff) return
    
    setLoadingPayments(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/payment-records?reservation_id=${reservation.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('입금 내역을 불러올 수 없습니다.')
      }

      const data = await response.json()
      setPaymentRecords(data.paymentRecords || [])
    } catch (error) {
      console.error('입금 내역 조회 오류:', error)
    } finally {
      setLoadingPayments(false)
    }
  }

  // 입금 내역 표시 토글
  const togglePaymentRecords = () => {
    if (!showPaymentRecords && paymentRecords.length === 0) {
      fetchPaymentRecords()
    }
    setShowPaymentRecords(!showPaymentRecords)
  }

  // 픽업 정보 저장
  const handleSavePickupInfo = async (reservationId: string, pickupTime: string, pickupHotel: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/reservations/update-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          pickup_time: pickupTime,
          pickup_hotel: pickupHotel
        })
      })

      if (!response.ok) {
        throw new Error('픽업 정보 저장에 실패했습니다.')
      }

      // 성공 시 로컬 상태 업데이트
      const updatedReservation = {
        ...reservation,
        pickup_time: pickupTime,
        pickup_hotel: pickupHotel
      }
      
      // 부모 컴포넌트에 변경사항 알림 (필요시)
      console.log('픽업 정보가 저장되었습니다:', updatedReservation)
      
    } catch (error) {
      console.error('픽업 정보 저장 오류:', error)
      throw error
    }
  }

  // 총 인원수 계산
  const totalPeople = (reservation.adults || 0) + (reservation.children || 0) + (reservation.infants || 0)
  
  // 언어에 따른 국기 코드 결정
  const getFlagCode = (language: string) => {
    if (!language) return 'US' // 기본값은 미국 국기
    const lang = language.toUpperCase()
    return lang === 'KR' || lang === 'KO' ? 'KR' : 'US'
  }
  
  const flagCode = getFlagCode(customerLanguage)

  const getReservationStatusColor = (status: string) => {
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
      case 'x canyon':
      case 'antelope x canyon':
      case '앤텔롭 x 캐년':
        return 'bg-gradient-to-r from-purple-400 to-pink-400 text-white'
      case 'upper':
      case 'upper antelope':
      case '어퍼 앤텔롭':
        return 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
      case 'lower':
      case 'lower antelope':
      case '로워 앤텔롭':
        return 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white'
      case 'horseshoe bend':
      case '호스슈 벤드':
        return 'bg-gradient-to-r from-orange-400 to-red-400 text-white'
      case 'grand canyon':
      case '그랜드 캐년':
        return 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white'
      case 'standard':
      case '기본':
        return 'bg-gradient-to-r from-slate-400 to-gray-500 text-white'
      case 'premium':
      case '프리미엄':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white'
      case 'deluxe':
      case '디럭스':
        return 'bg-gradient-to-r from-red-400 to-pink-500 text-white'
      default:
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white'
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
                const originalName = (option.name as string) || (option.name_ko as string) || 'Unknown'
                // 간단한 라벨로 변환
                const simplifiedName = simplifyChoiceLabel(originalName)
                selectedChoices.push(simplifiedName)
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

  // choice 라벨을 간단하게 변환하는 함수
  const simplifyChoiceLabel = (label: string) => {
    if (!label) return label
    
    const labelLower = label.toLowerCase()
    
    // Antelope X Canyon → X Canyon
    if (labelLower.includes('antelope x canyon')) {
      return 'X Canyon'
    }
    
    // Lower Antelope Canyon → Lower
    if (labelLower.includes('lower antelope canyon')) {
      return 'Lower'
    }
    
    // Upper Antelope Canyon → Upper
    if (labelLower.includes('upper antelope canyon')) {
      return 'Upper'
    }
    
    // 다른 패턴들도 필요시 추가 가능
    return label
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

  // 입금 내역 관련 유틸리티 함수들
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '확인됨'
      case 'pending':
        return '대기중'
      case 'rejected':
        return '거부됨'
      default:
        return status
    }
  }

  const getPaymentMethodText = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'bank_transfer':
        return '계좌이체'
      case 'cash':
        return '현금'
      case 'card':
        return '카드'
      default:
        return method
    }
  }

  const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
    if (amount === null || amount === undefined) {
      return '$0'
    }
    if (currency === 'KRW') {
      return `₩${amount.toLocaleString()}`
    }
    return `$${amount.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
     <div 
       className={`p-3 rounded-lg border transition-colors ${
         isStaff 
           ? 'bg-white hover:bg-gray-50 cursor-pointer' 
           : 'bg-gray-50 cursor-not-allowed'
       }`}
       onClick={() => onEdit && isStaff && !showSimplePickupModal ? onEdit(reservation) : undefined}
     >
      {/* 메인 정보 섹션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* 국가 플래그 - 이름 왼쪽에 배치 */}
          <ReactCountryFlag
            countryCode={flagCode || 'US'}
            svg
            style={{
              width: '20px',
              height: '15px'
            }}
          />
          
          {/* 고객 이름 */}
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

        {/* 오른쪽 상단 - 채널 정보 */}
        <div className="flex items-center space-x-2">
          {/* 채널 정보 */}
          {channelInfo && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              {channelInfo.favicon && (
                <Image 
                  src={channelInfo.favicon} 
                  alt={channelInfo.name}
                  width={12}
                  height={12}
                  className="rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <span>{channelInfo.name}</span>
            </div>
          )}
          
          {/* 채널 로딩 중일 때 */}
          {loadingChannel && (
            <div className="text-xs text-gray-400">채널 로딩중...</div>
          )}
          
          {/* 잔액 로딩 중일 때 */}
          {isStaff && loadingPricing && (
            <div className="text-xs text-gray-400">잔액 로딩중...</div>
          )}
        </div>
      </div>

      {/* 픽업 정보 섹션 */}
      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center space-x-2">
           {/* 픽업 시간 수정 버튼 */}
           {isStaff && (
             <button
               onClick={(e) => {
                 e.stopPropagation()
                 setShowSimplePickupModal(true)
               }}
               className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
               title="픽업 시간 수정"
             >
               <Clock size={12} />
             </button>
           )}
           <span>{getPickupTime()}</span>
           {/* 픽업 호텔 수정 버튼 */}
           {isStaff && (
             <button
               onClick={(e) => {
                 e.stopPropagation()
                 setShowSimplePickupModal(true)
               }}
               className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
               title="픽업 호텔 수정"
             >
               <Building size={12} />
             </button>
           )}
          <span>{getPickupHotelName()}</span>
        </div>
        {/* 3번째 줄 - pickup_location과 잔액 정보, 액션 버튼들 */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-3">
            {/* 픽업 위치 */}
            <div className="text-xs text-gray-400">
              {getPickupLocation() || ''}
            </div>
            
            {/* 잔액 정보 */}
            {isStaff && reservationPricing && reservationPricing.balance_amount !== null && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">잔액:</span>
                <span className={`text-xs font-medium ${
                  reservationPricing.balance_amount > 0 
                    ? 'text-red-600' 
                    : reservationPricing.balance_amount < 0 
                      ? 'text-green-600' 
                      : 'text-gray-600'
                }`}>
                  {formatCurrency(reservationPricing.balance_amount, reservationPricing.currency)}
                </span>
              </div>
            )}
          </div>
          
          {/* 오른쪽 액션 버튼들 */}
          <div className="flex items-center space-x-1">
            {/* 입금 내역 버튼 */}
            {isStaff && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePaymentRecords()
                }}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="입금 내역 보기"
              >
                <DollarSign size={14} />
              </button>
            )}

            {/* 액션 버튼들 */}
            {showActions && isStaff && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* 상태 정보 섹션 */}
      {(showStatus || showTourInfo) && (
        <div className="mt-2 flex items-center space-x-2">
          {/* 상태 표시 */}
          {showStatus && reservation.status && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getReservationStatusColor(reservation.status)}`}>
              {reservation.status}
            </span>
          )}

          {/* 투어 정보 */}
          {showTourInfo && reservation.tour_id && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              투어 배정됨
            </span>
          )}
        </div>
      )}

      {/* 입금 내역 섹션 */}
      {showPaymentRecords && isStaff && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">입금 내역</h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowPaymentRecords(false)
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              접기
            </button>
          </div>
          
          {loadingPayments ? (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">입금 내역을 불러오는 중...</div>
            </div>
          ) : paymentRecords.length === 0 ? (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">입금 내역이 없습니다</div>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentRecords.map((record) => (
                <div key={record.id} className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(record.payment_status)}`}>
                        {getStatusText(record.payment_status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getPaymentMethodText(record.payment_method)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(record.amount, 'USD')}
                      </div>
                      {record.amount_krw && (
                        <div className="text-xs text-gray-600">
                          {formatCurrency(record.amount_krw, 'KRW')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(record.submit_on)}
                  </div>
                  {record.note && (
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {record.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
         </div>
       )}

       {/* 간단한 픽업 수정 모달 */}
       <SimplePickupEditModal
         isOpen={showSimplePickupModal}
         reservation={reservation}
         pickupHotels={pickupHotels}
         onSave={handleSavePickupInfo}
         onClose={() => setShowSimplePickupModal(false)}
         getCustomerName={getCustomerName}
       />
     </div>
   )
 }
