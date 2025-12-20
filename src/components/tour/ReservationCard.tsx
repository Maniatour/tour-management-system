import React, { useState, useEffect, useCallback } from 'react'
import { Check, X, Users, Clock, Building, DollarSign, Wallet } from 'lucide-react'
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
  balance_amount: number | string | null
  total_price?: number | string | null
  total_amount?: number | string | null
  paid_amount?: number | string | null
  currency?: string
  adult_product_price?: number | string | null
  child_product_price?: number | string | null
  infant_product_price?: number | string | null
  product_price_total?: number | string | null
  coupon_discount?: number | string | null
  additional_discount?: number | string | null
  additional_cost?: number | string | null
  commission_percent?: number | string | null
  commission_amount?: number | string | null
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
  showStatus = true,
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
  const [showSimplePickupModal, setShowSimplePickupModal] = useState(false)
  const [channelInfo, setChannelInfo] = useState<{ name: string; favicon?: string; has_not_included_price?: boolean; commission_base_price_only?: boolean } | null>(null)
  
  // 채널 정보 가져오기
  const fetchChannelInfo = useCallback(async () => {
    if (!reservation.channel_id) return
    
    try {
      // 채널 정보 직접 조회 (has_not_included_price, commission_base_price_only 포함)
      type ChannelData = {
        name?: string | null
        favicon_url?: string | null
        has_not_included_price?: boolean | null
        commission_base_price_only?: boolean | null
      }
      
      const { data: channelData, error } = await supabase
        .from('channels')
        .select('name, favicon_url, has_not_included_price, commission_base_price_only')
        .eq('id', reservation.channel_id)
        .maybeSingle()
      
      if (!error && channelData) {
        const channel = channelData as ChannelData
        setChannelInfo({
          name: channel.name || 'Unknown',
          ...(channel.favicon_url ? { favicon: channel.favicon_url } : {}),
          has_not_included_price: channel.has_not_included_price || false,
          commission_base_price_only: channel.commission_base_price_only || false
        })
      } else if (getChannelInfo) {
        // fallback: getChannelInfo 사용
        const info = await getChannelInfo(reservation.channel_id)
        setChannelInfo(info ? { ...info, has_not_included_price: false, commission_base_price_only: false } : null)
      } else {
        setChannelInfo(null)
      }
    } catch (error) {
      console.error('채널 정보 조회 오류:', error)
      // fallback: getChannelInfo 사용
      if (getChannelInfo) {
        try {
          const info = await getChannelInfo(reservation.channel_id!)
          setChannelInfo(info ? { ...info, has_not_included_price: false, commission_base_price_only: false } : null)
        } catch (fallbackError) {
          console.error('채널 정보 조회 fallback 오류:', fallbackError)
          setChannelInfo(null)
        }
      } else {
        setChannelInfo(null)
      }
    }
  }, [getChannelInfo, reservation.channel_id])

  // 예약 가격 정보 가져오기
  const fetchReservationPricing = useCallback(async () => {
    if (!isStaff) return
    
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
      if (data.pricing) {
        // balance_amount를 숫자로 변환
        const pricing = {
          ...data.pricing,
          balance_amount: typeof data.pricing.balance_amount === 'string' 
            ? parseFloat(data.pricing.balance_amount) || 0
            : (data.pricing.balance_amount || 0)
        }
        setReservationPricing(pricing)
      } else {
        setReservationPricing(null)
      }
    } catch (error) {
      console.error('예약 가격 정보 조회 오류:', error)
    }
  }, [isStaff, reservation.id])

  // 입금 내역 가져오기
  const fetchPaymentRecords = useCallback(async () => {
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
      setPaymentRecords([])
    } finally {
      setLoadingPayments(false)
    }
  }, [isStaff, reservation.id])

  // 컴포넌트 마운트 시 가격 정보, 입금 내역, 채널 정보 가져오기
  useEffect(() => {
    if (isStaff) {
      fetchReservationPricing()
      fetchPaymentRecords()
    }
    fetchChannelInfo()
  }, [isStaff, reservation.id, fetchReservationPricing, fetchPaymentRecords, fetchChannelInfo])

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

  // Balance 수령 핸들러
  const handleReceiveBalance = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!reservationPricing || !isStaff) return
    
    // balance_amount 계산
    const hasNotIncludedPrice = channelInfo?.has_not_included_price || false
    const commissionBasePriceOnly = channelInfo?.commission_base_price_only || false
    const shouldShowBalanceAmount = hasNotIncludedPrice || commissionBasePriceOnly
    
    let balanceAmount = 0
    
    if (shouldShowBalanceAmount && reservationPricing.balance_amount) {
      // 불포함 있음 채널인 경우 balance_amount 사용
      balanceAmount = typeof reservationPricing.balance_amount === 'string'
        ? parseFloat(reservationPricing.balance_amount) || 0
        : (reservationPricing.balance_amount || 0)
    } else {
      // 일반 채널인 경우 계산된 잔금 사용
      const totalPrice = reservationPricing 
        ? (typeof reservationPricing.total_price === 'string'
            ? parseFloat(reservationPricing.total_price) || 0
            : (reservationPricing.total_price || 0))
        : 0
      
      const totalPaid = paymentRecords
        .reduce((sum, record) => {
          const amount = typeof record.amount === 'string'
            ? parseFloat(record.amount) || 0
            : (record.amount || 0)
          return sum + amount
        }, 0)
      
      balanceAmount = totalPrice - totalPaid
    }
    
    if (balanceAmount <= 0) {
      alert('수령할 잔액이 없습니다.')
      return
    }
    
    // 확인 다이얼로그
    if (!confirm(`잔액 ${formatCurrency(balanceAmount, reservationPricing?.currency || 'USD')}을 현금으로 수령하시겠습니까?`)) {
      return
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      // 1. 입금 내역 생성 (현금)
      const paymentResponse = await fetch('/api/payment-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reservation_id: reservation.id,
          payment_status: 'confirmed',
          amount: balanceAmount,
          payment_method: 'cash',
          note: 'Balance 수령 (관리자)'
        })
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        throw new Error(errorData.error || '입금 내역 생성에 실패했습니다.')
      }

      // 2. reservation_pricing의 balance_amount 업데이트 (불포함 있음 채널인 경우만)
      if (shouldShowBalanceAmount) {
        // 먼저 reservation_pricing 레코드 찾기
        const { data: existingPricing, error: pricingFetchError } = await supabase
          .from('reservation_pricing')
          .select('id')
          .eq('reservation_id', reservation.id)
          .single()

        if (pricingFetchError && pricingFetchError.code !== 'PGRST116') {
          console.error('reservation_pricing 조회 오류:', pricingFetchError)
          // 에러가 발생해도 계속 진행 (레코드가 없을 수도 있음)
        }

        if (existingPricing) {
          // balance_amount를 0으로 업데이트
          const { error: updateError } = await supabase
            .from('reservation_pricing')
            .update({ 
              balance_amount: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPricing.id)

          if (updateError) {
            console.error('balance_amount 업데이트 오류:', updateError)
            // 업데이트 실패해도 입금 내역은 생성되었으므로 경고만 표시
            alert('입금 내역은 생성되었지만 잔액 업데이트에 실패했습니다. 페이지를 새로고침해주세요.')
          }
        }
      }
      // 일반 채널의 경우 balance_amount를 업데이트할 필요가 없음
      // (잔금은 total_price - totalPaid로 자동 계산되므로 입금 내역 추가 시 자동으로 조정됨)

      // 3. 입금 내역 및 가격 정보 새로고침
      await fetchPaymentRecords()
      await fetchReservationPricing()

      alert('잔액 수령이 완료되었습니다.')
    } catch (error) {
      console.error('Balance 수령 오류:', error)
      alert(error instanceof Error ? error.message : '잔액 수령 중 오류가 발생했습니다.')
    }
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

        {/* 오른쪽 상단 - 상태 뱃지 */}
        <div className="flex items-center space-x-2">
          {/* 상태 뱃지 - 첫 번째 줄 오른쪽 끝 */}
          {showStatus && reservation.status && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getReservationStatusColor(reservation.status)}`}>
              {reservation.status}
            </div>
          )}
          
        </div>
      </div>

      {/* 픽업 정보 섹션 */}
      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
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
          
          {/* 채널 정보 - 두 번째 줄 오른쪽 끝 */}
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
          </div>
        </div>
        
        {/* 금액 계산 섹션 - 별도 줄 */}
        {isStaff && (() => {
          // reservationPricing이 없으면 null 반환
          if (!reservationPricing) {
            return null
          }
          // 숫자로 변환하는 헬퍼 함수
          const toNumber = (value: number | string | null | undefined): number => {
            if (value === null || value === undefined) return 0
            if (typeof value === 'string') return parseFloat(value) || 0
            return value
          }

          const adultPrice = toNumber(reservationPricing.adult_product_price)
          const childPrice = toNumber(reservationPricing.child_product_price)
          const infantPrice = toNumber(reservationPricing.infant_product_price)
          const productPriceTotal = toNumber(reservationPricing.product_price_total)
          const couponDiscount = toNumber(reservationPricing.coupon_discount)
          const additionalDiscount = toNumber(reservationPricing.additional_discount)
          const additionalCost = toNumber(reservationPricing.additional_cost)
          const grandTotal = toNumber(reservationPricing.total_price) || 0
          const commissionPercent = toNumber(reservationPricing.commission_percent)
          const commissionAmount = toNumber(reservationPricing.commission_amount)
          
          // 총 인원수
          const totalPeople = (reservation.adults || 0) + (reservation.children || 0) + (reservation.infants || 0)
          
          // 할인/추가비용 합계
          const discountTotal = couponDiscount + additionalDiscount
          const adjustmentTotal = additionalCost - discountTotal
          
          // 커미션 계산
          let calculatedCommission = 0
          if (commissionAmount > 0) {
            calculatedCommission = commissionAmount
          } else if (commissionPercent > 0 && grandTotal > 0) {
            calculatedCommission = grandTotal * (commissionPercent / 100)
          }
          
          // Net Price 계산
          const netPrice = grandTotal > 0 ? (grandTotal - calculatedCommission) : 0
          
          // 통화
          const currency = reservationPricing.currency || 'USD'
          const currencySymbol = currency === 'KRW' ? '₩' : '$'
          
          // 계산식 구성 (한 줄 형식: $384 x 1 = $384 - $34.56 = $349.44 - $87.36 = $262.08)
          let calculationString = ''
          
          // grandTotal이 있거나 netPrice가 있으면 무조건 계산식 표시
          if (grandTotal > 0 || netPrice > 0) {
            // 1. 상품가격 x 총인원 = 소계
            let subtotal = productPriceTotal
            if (subtotal === 0 && adultPrice > 0 && totalPeople > 0) {
              subtotal = adultPrice * (reservation.adults || 0) + childPrice * (reservation.children || 0) + infantPrice * (reservation.infants || 0)
            }
            
            // subtotal이 0이면 grandTotal을 역산하여 추정
            if (subtotal === 0) {
              // 할인/추가비용을 고려하여 역산
              subtotal = grandTotal + discountTotal - additionalCost
              if (subtotal <= 0) {
                subtotal = grandTotal
              }
            }
            
            if (subtotal > 0) {
              if (totalPeople > 0 && adultPrice > 0 && totalPeople === (reservation.adults || 0) && (reservation.children || 0) === 0 && (reservation.infants || 0) === 0) {
                // 성인만 있는 경우
                calculationString = `${currencySymbol}${adultPrice.toFixed(2)} × ${totalPeople} = ${currencySymbol}${subtotal.toFixed(2)}`
              } else if (totalPeople > 0 && (adultPrice > 0 || childPrice > 0 || infantPrice > 0)) {
                // 여러 연령대가 있는 경우
                const priceParts: string[] = []
                if ((reservation.adults || 0) > 0 && adultPrice > 0) {
                  priceParts.push(`${currencySymbol}${adultPrice.toFixed(2)} × ${reservation.adults || 0}`)
                }
                if ((reservation.children || 0) > 0 && childPrice > 0) {
                  priceParts.push(`${currencySymbol}${childPrice.toFixed(2)} × ${reservation.children || 0}`)
                }
                if ((reservation.infants || 0) > 0 && infantPrice > 0) {
                  priceParts.push(`${currencySymbol}${infantPrice.toFixed(2)} × ${reservation.infants || 0}`)
                }
                if (priceParts.length > 0) {
                  calculationString = `${priceParts.join(' + ')} = ${currencySymbol}${subtotal.toFixed(2)}`
                } else {
                  calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
                }
              } else {
                // 인원 정보가 없거나 가격 정보가 없는 경우
                calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
              }
            } else {
              // subtotal이 0이면 grandTotal부터 시작
              calculationString = `${currencySymbol}${grandTotal.toFixed(2)}`
            }
            
            // 2. 소계 - 할인/추가비용 = grand total (이전 결과를 이어서)
            if (adjustmentTotal !== 0 && calculationString) {
              if (adjustmentTotal > 0) {
                // 추가비용이 있는 경우
                calculationString += ` + ${currencySymbol}${adjustmentTotal.toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
              } else {
                // 할인이 있는 경우
                calculationString += ` - ${currencySymbol}${Math.abs(adjustmentTotal).toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
              }
            } else if (calculationString && subtotal > 0 && Math.abs(subtotal - grandTotal) > 0.01) {
              calculationString += ` = ${currencySymbol}${grandTotal.toFixed(2)}`
            } else if (!calculationString) {
              calculationString = `${currencySymbol}${grandTotal.toFixed(2)}`
            }
            
            // 3. grand total - commission = Net price (이전 결과를 이어서)
            if (calculatedCommission > 0 && calculationString) {
              calculationString += ` - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
            } else if (calculationString && Math.abs(grandTotal - netPrice) > 0.01) {
              calculationString += ` = ${currencySymbol}${netPrice.toFixed(2)}`
            } else if (!calculationString) {
              calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
            }
          }
          
          // 계산식이 비어있으면 grandTotal과 commission으로 기본 계산식 생성
          if (!calculationString || calculationString.trim() === '') {
            if (grandTotal > 0) {
              if (calculatedCommission > 0) {
                calculationString = `${currencySymbol}${grandTotal.toFixed(2)} - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
              } else {
                calculationString = `${currencySymbol}${grandTotal.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
              }
            } else if (netPrice > 0) {
              calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
            }
          }
          
          // 계산식이 여전히 비어있으면 최소한 Net Price라도 표시
          if (!calculationString || calculationString.trim() === '') {
            calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
          }
          
          return (
            <div className="mt-1 text-xs text-gray-700">
              <div className="text-gray-600 break-words font-medium">
                {calculationString}
              </div>
            </div>
          )
        })()}
        
        {/* 3번째 줄 - pickup_location과 잔액 정보, 액션 버튼들 */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-3">
            {/* 픽업 위치 */}
            <div className="text-xs text-gray-400">
              {getPickupLocation() || ''}
            </div>
            
            {/* 잔액 뱃지 및 수령 버튼 - 잔금이 있을 때만 표시 */}
            {isStaff && (() => {
              // 불포함 있음 채널 확인
              const hasNotIncludedPrice = channelInfo?.has_not_included_price || false
              const commissionBasePriceOnly = channelInfo?.commission_base_price_only || false
              const shouldShowBalanceAmount = hasNotIncludedPrice || commissionBasePriceOnly
              
              // 불포함 있음 채널인 경우 balance_amount 사용
              if (shouldShowBalanceAmount && reservationPricing?.balance_amount) {
                const balanceAmount = typeof reservationPricing.balance_amount === 'string'
                  ? parseFloat(reservationPricing.balance_amount) || 0
                  : (reservationPricing.balance_amount || 0)
                
                if (balanceAmount > 0) {
                  return (
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        {formatCurrency(balanceAmount, reservationPricing?.currency || 'USD')}
                      </div>
                      <button
                        onClick={handleReceiveBalance}
                        className="px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center space-x-1"
                        title="Balance 수령"
                      >
                        <Wallet size={12} />
                        <span>수령</span>
                      </button>
                    </div>
                  )
                }
              }
              
              // 일반 채널인 경우 기존 로직 사용
              // reservation_pricing에서 total_price 가져오기
              const totalPrice = reservationPricing 
                ? (typeof reservationPricing.total_price === 'string'
                    ? parseFloat(reservationPricing.total_price) || 0
                    : (reservationPricing.total_price || 0))
                : 0
              
              // payment_records 테이블에서 입금 내역 합계 계산 (모든 상태 합산)
              const totalPaid = paymentRecords
                .reduce((sum, record) => {
                  const amount = typeof record.amount === 'string'
                    ? parseFloat(record.amount) || 0
                    : (record.amount || 0)
                  return sum + amount
                }, 0)
              
              // 잔금 계산: total_price - 입금 내역 합계
              const calculatedBalance = totalPrice - totalPaid
              
              // 잔금이 0보다 크면 표시
              if (calculatedBalance > 0) {
                return (
                  <div className="flex items-center space-x-2">
                    <div className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                      {formatCurrency(calculatedBalance, reservationPricing?.currency || 'USD')}
                    </div>
                    <button
                      onClick={handleReceiveBalance}
                      className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center space-x-1"
                      title="Balance 수령"
                    >
                      <Wallet size={12} />
                      <span>수령</span>
                    </button>
                  </div>
                )
              }
              return null
            })()}
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

      {/* 투어 정보 섹션 */}
      {showTourInfo && reservation.tour_id && (
        <div className="mt-2 flex items-center space-x-2">
          {/* 투어 정보 */}
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            투어 배정됨
          </span>
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
