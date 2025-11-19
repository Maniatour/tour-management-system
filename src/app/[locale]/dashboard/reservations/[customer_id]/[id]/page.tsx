'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Calendar, Clock, MapPin, Users, ArrowLeft, Filter, User, Phone, Mail, ExternalLink, X, Car, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Reservation {
  id: string
  customer_id: string
  product_id: string
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number
  child: number
  infant: number
  total_people: number
  status: string
  event_note: string | null
  channel_id: string | null
  channel_rn: string | null
  created_at: string
  products?: {
    name: string
    customer_name_ko: string | null
    customer_name_en: string | null
    duration: number | null
    base_price: number | null
    choices?: {
      required?: Array<{
        id: string
        name: string
        name_ko: string
        options?: Array<{
          id: string
          name: string
          name_ko: string
        }>
      }>
    }
  }
  pricing?: {
    adult_product_price: number
    child_product_price: number
    infant_product_price: number
    product_price_total: number
    required_options: Record<string, unknown>
    required_option_total: number
    subtotal: number
    coupon_code: string | null
    coupon_discount: number
    additional_discount: number
    additional_cost: number
    card_fee: number
    tax: number
    prepayment_cost: number
    prepayment_tip: number
    selected_options: Record<string, unknown>
    option_total: number
    private_tour_additional_cost: number
    total_price: number
    deposit_amount: number
    balance_amount: number
    commission_percent: number
    commission_amount: number
    choices: Record<string, unknown>
    choices_total: number
  }
  options?: Array<{
    id: string
    option_id: string
    ea: number
    price: number
    total_price: number
    status: string
    note?: string
  }>
  payments?: Array<{
    id: string
    payment_status: string
    amount: number
    payment_method: string
    note?: string
    submit_on: string
    submit_by?: string
    confirmed_on?: string
    confirmed_by?: string
    amount_krw?: number
  }>
  reservationChoices?: Array<{
    id: string
    choice_id: string
    option_id: string
    quantity: number
    total_price: number
    choice?: {
      id: string
      name_ko: string
      name_en: string
    }
    option?: {
      id: string
      name_ko: string
      name_en: string
    }
  }>
  multilingualDetails?: {
    description?: string
    slogan1?: string
    slogan2?: string
    slogan3?: string
    included?: string
    not_included?: string
    pickup_drop_info?: string
    luggage_info?: string
    tour_operation_info?: string
    preparation_info?: string
    small_group_info?: string
    notice_info?: string
    private_tour_info?: string
    cancellation_policy?: string
    chat_announcement?: string
  } | null
  pickupHotelInfo?: {
    hotel: string
    pick_up_location: string
    address?: string
  } | null
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

interface ProductDetails {
  description?: string
  highlights?: string
  included?: string
  not_included?: string
  meeting_point?: string
  cancellation_policy?: string
}

interface PickupSchedule {
  pickup_hotel?: string | null
  pickup_time?: string | null
  tour_date?: string | null
  tour_time?: string | null
  pickup_hotels?: {
    hotel?: string
    pick_up_location?: string
    address?: string
    description_ko?: string
    link?: string
    media?: string
    youtube_link?: string
  } | null
  allPickups?: PickupInfo[]
}

interface PickupInfo {
  reservation_id: string
  pickup_time: string
  pickup_hotel: string
  hotel_name: string
  pick_up_location: string
  address?: string
  link?: string
  customer_name: string
  total_people: number
  tour_date?: string
}

interface TourDetails {
  id?: string
  tour_guide_id?: string
  assistant_id?: string
  tour_car_id?: string
  tour_guide?: {
    name_ko?: string
    name_en?: string
    phone?: string
    email?: string
    languages?: string[] | string
  }
  assistant?: {
    name_ko?: string
    name_en?: string
    phone?: string
    email?: string
  }
  vehicle?: {
    vehicle_type?: string
    color?: string
    vehicle_type_info?: {
      name?: string
      brand?: string
      model?: string
      passenger_capacity?: number
      description?: string
    }
    vehicle_type_photos?: {
      photo_url?: string
      photo_name?: string
      description?: string
      is_primary?: boolean
    }[]
  }
}

interface ReservationDetails {
  productDetails?: ProductDetails | null
  pickupSchedule?: PickupSchedule | null
  tourDetails?: TourDetails | null
  productSchedules?: ProductSchedule[] | null
}

interface ProductSchedule {
  id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  show_to_customers: boolean
  order_index: number | null
}

interface SupabaseReservation {
  id: string
  customer_id: string
  product_id: string
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number
  child: number
  infant: number
  total_people: number
  status: string
  event_note: string | null
  created_at: string
  tour_id?: string
  channel_id?: string
  channel_rn?: string
}

interface SupabaseCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

interface SupabaseVehicleData {
  vehicle_type: string
  capacity: number
  color?: string
}

interface SupabaseVehicleTypeData {
  id: string
  name: string
  brand: string
  model: string
  passenger_capacity: number
  description?: string
}

interface SupabaseTourDetails {
  id?: string
  tour_guide_id?: string
  assistant_id?: string
  tour_car_id?: string
}

export default function CustomerReservations() {
  const { user, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const customerIdFromUrl = params.customer_id as string
  const reservationIdFromUrl = params.id as string
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservationDetails, setReservationDetails] = useState<Record<string, ReservationDetails>>({})
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [channels, setChannels] = useState<Array<{id: string, name: string, favicon_url?: string}>>([])

  // 프린트 함수
  const handlePrint = (reservation: Reservation) => {
    try {
      console.log('프린트 시작:', reservation.id)
      
      // 프린트할 예약 ID를 저장
      const printElement = document.getElementById(`reservation-${reservation.id}`)
      console.log('프린트 요소 찾음:', printElement)
      
      if (!printElement) {
        console.error('프린트 요소를 찾을 수 없습니다:', `reservation-${reservation.id}`)
        return
      }

      // 간단한 프린트 스타일 적용
      const printStyle = document.createElement('style')
      printStyle.id = `print-style-${reservation.id}`
      printStyle.textContent = `
        @media print {
          body * {
            visibility: hidden;
          }
          #reservation-${reservation.id},
          #reservation-${reservation.id} * {
            visibility: visible;
          }
          #reservation-${reservation.id} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
            box-shadow: none;
            border: none;
            margin: 0;
          }
          #reservation-${reservation.id} .hidden.print\\:block {
            display: none !important;
          }
          /* 모든 이미지 강제 표시 */
          #reservation-${reservation.id} img {
            visibility: visible !important;
            display: block !important;
            max-width: 100% !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
          }
          /* 이미지 컨테이너 강제 표시 */
          #reservation-${reservation.id} .aspect-\\[4\\/3\\] {
            display: block !important;
            visibility: visible !important;
            min-height: 120px !important;
            position: relative !important;
            background-color: #f3f4f6 !important;
          }
          /* 일반 img 태그 스타일 */
          #reservation-${reservation.id} .aspect-\\[4\\/3\\] img {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 8px !important;
            border: 1px solid #e5e7eb !important;
          }
          #reservation-${reservation.id} .md\\:grid-cols-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          
          /* 프린트용 그리드 순서 조정 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(1) { order: 1; } /* 이름 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(2) { order: 2; } /* 이메일 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(3) { order: 3; } /* 전화 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(4) { order: 4; } /* 총인원 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(5) { order: 5; } /* 투어 날짜 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(6) { order: 6; } /* 픽업 시간 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(7) { order: 7; } /* 픽업 호텔 */
          #reservation-${reservation.id} .grid.print\\:grid-cols-2 > div:nth-child(8) { order: 8; } /* 채널 */
        }
      `
      
      // 기존 스타일 제거
      const existingStyle = document.getElementById(`print-style-${reservation.id}`)
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
      
      document.head.appendChild(printStyle)
      console.log('프린트 스타일 적용됨')
      
      // Next.js Image 컴포넌트를 일반 img 태그로 대체
      const nextImages = printElement.querySelectorAll('img')
      console.log('찾은 이미지 개수:', nextImages.length)
      
      nextImages.forEach((nextImg, index) => {
        console.log(`이미지 ${index + 1}:`, nextImg.src, nextImg.complete)
        
        // Next.js Image 컴포넌트의 부모 컨테이너 찾기
        const container = nextImg.closest('.aspect-\\[4\\/3\\]')
        if (container && nextImg.src) {
          // 일반 img 태그로 대체
          const newImg = document.createElement('img')
          newImg.src = nextImg.src
          newImg.alt = nextImg.alt || `Hotel Media ${index + 1}`
          newImg.style.width = '100%'
          newImg.style.height = '100%'
          newImg.style.objectFit = 'cover'
          newImg.style.borderRadius = '8px'
          newImg.style.border = '1px solid #e5e7eb'
          
          // 기존 Next.js Image 제거하고 새 이미지 삽입
          nextImg.style.display = 'none'
          container.appendChild(newImg)
          
          console.log(`이미지 ${index + 1} 대체 완료:`, newImg.src)
        }
      })
      
      // 프린트 실행
      setTimeout(() => {
        window.print()
        console.log('프린트 실행됨')
        
        // 프린트 후 스타일 제거
        setTimeout(() => {
          const styleToRemove = document.getElementById(`print-style-${reservation.id}`)
          if (styleToRemove) {
            document.head.removeChild(styleToRemove)
            console.log('프린트 스타일 제거됨')
          }
        }, 1000)
      }, 200)
      
    } catch (error) {
      console.error('프린트 중 오류 발생:', error)
      alert('프린트 중 오류가 발생했습니다.')
    }
  }

  // channels 데이터 로딩
  const loadChannels = useCallback(async () => {
    try {
      const { data: channelsData, error } = await supabase
        .from('channels')
        .select('id, name, favicon_url')
        .eq('status', 'active')
        .order('name')

      if (error) {
        console.error('Channels 로딩 오류:', error)
        return
      }

      setChannels(channelsData || [])
    } catch (error) {
      console.error('Channels 로딩 중 예외:', error)
    }
  }, [])

  // 픽업 날짜 계산 함수
  const calculatePickupDate = (pickupTime: string, tourDate: string) => {
    if (!pickupTime || !tourDate) return tourDate
    
    const time = pickupTime.split(':')[0]
    const hour = parseInt(time, 10)
    
    // 오후 9시(21시) 이후이면 투어 날짜에서 1일 빼기
    if (hour >= 21) {
      // 다양한 날짜 형식 처리
      let tourDateObj: Date
      
      if (tourDate.includes(',')) {
        // "Thursday, October 16, 2025" 형식
        tourDateObj = new Date(tourDate)
      } else if (tourDate.includes('-')) {
        // "2025-10-16" 형식
        tourDateObj = new Date(tourDate)
      } else {
        // 기타 형식
        tourDateObj = new Date(tourDate)
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(tourDateObj.getTime())) {
        console.warn('Invalid tour date:', tourDate)
        return tourDate
      }
      
      tourDateObj.setDate(tourDateObj.getDate() - 1)
      return tourDateObj.toISOString().split('T')[0]
    }
    
    return tourDate
  }

  // 시간 포맷팅 함수 (AM/PM 형식)
  const formatTimeToAMPM = (timeString: string) => {
    if (!timeString) return timeString
    
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours, 10)
    const minute = parseInt(minutes, 10)
    
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }

  // 시간 차이 계산 함수 (duration)
  const calculateDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return null
    
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    
    // 종료 시간이 시작 시간보다 작으면 다음날로 간주
    if (end < start) {
      end.setDate(end.getDate() + 1)
    }
    
    const diffMs = end.getTime() - start.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return diffMinutes > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffHours}h`
    } else {
      return `${diffMinutes}m`
    }
  }

  // 인증 확인 (시뮬레이션 상태 우선 확인)
  useEffect(() => {
    console.log('Reservations: Auth check effect triggered', { 
      isSimulating, 
      hasSimulatedUser: !!simulatedUser, 
      hasUser: !!user,
      simulatedUserEmail: simulatedUser?.email 
    })
    
    // 시뮬레이션 중인 경우 인증 체크 완전히 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('Reservations: Simulation active, skipping authentication check')
      return
    }
    
    // 시뮬레이션 중이지만 simulatedUser가 없는 경우 잠시 기다림
    if (isSimulating && !simulatedUser) {
      console.log('Reservations: Simulation in progress but no simulatedUser yet, waiting...')
      return
    }
    
    // 고객 페이지는 로그인하지 않은 사용자도 접근 가능하므로 인증 체크 제거
    console.log('Reservations: Customer page allows unauthenticated access')
  }, [user, isSimulating, simulatedUser, router, locale])

  // 시뮬레이션 상태 변화 감지 (언어 전환 시 시뮬레이션 상태 복원 확인)
  useEffect(() => {
    if (isSimulating && simulatedUser) {
      console.log('Reservations: Simulation state confirmed:', {
        simulatedUser: simulatedUser.email,
        role: simulatedUser.role,
        isSimulating
      })
    }
  }, [isSimulating, simulatedUser])

  // channels 데이터 로딩
  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // 예약 정보 로드
  const loadReservations = useCallback(async () => {
    if (!authUser?.email) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 먼저 고객 정보 조회
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', authUser.email)
        .single()

      if (customerError) {
        console.error(t('customerInfoError'), {
          error: customerError,
          message: customerError?.message || 'Unknown error',
          code: customerError?.code || 'No code',
          details: customerError?.details || 'No details',
          hint: customerError?.hint || 'No hint',
          email: authUser.email
        })
        // 고객 정보가 없는 경우 (PGRST116: No rows found) 또는 권한 문제 (406: Not Acceptable)
        if (customerError.code === 'PGRST116' || customerError.code === 'PGRST301' || customerError.message?.includes('406')) {
          console.log('Customer not found or access denied, user needs to register profile')
          setCustomer(null)
          setReservations([])
          setLoading(false)
          return
        }
        
        // 권한 오류나 다른 오류의 경우
        console.warn('Customer data access error, treating as no customer')
        setCustomer(null)
        setReservations([])
        setLoading(false)
        return
      }

      if (customerData) {
        setCustomer(customerData)
        
        // 고객의 예약 정보 조회 (JOIN 없이 먼저 예약만 조회)
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('*')
          .eq('customer_id', (customerData as SupabaseCustomer).id)
          .order('tour_date', { ascending: false })

        if (reservationsError) {
          console.error(t('reservationInfoError'), {
            error: reservationsError,
            message: reservationsError?.message || 'Unknown error',
            code: reservationsError?.code || 'No code',
            details: reservationsError?.details || 'No details',
            customer_id: (customerData as SupabaseCustomer).id
          })
          setReservations([])
        } else if (reservationsData && reservationsData.length > 0) {
          // 각 예약에 대해 상품 정보를 별도로 조회
          const reservationsWithProducts = await Promise.all(
            reservationsData.map(async (reservation: SupabaseReservation) => {
              try {
                const { data: productData, error: productError } = await supabase
                  .from('products')
                  .select('name, customer_name_ko, customer_name_en, duration, base_price, choices')
                  .eq('id', reservation.product_id)
                  .single()

                if (productError) {
                  console.warn(t('productInfoError'), {
                    error: productError,
                    message: productError?.message || 'Unknown error',
                    code: productError?.code || 'No code',
                    product_id: reservation.product_id,
                    reservation_id: reservation.id
                  })
                }

                // 다국어 상품 세부 정보도 함께 가져오기 (채널별 우선, 없으면 전체 공통)
                let multilingualDetails = null
                try {
                  console.log('다국어 상품 세부 정보 조회 시작:', {
                    product_id: reservation.product_id,
                    language_code: locale,
                    channel_id: reservation.channel_id
                  })
                  
                  // 먼저 채널별 정보를 찾아보기 (채널 ID가 있는 경우에만)
                  let detailsData: Record<string, unknown> | null = null
                  if (reservation.channel_id) {
                    console.log('채널별 정보 조회 시도:', reservation.channel_id)
                    const result = await supabase
                      .from('product_details_multilingual')
                      .select('*')
                      .eq('product_id', reservation.product_id)
                      .eq('language_code', locale)
                      .eq('channel_id', reservation.channel_id)
                      .maybeSingle() // single() 대신 maybeSingle() 사용
                    
                    console.log('채널별 정보 조회 결과:', result)
                    detailsData = result.data
                  }
                  
                  // 채널별 정보가 없으면 전체 공통 정보 가져오기
                  if (!detailsData) {
                    console.log('전체 공통 정보 조회 시도')
                    const result = await supabase
                      .from('product_details_multilingual')
                      .select('*')
                      .eq('product_id', reservation.product_id)
                      .eq('language_code', locale)
                      .is('channel_id', null)
                      .maybeSingle() // single() 대신 maybeSingle() 사용
                    
                    console.log('전체 공통 정보 조회 결과:', result)
                    detailsData = result.data
                  }
                  
                  multilingualDetails = detailsData
                  console.log('최종 multilingualDetails:', multilingualDetails)
                } catch (error) {
                  console.warn('다국어 상품 세부 정보 조회 실패:', error)
                }

                // 픽업 호텔 정보 가져오기
                let pickupHotelInfo = null
                if (reservation.pickup_hotel) {
                  try {
                    const { data: hotelData } = await supabase
                      .from('pickup_hotels')
                      .select('hotel, pick_up_location, address, media, link, youtube_link')
                      .eq('id', reservation.pickup_hotel)
                      .single()
                    
                    pickupHotelInfo = hotelData
                  } catch (error) {
                    console.warn('픽업 호텔 정보 조회 실패:', error)
                  }
                }

                // 가격 정보 가져오기
                let pricingInfo = null
                try {
                  console.log('가격 정보 조회 시작:', { reservationId: reservation.id, reservationIdType: typeof reservation.id })
                  
                  // 디버깅: reservation_pricing 테이블에 어떤 데이터가 있는지 확인
                  console.log('reservation_pricing 테이블 조회 시도 중...')
                  const { data: allPricingData, error: allPricingError } = await supabase
                    .from('reservation_pricing')
                    .select('reservation_id, total_price')
                    .limit(10)
                  
                  if (allPricingError) {
                    console.warn('reservation_pricing 테이블 전체 조회 오류:', allPricingError)
                    console.warn('오류 상세:', {
                      code: allPricingError.code,
                      message: allPricingError.message,
                      details: allPricingError.details,
                      hint: allPricingError.hint
                    })
                  } else {
                    console.log('reservation_pricing 테이블 샘플 데이터:', allPricingData)
                    console.log('reservation_pricing 테이블 데이터 개수:', allPricingData?.length || 0)
                  }
                  
                  // 특정 reservation_id로 검색해보기
                  console.log('특정 reservation_id 검색 시도:', reservation.id.toString())
                  const { data: specificPricingData, error: specificPricingError } = await supabase
                    .from('reservation_pricing')
                    .select('*')
                    .eq('reservation_id', reservation.id.toString())
                  
                  if (specificPricingError) {
                    console.warn('특정 reservation_id 검색 오류:', specificPricingError)
                  } else {
                    console.log('특정 reservation_id 검색 결과:', specificPricingData)
                  }
                  
                  const { data: pricingData, error: pricingError } = await supabase
                    .from('reservation_pricing')
                    .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
                    .eq('reservation_id', reservation.id.toString())
                    .single()
                  
                  if (pricingError) {
                    console.warn('가격 정보 조회 오류:', pricingError)
                    // reservation_id가 TEXT 타입이므로 문자열로 변환해서 다시 시도
                    const { data: retryData, error: retryError } = await supabase
                      .from('reservation_pricing')
                      .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
                      .eq('reservation_id', String(reservation.id))
                      .single()
                    
                    if (retryError) {
                      console.warn('재시도 가격 정보 조회 오류:', retryError)
                    } else {
                      pricingInfo = retryData
                      console.log('재시도로 가격 정보 로드됨:', retryData)
                    }
                  } else {
                    pricingInfo = pricingData
                    console.log('가격 정보 로드됨:', pricingData)
                  }
                } catch (error) {
                  console.warn('가격 정보 조회 실패:', error)
                }

                // 옵션 정보 가져오기
                let optionsInfo = null
                try {
                  console.log('옵션 정보 조회 시작:', { reservationId: reservation.id })
                  
                  const { data: optionsData, error: optionsError } = await supabase
                    .from('reservation_options')
                    .select('id, option_id, ea, price, total_price, status, note')
                    .eq('reservation_id', reservation.id.toString())
                    .eq('status', 'active')
                  
                  if (optionsError) {
                    console.warn('옵션 정보 조회 오류:', optionsError)
                    // 재시도
                    const { data: retryData, error: retryError } = await supabase
                      .from('reservation_options')
                      .select('id, option_id, ea, price, total_price, status, note')
                      .eq('reservation_id', String(reservation.id))
                      .eq('status', 'active')
                    
                    if (retryError) {
                      console.warn('재시도 옵션 정보 조회 오류:', retryError)
                    } else {
                      optionsInfo = retryData
                      console.log('재시도로 옵션 정보 로드됨:', retryData)
                    }
                  } else {
                    optionsInfo = optionsData
                    console.log('옵션 정보 로드됨:', optionsData)
                  }
                } catch (error) {
                  console.warn('옵션 정보 조회 실패:', error)
                }

                 // 결제 정보 가져오기
                 let paymentsInfo = null
                 try {
                   console.log('결제 정보 조회 시작:', { reservationId: reservation.id })
                   
                   const { data: paymentsData, error: paymentsError } = await supabase
                     .from('payment_records')
                     .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
                     .eq('reservation_id', reservation.id.toString())
                     .order('submit_on', { ascending: false })
                   
                   if (paymentsError) {
                     console.warn('결제 정보 조회 오류:', paymentsError)
                     // 재시도
                     const { data: retryData, error: retryError } = await supabase
                       .from('payment_records')
                       .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
                       .eq('reservation_id', String(reservation.id))
                       .order('submit_on', { ascending: false })
                     
                     if (retryError) {
                       console.warn('재시도 결제 정보 조회 오류:', retryError)
                     } else {
                       paymentsInfo = retryData
                       console.log('재시도로 결제 정보 로드됨:', retryData)
                     }
                   } else {
                     paymentsInfo = paymentsData
                     console.log('결제 정보 로드됨:', paymentsData)
                   }
                 } catch (error) {
                   console.warn('결제 정보 조회 실패:', error)
                 }

                 // 예약 선택 옵션 정보 가져오기
                 let reservationChoicesInfo = null
                 try {
                   console.log('예약 선택 옵션 조회 시작:', { reservationId: reservation.id })
                   
                   const { data: choicesData, error: choicesError } = await supabase
                     .from('reservation_choices')
                     .select('id, choice_id, option_id, quantity, total_price')
                     .eq('reservation_id', reservation.id.toString())
                   
                   if (choicesError) {
                     console.warn('예약 선택 옵션 조회 오류:', choicesError)
                     // 재시도
                     const { data: retryData, error: retryError } = await supabase
                       .from('reservation_choices')
                       .select('id, choice_id, option_id, quantity, total_price')
                       .eq('reservation_id', String(reservation.id))
                     
                     if (retryError) {
                       console.warn('재시도 예약 선택 옵션 조회 오류:', retryError)
                     } else {
                       reservationChoicesInfo = retryData
                       console.log('재시도로 예약 선택 옵션 로드됨:', retryData)
                     }
                   } else {
                     reservationChoicesInfo = choicesData
                     console.log('예약 선택 옵션 로드됨:', choicesData)
                   }
                   
                   // 새로운 테이블에서 choice와 option 정보 가져와서 매핑
                   if (reservationChoicesInfo && reservationChoicesInfo.length > 0) {
                     try {
                       // reservation_choices에서 choice_id와 option_id를 가져와서 새로운 테이블에서 정보 조회
                       const choiceIds = [...new Set(reservationChoicesInfo.map((c: { choice_id: string }) => c.choice_id))]
                       const optionIds = [...new Set(reservationChoicesInfo.map((c: { option_id: string }) => c.option_id))]
                       
                       // product_choices 테이블에서 choice 정보 조회
                       const { data: choicesData, error: choicesError } = await supabase
                         .from('product_choices')
                         .select('id, choice_group, choice_group_ko')
                         .in('id', choiceIds)
                       
                       // choice_options 테이블에서 option 정보 조회
                       const { data: optionsData, error: optionsError } = await supabase
                         .from('choice_options')
                         .select('id, option_key, option_name, option_name_ko')
                         .in('id', optionIds)
                       
                       if (!choicesError && !optionsError && choicesData && optionsData) {
                         // choice와 option 정보를 매핑
                         reservationChoicesInfo = reservationChoicesInfo.map((choice: {
                           id: string
                           choice_id: string
                           option_id: string
                           quantity: number
                           total_price: number
                         }) => {
                           const choiceInfo = choicesData.find((c: { id: string; choice_group: string; choice_group_ko: string }) => c.id === choice.choice_id) as { id: string; choice_group: string; choice_group_ko: string } | undefined
                           const optionInfo = optionsData.find((o: { id: string; option_name: string; option_name_ko: string }) => o.id === choice.option_id) as { id: string; option_name: string; option_name_ko: string } | undefined
                           
                          return {
                            ...choice,
                            choice: choiceInfo ? {
                              id: choiceInfo.id,
                              name_ko: choiceInfo.choice_group_ko,
                              name_en: choiceInfo.choice_group
                            } : null,
                            option: optionInfo ? {
                              id: optionInfo.id,
                              name_ko: optionInfo.option_name_ko,
                              name_en: optionInfo.option_name
                            } : null
                          }
                         })
                       }
                     } catch (error) {
                       console.warn('새로운 테이블에서 초이스 정보 조회 실패:', error)
                     }
                   }
                 } catch (error) {
                   console.warn('예약 선택 옵션 조회 실패:', error)
                 }

                return {
                  ...reservation,
                  products: productData || { 
                    name: t('noProductName'), 
                    customer_name_ko: null,
                    customer_name_en: null,
                    duration: null, 
                    base_price: null
                  },
                  multilingualDetails,
                  pickupHotelInfo,
                  pricing: pricingInfo,
                  options: optionsInfo,
                  payments: paymentsInfo,
                  reservationChoices: reservationChoicesInfo
                } as unknown as Reservation
              } catch (error) {
                console.error('상품 정보 조회 중 예외:', error)
                return {
                  ...reservation,
                  products: { 
                    name: t('noProductName'), 
                    customer_name_ko: null,
                    customer_name_en: null,
                    duration: null, 
                    base_price: null
                  },
                  multilingualDetails: null,
                  pickupHotelInfo: null,
                  pricing: null,
                  options: null,
                  payments: null
                } as unknown as Reservation
              }
            })
          )
          setReservations(reservationsWithProducts)
        } else {
          setReservations([])
        }
      } else {
        setCustomer(null)
        setReservations([])
      }
    } catch (error) {
      console.error(t('dataLoadError'), error)
      setCustomer(null)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [authUser?.email, locale, t])

  // URL의 customer_id로 고객 예약 정보 로드 (시뮬레이션 무시)
  const loadCustomerReservationsById = useCallback(async (customerId: string) => {
    if (!customerId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 고객 정보 조회
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) {
        console.error('고객 정보 조회 오류:', customerError)
        setCustomer(null)
        setReservations([])
        setLoading(false)
        return
      }

      if (!customerData) {
        setCustomer(null)
        setReservations([])
        setLoading(false)
        return
      }

      setCustomer(customerData as Customer)
      
      // 고객의 예약 정보 조회
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('customer_id', customerId)
        .order('tour_date', { ascending: false })

      if (reservationsError) {
        console.error('예약 정보 조회 오류:', reservationsError)
        setReservations([])
        setLoading(false)
        return
      }

      if (reservationsData && reservationsData.length > 0) {
        // 각 예약에 대해 상품 정보를 별도로 조회 (loadReservations와 동일한 로직)
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation: SupabaseReservation) => {
            try {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name, customer_name_ko, customer_name_en, duration, base_price, choices')
                .eq('id', reservation.product_id)
                .single()

              if (productError) {
                console.warn('상품 정보 조회 오류:', productError)
              }

              // 다국어 상품 세부 정보
              let multilingualDetails = null
              try {
                let detailsData: Record<string, unknown> | null = null
                if (reservation.channel_id) {
                  const result = await supabase
                    .from('product_details_multilingual')
                    .select('*')
                    .eq('product_id', reservation.product_id)
                    .eq('language_code', locale)
                    .eq('channel_id', reservation.channel_id)
                    .maybeSingle()
                  detailsData = result.data
                }
                
                if (!detailsData) {
                  const result = await supabase
                    .from('product_details_multilingual')
                    .select('*')
                    .eq('product_id', reservation.product_id)
                    .eq('language_code', locale)
                    .is('channel_id', null)
                    .maybeSingle()
                  detailsData = result.data
                }
                
                multilingualDetails = detailsData
              } catch (error) {
                console.warn('다국어 상품 세부 정보 조회 실패:', error)
              }

              // 픽업 호텔 정보
              let pickupHotelInfo = null
              if (reservation.pickup_hotel) {
                try {
                  const { data: hotelData } = await supabase
                    .from('pickup_hotels')
                    .select('hotel, pick_up_location, address, media, link, youtube_link')
                    .eq('id', reservation.pickup_hotel)
                    .single()
                  pickupHotelInfo = hotelData
                } catch (error) {
                  console.warn('픽업 호텔 정보 조회 실패:', error)
                }
              }

              // 가격 정보
              let pricingInfo = null
              try {
                const { data: pricingData, error: pricingError } = await supabase
                  .from('reservation_pricing')
                  .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
                  .eq('reservation_id', reservation.id.toString())
                  .single()
                
                if (!pricingError) {
                  pricingInfo = pricingData
                }
              } catch (error) {
                console.warn('가격 정보 조회 실패:', error)
              }

              // 옵션 정보
              let optionsInfo = null
              try {
                const { data: optionsData } = await supabase
                  .from('reservation_options')
                  .select('id, option_id, ea, price, total_price, status, note')
                  .eq('reservation_id', reservation.id.toString())
                  .eq('status', 'active')
                optionsInfo = optionsData
              } catch (error) {
                console.warn('옵션 정보 조회 실패:', error)
              }

              // 결제 정보
              let paymentsInfo = null
              try {
                const { data: paymentsData } = await supabase
                  .from('payment_records')
                  .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
                  .eq('reservation_id', reservation.id.toString())
                  .order('submit_on', { ascending: false })
                paymentsInfo = paymentsData
              } catch (error) {
                console.warn('결제 정보 조회 실패:', error)
              }

              // 예약 선택 옵션 정보
              let reservationChoicesInfo = null
              try {
                const { data: choicesData } = await supabase
                  .from('reservation_choices')
                  .select('id, choice_id, option_id, quantity, total_price')
                  .eq('reservation_id', reservation.id.toString())
                
                reservationChoicesInfo = choicesData
                
                // choice와 option 정보 매핑
                if (reservationChoicesInfo && reservationChoicesInfo.length > 0) {
                  try {
                    const choiceIds = [...new Set(reservationChoicesInfo.map((c: { choice_id: string }) => c.choice_id))]
                    const optionIds = [...new Set(reservationChoicesInfo.map((c: { option_id: string }) => c.option_id))]
                    
                    const { data: choicesData2 } = await supabase
                      .from('product_choices')
                      .select('id, choice_group, choice_group_ko')
                      .in('id', choiceIds)
                    
                    const { data: optionsData2 } = await supabase
                      .from('choice_options')
                      .select('id, option_key, option_name, option_name_ko')
                      .in('id', optionIds)
                    
                    if (choicesData2 && optionsData2) {
                      reservationChoicesInfo = reservationChoicesInfo.map((choice: {
                        id: string
                        choice_id: string
                        option_id: string
                        quantity: number
                        total_price: number
                      }) => {
                        const choiceInfo = choicesData2.find((c: { id: string }) => c.id === choice.choice_id)
                        const optionInfo = optionsData2.find((o: { id: string }) => o.id === choice.option_id)
                        
                        return {
                          ...choice,
                          choice: choiceInfo ? {
                            id: choiceInfo.id,
                            name_ko: choiceInfo.choice_group_ko,
                            name_en: choiceInfo.choice_group
                          } : null,
                          option: optionInfo ? {
                            id: optionInfo.id,
                            name_ko: optionInfo.option_name_ko,
                            name_en: optionInfo.option_name
                          } : null
                        }
                      })
                    }
                  } catch (error) {
                    console.warn('초이스 정보 매핑 실패:', error)
                  }
                }
              } catch (error) {
                console.warn('예약 선택 옵션 조회 실패:', error)
              }

              return {
                ...reservation,
                products: productData || { 
                  name: t('noProductName'), 
                  customer_name_ko: null,
                  customer_name_en: null,
                  duration: null, 
                  base_price: null
                },
                multilingualDetails,
                pickupHotelInfo,
                pricing: pricingInfo,
                options: optionsInfo,
                payments: paymentsInfo,
                reservationChoices: reservationChoicesInfo
              } as unknown as Reservation
            } catch (error) {
              console.error('상품 정보 조회 중 예외:', error)
              return {
                ...reservation,
                products: { 
                  name: t('noProductName'), 
                  customer_name_ko: null,
                  customer_name_en: null,
                  duration: null, 
                  base_price: null
                },
                multilingualDetails: null,
                pickupHotelInfo: null,
                pricing: null,
                options: null,
                payments: null,
                reservationChoices: null
              } as unknown as Reservation
            }
          })
        )
        setReservations(reservationsWithProducts)
      } else {
        setReservations([])
      }
    } catch (error) {
      console.error('고객 예약 정보 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [locale, t])

  // 시뮬레이션된 사용자의 예약 정보 로드 (이메일 기반)
  const loadSimulatedReservationsByEmail = useCallback(async (email: string) => {
    if (!email) {
      console.error('이메일이 없습니다.')
      setReservations([])
      setLoading(false)
      return
    }

    try {
      // 시뮬레이션 모드에서는 실제 고객 데이터가 없어도 시뮬레이션된 사용자 정보를 표시
      console.log('시뮬레이션 모드: 실제 고객 데이터 조회 시도 중...', email)
      
      // 먼저 이메일로 고객 정보 조회 시도
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .single()

      if (customerError) {
        console.log('시뮬레이션된 사용자의 실제 고객 정보가 없습니다 (정상적인 상황):', customerError.code)
        // 시뮬레이션 모드에서는 실제 데이터가 없어도 빈 예약 목록으로 표시
        setReservations([])
        setLoading(false)
        return
      }

      if (!customerData) {
        console.log('시뮬레이션된 사용자의 고객 정보가 없습니다.')
        setReservations([])
        setLoading(false)
        return
      }

      // 실제 고객 데이터가 있는 경우 예약 정보 조회
      console.log('시뮬레이션된 사용자의 실제 고객 데이터 발견:', (customerData as SupabaseCustomer).id)
      
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('customer_id', (customerData as SupabaseCustomer).id)
        .order('tour_date', { ascending: false })

      if (reservationsError) {
        console.error(t('simulationReservationError'), reservationsError)
        setReservations([])
        setLoading(false)
        return
      }

      if (reservationsData && reservationsData.length > 0) {
        console.log('시뮬레이션 모드: 예약 데이터 발견:', reservationsData.length, '개')
        console.log('시뮬레이션 모드: 예약 ID들:', reservationsData.map((r: SupabaseReservation) => r.id))
        console.log('시뮬레이션 모드: 첫 번째 예약의 채널 정보:', {
          id: (reservationsData[0] as SupabaseReservation).id,
          channel_id: (reservationsData[0] as SupabaseReservation).channel_id,
          channel_rn: (reservationsData[0] as SupabaseReservation).channel_rn,
          전체데이터: reservationsData[0]
        })
        
        // 각 예약에 대해 상품 정보를 별도로 조회
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation: SupabaseReservation) => {
            console.log('시뮬레이션 모드: 예약 처리 중:', reservation.id)
            try {
              console.log('시뮬레이션 모드: 상품 정보 조회 시작, product_id:', reservation.product_id)
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name, customer_name_ko, customer_name_en, duration, base_price, choices')
                .eq('id', reservation.product_id)
                .single()

              if (productError) {
                console.warn('시뮬레이션 모드: 상품 정보 조회 오류:', {
                  error: productError,
                  message: productError?.message || 'Unknown error',
                  code: productError?.code || 'No code',
                  product_id: reservation.product_id,
                  reservation_id: reservation.id
                })
              } else {
                console.log('시뮬레이션 모드: 상품 정보 조회 성공:', productData)
              }

              // 다국어 상품 세부 정보도 함께 가져오기 (채널별 우선, 없으면 전체 공통)
              let multilingualDetails = null
              try {
                console.log('시뮬레이션 모드: 다국어 상품 세부 정보 조회 시작:', {
                  product_id: reservation.product_id,
                  language_code: locale,
                  channel_id: reservation.channel_id
                })
                
                // 먼저 채널별 정보를 찾아보기 (채널 ID가 있는 경우에만)
                let detailsData: Record<string, unknown> | null = null
                if (reservation.channel_id) {
                  console.log('시뮬레이션 모드: 채널별 정보 조회 시도:', reservation.channel_id)
                  const result = await supabase
                    .from('product_details_multilingual')
                    .select('*')
                    .eq('product_id', reservation.product_id)
                    .eq('language_code', locale)
                    .eq('channel_id', reservation.channel_id)
                    .maybeSingle()
                  
                  console.log('시뮬레이션 모드: 채널별 정보 조회 결과:', result)
                  detailsData = result.data
                }
                
                // 채널별 정보가 없으면 전체 공통 정보 가져오기
                if (!detailsData) {
                  console.log('시뮬레이션 모드: 전체 공통 정보 조회 시도')
                  const result = await supabase
                    .from('product_details_multilingual')
                    .select('*')
                    .eq('product_id', reservation.product_id)
                    .eq('language_code', locale)
                    .is('channel_id', null)
                    .maybeSingle()
                  
                  console.log('시뮬레이션 모드: 전체 공통 정보 조회 결과:', result)
                  detailsData = result.data
                }
                
                multilingualDetails = detailsData
                console.log('시뮬레이션 모드: 최종 multilingualDetails:', multilingualDetails)
              } catch (error) {
                console.warn('시뮬레이션 모드: 다국어 상품 세부 정보 조회 실패:', error)
              }

              // 픽업 호텔 정보 가져오기
              let pickupHotelInfo = null
              if (reservation.pickup_hotel) {
                console.log('시뮬레이션 모드: 픽업 호텔 정보 조회 시작, pickup_hotel:', reservation.pickup_hotel)
                try {
                  const { data: hotelData } = await supabase
                    .from('pickup_hotels')
                    .select('hotel, pick_up_location, address, media, link, youtube_link')
                    .eq('id', reservation.pickup_hotel)
                    .single()
                  
                  pickupHotelInfo = hotelData
                  console.log('시뮬레이션 모드: 픽업 호텔 정보 조회 성공:', hotelData)
                } catch (error) {
                  console.warn('시뮬레이션 모드: 픽업 호텔 정보 조회 실패:', error)
                }
              } else {
                console.log('시뮬레이션 모드: 픽업 호텔 정보 없음')
              }
              
              console.log('시뮬레이션 모드: 가격 정보 조회 시작 전')
              
              // 가격 정보 가져오기
              let pricingInfo = null
              try {
                console.log('시뮬레이션 모드: 가격 정보 조회 시작:', { reservationId: reservation.id, reservationIdType: typeof reservation.id })
                
                const { data: pricingData, error: pricingError } = await supabase
                  .from('reservation_pricing')
                  .select('adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, private_tour_additional_cost, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, choices, choices_total')
                  .eq('reservation_id', reservation.id.toString())
                  .single()
                
                if (pricingError) {
                  console.warn('시뮬레이션 모드: 가격 정보 조회 오류:', pricingError)
                } else {
                  pricingInfo = pricingData
                  console.log('시뮬레이션 모드: 가격 정보 로드됨:', pricingData)
                }
              } catch (error) {
                console.warn('시뮬레이션 모드: 가격 정보 조회 실패:', error)
              }

              // 옵션 정보 가져오기
              let optionsInfo = null
              try {
                console.log('시뮬레이션 모드: 옵션 정보 조회 시작:', { reservationId: reservation.id })
                
                const { data: optionsData, error: optionsError } = await supabase
                  .from('reservation_options')
                  .select('id, option_id, ea, price, total_price, status, note')
                  .eq('reservation_id', reservation.id.toString())
                  .eq('status', 'active')
                
                if (optionsError) {
                  console.warn('시뮬레이션 모드: 옵션 정보 조회 오류:', optionsError)
                } else {
                  optionsInfo = optionsData
                  console.log('시뮬레이션 모드: 옵션 정보 로드됨:', optionsData)
                }
              } catch (error) {
                console.warn('시뮬레이션 모드: 옵션 정보 조회 실패:', error)
              }

              // 결제 정보 가져오기
              let paymentsInfo = null
              try {
                console.log('시뮬레이션 모드: 결제 정보 조회 시작:', { reservationId: reservation.id })
                
                const { data: paymentsData, error: paymentsError } = await supabase
                  .from('payment_records')
                  .select('id, payment_status, amount, payment_method, note, submit_on, submit_by, confirmed_on, confirmed_by, amount_krw')
                  .eq('reservation_id', reservation.id.toString())
                  .order('submit_on', { ascending: false })
                
                if (paymentsError) {
                  console.warn('시뮬레이션 모드: 결제 정보 조회 오류:', paymentsError)
                } else {
                  paymentsInfo = paymentsData
                  console.log('시뮬레이션 모드: 결제 정보 로드됨:', paymentsData)
                }
              } catch (error) {
                console.warn('시뮬레이션 모드: 결제 정보 조회 실패:', error)
              }

              // 예약 선택 옵션 정보 가져오기
              let reservationChoicesInfo = null
              try {
                console.log('시뮬레이션 모드: 예약 선택 옵션 조회 시작:', { reservationId: reservation.id })
                
                const { data: choicesData, error: choicesError } = await supabase
                  .from('reservation_choices')
                  .select('id, choice_id, option_id, quantity, total_price')
                  .eq('reservation_id', reservation.id.toString())
                
                if (choicesError) {
                  console.warn('시뮬레이션 모드: 예약 선택 옵션 조회 오류:', choicesError)
                } else {
                  reservationChoicesInfo = choicesData
                  console.log('시뮬레이션 모드: 예약 선택 옵션 로드됨:', choicesData)
                  
                  // 새로운 테이블에서 choice와 option 정보 가져와서 매핑
                  if (reservationChoicesInfo && reservationChoicesInfo.length > 0) {
                    try {
                      // reservation_choices에서 choice_id와 option_id를 가져와서 새로운 테이블에서 정보 조회
                      const choiceIds = [...new Set(reservationChoicesInfo.map((c: { choice_id: string }) => c.choice_id))]
                      const optionIds = [...new Set(reservationChoicesInfo.map((c: { option_id: string }) => c.option_id))]
                      
                      // product_choices 테이블에서 choice 정보 조회
                      const { data: choicesData, error: choicesError } = await supabase
                        .from('product_choices')
                        .select('id, choice_group, choice_group_ko')
                        .in('id', choiceIds)
                      
                      // choice_options 테이블에서 option 정보 조회
                      const { data: optionsData, error: optionsError } = await supabase
                        .from('choice_options')
                        .select('id, option_key, option_name, option_name_ko')
                        .in('id', optionIds)
                      
                      if (!choicesError && !optionsError && choicesData && optionsData) {
                        // choice와 option 정보를 매핑
                        reservationChoicesInfo = reservationChoicesInfo.map((choice: {
                          id: string
                          choice_id: string
                          option_id: string
                          quantity: number
                          total_price: number
                        }) => {
                          const choiceInfo = choicesData.find((c: { id: string; choice_group: string; choice_group_ko: string }) => c.id === choice.choice_id) as { id: string; choice_group: string; choice_group_ko: string } | undefined
                          const optionInfo = optionsData.find((o: { id: string; option_name: string; option_name_ko: string }) => o.id === choice.option_id) as { id: string; option_name: string; option_name_ko: string } | undefined
                          
                          return {
                            ...choice,
                            choice: choiceInfo ? {
                              id: choiceInfo.id,
                              name_ko: choiceInfo.choice_group_ko,
                              name_en: choiceInfo.choice_group
                            } : null,
                            option: optionInfo ? {
                              id: optionInfo.id,
                              name_ko: optionInfo.option_name_ko,
                              name_en: optionInfo.option_name
                            } : null
                          }
                        })
                      }
                    } catch (error) {
                      console.warn('시뮬레이션 모드: 새로운 테이블에서 초이스 정보 조회 실패:', error)
                    }
                  }
                }
              } catch (error) {
                console.warn('시뮬레이션 모드: 예약 선택 옵션 조회 실패:', error)
              }

              return {
                ...reservation,
                products: productData || { 
                    name: t('noProductName'), 
                    customer_name_ko: null,
                    customer_name_en: null,
                  duration: null, 
                  base_price: null
                  },
                  multilingualDetails,
                  pickupHotelInfo,
                  pricing: pricingInfo,
                  options: optionsInfo,
                  payments: paymentsInfo,
                  reservationChoices: reservationChoicesInfo
                } as unknown as Reservation
            } catch (error) {
              console.error('시뮬레이션 상품 정보 조회 중 예외:', error)
              return {
                ...reservation,
                products: { 
                  name: t('noProductName'), 
                  customer_name_ko: null,
                  customer_name_en: null,
                  duration: null, 
                  base_price: null
                },
                pricing: null,
                options: null,
                payments: null,
                reservationChoices: null,
                channel_id: null,
                channel_rn: null
              } as unknown as Reservation
            }
          })
        )
        setReservations(reservationsWithProducts)
      } else {
        setReservations([])
      }
    } catch (error) {
      console.error('시뮬레이션 예약 정보 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [t, locale])

  // 데이터 로딩 (시뮬레이션 상태와 분리)
  useEffect(() => {
    // URL에 customer_id가 있으면 해당 고객의 예약을 표시 (시뮬레이션 무시)
    if (customerIdFromUrl) {
      console.log('Reservations: Loading customer data from URL:', customerIdFromUrl)
      loadCustomerReservationsById(customerIdFromUrl)
      return
    }
    
    // 시뮬레이션 중이 아닌 경우에만 고객 데이터 로드
    if (!isSimulating && user) {
      loadReservations()
    } else if (isSimulating && simulatedUser) {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보로 설정
      console.log('Reservations: Loading simulated customer data:', simulatedUser)
      
      // 시뮬레이션된 사용자에게 임시 ID 할당 (이메일 기반)
      const simulatedCustomerId = simulatedUser.id || `sim_${simulatedUser.email.replace('@', '_').replace('.', '_')}`
      
      setCustomer({
        id: simulatedCustomerId,
        name: simulatedUser.name_ko || simulatedUser.name_en || simulatedUser.email.split('@')[0],
        email: simulatedUser.email,
        phone: simulatedUser.phone,
        language: simulatedUser.language,
        created_at: simulatedUser.created_at
      })
      
      // 시뮬레이션된 사용자의 예약 정보 로드 (이메일 기반으로 실제 고객 조회)
      loadSimulatedReservationsByEmail(simulatedUser.email)
    } else if (isSimulating && !simulatedUser) {
      // 시뮬레이션 중이지만 simulatedUser가 없는 경우
      console.warn('Reservations: 시뮬레이션 중이지만 simulatedUser가 없습니다.')
      setLoading(false)
    } else if (!isSimulating && !user) {
      // 로그인하지 않은 사용자의 경우 로딩 완료
      console.log('Reservations: No user logged in, showing public page')
      setLoading(false)
    }
  }, [customerIdFromUrl, isSimulating, simulatedUser, user, loadReservations, loadSimulatedReservationsByEmail, loadCustomerReservationsById])

  // 상품 세부 정보 가져오기
  const getProductDetails = useCallback(async (productId: string, channelId?: string | null) => {
    try {
      let productDetails = null
      
      // 먼저 채널별 정보를 찾아보기 (채널 ID가 있는 경우에만)
      if (channelId) {
        const { data: channelDetails, error: channelError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .eq('channel_id', channelId)
          .maybeSingle()
        
        if (!channelError && channelDetails) {
          productDetails = channelDetails
        }
      }
      
      // 채널별 정보가 없으면 공통 정보 가져오기 (channel_id가 NULL)
      if (!productDetails) {
        const { data: commonDetails, error: commonError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .is('channel_id', null)
          .maybeSingle()
        
        if (!commonError && commonDetails) {
          productDetails = commonDetails
        } else if (commonError && commonError.code !== 'PGRST116') {
          // PGRST116은 데이터가 없을 때 발생하는 정상적인 오류
          console.warn('상품 세부 정보 조회 오류:', commonError)
        }
      }
      
      // 공통 정보도 없으면 첫 번째 항목 가져오기 (fallback)
      if (!productDetails) {
        const { data: anyDetailsArray, error: anyError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .limit(1)
        
        if (!anyError && anyDetailsArray && anyDetailsArray.length > 0) {
          productDetails = anyDetailsArray[0]
        } else if (anyError && anyError.code !== 'PGRST116') {
          console.warn('상품 세부 정보 조회 오류:', anyError)
        }
      }

      return productDetails
    } catch (error) {
      console.error('상품 세부 정보 조회 중 예외:', error)
      return null
    }
  }, [locale])

  // 픽업 스케줄 정보 가져오기 (reservations 테이블에서 직접 조회)
  const getPickupSchedule = useCallback(async (reservationId: string) => {
    try {
      // 먼저 현재 예약 정보 조회
      const { data: currentReservation, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          pickup_hotel,
          pickup_time,
          tour_date,
          tour_time,
          tour_id,
          customer_id
        `)
        .eq('id', reservationId)
        .single()

      if (reservationError) {
        console.warn('픽업 스케줄 조회 오류:', reservationError)
        return null
      }

      const result: PickupSchedule = {
        ...(currentReservation as SupabaseReservation),
        allPickups: []
      }

      // 현재 예약의 픽업 호텔 정보 조회
      if ((currentReservation as SupabaseReservation)?.pickup_hotel) {
        const { data: hotelInfo } = await supabase
          .from('pickup_hotels')
          .select(`
            hotel,
            pick_up_location,
            address,
            description_ko,
            link,
            media,
            youtube_link
          `)
          .eq('id', (currentReservation as SupabaseReservation).pickup_hotel!)
          .single()

        result.pickup_hotels = hotelInfo
      }

      // 투어 ID가 있으면 같은 투어의 모든 예약 정보 조회
      if ((currentReservation as SupabaseReservation)?.tour_id) {
        const { data: allReservations, error: allReservationsError } = await supabase
          .from('reservations')
          .select(`
            id,
            pickup_hotel,
            pickup_time,
            customer_id,
            total_people,
            tour_date
          `)
          .eq('tour_id', (currentReservation as SupabaseReservation).tour_id!)
          .not('pickup_time', 'is', null)
          .not('pickup_hotel', 'is', null)

        if (!allReservationsError && allReservations) {
          // 각 예약에 대해 고객 정보와 호텔 정보 조회
          const pickupInfos = await Promise.all(
            allReservations.map(async (res: SupabaseReservation) => {
              // 고객 정보 조회
              const { data: customerInfo } = await supabase
                .from('customers')
                .select('name')
                .eq('id', res.customer_id)
                .single()

              // 호텔 정보 조회
              const { data: hotelInfo } = await supabase
                .from('pickup_hotels')
                .select('hotel, pick_up_location, address, link')
                .eq('id', res.pickup_hotel!)
                .single()

              return {
                reservation_id: res.id,
                pickup_time: res.pickup_time || '',
                pickup_hotel: res.pickup_hotel || '',
                hotel_name: (hotelInfo as { hotel?: string } | null)?.hotel || 'Unknown Hotel',
                pick_up_location: (hotelInfo as { pick_up_location?: string } | null)?.pick_up_location || '',
                address: (hotelInfo as { address?: string } | null)?.address || '',
                link: (hotelInfo as { link?: string } | null)?.link || '',
                customer_name: (customerInfo as { name?: string } | null)?.name || 'Unknown Customer',
                total_people: res.total_people,
                tour_date: res.tour_date
              } as PickupInfo
            })
          )

          // 시간순으로 정렬
          pickupInfos.sort((a, b) => a.pickup_time.localeCompare(b.pickup_time))
          result.allPickups = pickupInfos
        }
      }

      return result
    } catch (error) {
      console.error('픽업 스케줄 조회 중 예외:', error)
      return null
    }
  }, [])

  // 투어 상세 정보 가져오기
  const getTourDetails = useCallback(async (reservationId: string) => {
    try {
      // reservations 테이블에서 직접 tour_id 찾기
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select('tour_id')
        .eq('id', reservationId)
        .single()

      if (reservationError || !(reservation as SupabaseReservation)?.tour_id) {
        console.warn('예약 ID 조회 오류:', reservationError)
        return null
      }

      // tour_id로 투어 상세 정보 조회 (외래키 관계 없이 직접 조회)
      const { data: tourDetails, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', (reservation as SupabaseReservation).tour_id!)
        .single()

      if (tourError) {
        console.warn('투어 상세 정보 조회 오류:', tourError)
        return null
      }

      // 투어 가이드와 어시스턴트 정보를 별도로 조회
      let tourGuideInfo = null
      let assistantInfo = null
      let vehicleInfo = null

      const tourDetailsTyped = tourDetails as SupabaseTourDetails

      if (tourDetailsTyped?.tour_guide_id) {
        const { data: guideData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email, languages')
          .eq('email', tourDetailsTyped.tour_guide_id)
          .single()
        tourGuideInfo = guideData
      }

      if (tourDetailsTyped?.assistant_id) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email')
          .eq('email', tourDetailsTyped.assistant_id)
          .single()
        assistantInfo = assistantData
      }

      // 차량 정보 조회
      if (tourDetailsTyped?.tour_car_id) {
        // 먼저 vehicles 테이블에서 vehicle_type (텍스트 값) 가져오기
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('vehicle_type, capacity, color')
          .eq('id', tourDetailsTyped.tour_car_id)
          .maybeSingle()
        
        // 차량이 없는 경우 스킵
        if (vehicleError && vehicleError.code !== 'PGRST116') {
          console.error('차량 정보 조회 오류:', vehicleError)
        }

        if (vehicleData && typeof vehicleData === 'object' && 'vehicle_type' in vehicleData && (vehicleData as SupabaseVehicleData).vehicle_type) {
          const vehicleDataTyped = vehicleData as SupabaseVehicleData
          
          // vehicle_types 테이블에서 차량 타입 정보 가져오기 (name으로 조회)
          const { data: vehicleTypeData } = await supabase
            .from('vehicle_types')
            .select('id, name, brand, model, passenger_capacity, description')
            .eq('name', vehicleDataTyped.vehicle_type)
            .single()

          let vehiclePhotosData = null
          if (vehicleTypeData && typeof vehicleTypeData === 'object' && 'id' in vehicleTypeData && (vehicleTypeData as SupabaseVehicleTypeData).id) {
            const vehicleTypeDataTyped = vehicleTypeData as SupabaseVehicleTypeData
            // vehicle_type_photos 테이블에서 사진들 가져오기
            const { data: photosData } = await supabase
              .from('vehicle_type_photos')
              .select('photo_url, photo_name, description, is_primary')
              .eq('vehicle_type_id', vehicleTypeDataTyped.id)
              .order('display_order', { ascending: true })
            vehiclePhotosData = photosData
          }

          vehicleInfo = {
            vehicle_type: vehicleDataTyped.vehicle_type,
            color: vehicleDataTyped.color,
            vehicle_type_info: vehicleTypeData && typeof vehicleTypeData === 'object' && 'name' in vehicleTypeData ? {
              name: (vehicleTypeData as SupabaseVehicleTypeData).name,
              brand: (vehicleTypeData as SupabaseVehicleTypeData).brand,
              model: (vehicleTypeData as SupabaseVehicleTypeData).model,
              passenger_capacity: (vehicleTypeData as SupabaseVehicleTypeData).passenger_capacity || vehicleDataTyped.capacity,
              description: (vehicleTypeData as SupabaseVehicleTypeData).description
            } : {
              name: vehicleDataTyped.vehicle_type,
              passenger_capacity: vehicleDataTyped.capacity
            },
            vehicle_type_photos: vehiclePhotosData || []
          }
        }
      }

      return {
        ...tourDetailsTyped,
        tour_guide: tourGuideInfo,
        assistant: assistantInfo,
        vehicle: vehicleInfo
      } as unknown as TourDetails
    } catch (error) {
      console.error('투어 상세 정보 조회 중 예외:', error)
      return null
    }
  }, [])

  // 상품 스케줄 정보 가져오기
  const getProductSchedules = useCallback(async (productId: string) => {
    try {
      const { data: schedules, error } = await supabase
        .from('product_schedules')
        .select('id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers, order_index')
        .eq('product_id', productId)
        .eq('show_to_customers', true)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })

      if (error) {
        console.warn('상품 스케줄 조회 오류:', error)
        return null
      }

      return schedules as ProductSchedule[]
    } catch (error) {
      console.error('상품 스케줄 조회 중 예외:', error)
      return null
    }
  }, [])

  // 예약 상세 정보 자동 로드
  const loadReservationDetails = useCallback(async (reservationId: string) => {
    // 상세 정보가 아직 로드되지 않은 경우에만 로드
    if (!reservationDetails[reservationId]) {
      const reservation = reservations.find(r => r.id === reservationId)
      if (reservation) {
        const [productDetails, pickupSchedule, tourDetails, productSchedules] = await Promise.all([
          getProductDetails(reservation.product_id, reservation.channel_id),
          getPickupSchedule(reservationId),
          getTourDetails(reservationId),
          getProductSchedules(reservation.product_id)
        ])
        
        setReservationDetails(prev => ({
          ...prev,
          [reservationId]: {
            productDetails,
            pickupSchedule,
            tourDetails,
            productSchedules
          }
        } as Record<string, ReservationDetails>))
      }
    }
  }, [reservations, reservationDetails, getProductDetails, getPickupSchedule, getTourDetails, getProductSchedules])

  // 예약이 로드되면 상세 정보도 자동으로 로드
  useEffect(() => {
    if (reservations.length > 0) {
      reservations.forEach(reservation => {
        loadReservationDetails(reservation.id)
      })
    }
  }, [reservations, loadReservationDetails])

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      // 약간의 지연을 두고 페이지 이동
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 관리자 페이지로 이동
      router.push(`/${locale}/admin`)
    }
  }

  // 상태별 필터링
  const filteredReservations = reservations.filter(reservation => {
    if (filter === 'all') return true
    return reservation.status === filter
  })

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('pending')
      case 'confirmed': return t('confirmed')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      default: return status
    }
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // 시뮬레이션 모드가 아닌 경우에만 고객 정보 없음 메시지 표시
  if (!customer && !isSimulating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('noCustomerInfo')}</h2>
          <p className="text-gray-600 mb-4">{t('registerCustomerFirst')}</p>
          <button
            onClick={() => router.push(`/${locale}/dashboard/profile`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('registerProfile')}
          </button>
        </div>
      </div>
    )
  }

  // 시뮬레이션 모드에서 고객 정보가 없는 경우 (로딩 완료 후)
  if (!customer && isSimulating && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('simulationMode')}</h2>
          <p className="text-gray-600 mb-4">{t('simulationUserNoReservations')}</p>
          <div className="space-x-2">
            <button
              onClick={() => router.push(`/${locale}/dashboard/profile`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {t('registerProfile')}
            </button>
            <button
              onClick={handleStopSimulation}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              {t('stopSimulation')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6">
        {/* 헤더 */}
        <div className="bg-white shadow-sm p-3 sm:p-6 mb-1 sm:mb-6 rounded-none sm:rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4 space-y-2 sm:space-y-0">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-3 sm:mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="text-sm sm:text-base">{t('back')}</span>
              </button>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{t('myReservations')}</h1>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs sm:text-sm font-medium text-center">
                  {t('simulating')}: {simulatedUser.name_ko}
                </div>
                <div className="flex flex-wrap gap-1 sm:gap-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 flex-1 sm:flex-none"
                  >
                    {t('dashboard')}
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 flex-1 sm:flex-none"
                  >
                    {t('myInfo')}
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center justify-center flex-1 sm:flex-none"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    {t('backToAdmin')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-600">{t('checkReservationHistory')}</p>
        </div>

        {/* 필터 */}
        <div className="bg-white shadow-sm p-3 sm:p-4 mb-1 sm:mb-6 rounded-none sm:rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{t('filterByStatus')}</span>
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-2 sm:pb-0">
              {[
                { value: 'all', label: t('all') },
                { value: 'pending', label: t('pending') },
                { value: 'confirmed', label: t('confirmed') },
                { value: 'completed', label: t('completed') },
                { value: 'cancelled', label: t('cancelled') }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                    filter === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 예약 목록 */}
        <div className="space-y-1 sm:space-y-6">
          {filteredReservations.length > 0 ? (
            filteredReservations.map((reservation) => (
              <div key={reservation.id} id={`reservation-${reservation.id}`} className="bg-white shadow-sm p-4 sm:p-6 rounded-none sm:rounded-lg print:p-4 print:shadow-none print:border print:rounded">

                {/* 모바일에서 STATUS 버튼과 액션 버튼들을 제목 윗줄에 배치 */}
                <div className="flex items-center justify-between mb-2 sm:hidden print:hidden">
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                    {getStatusText(reservation.status)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePrint(reservation)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      {t('print')}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-start justify-between mb-2 sm:mb-4">
                  <div className="flex-1">
                     <div className="flex items-center flex-wrap gap-2 mb-2">
                       <h3 className="text-base sm:text-xl font-semibold text-gray-900">
                         {locale === 'ko' 
                           ? (reservation.products?.customer_name_ko || reservation.products?.name || t('noProductName'))
                           : (reservation.products?.customer_name_en || reservation.products?.name || t('noProductName'))
                         }
                       </h3>
                       {/* Choice 옵션 뱃지 */}
                       {reservation.reservationChoices && reservation.reservationChoices.length > 0 && (
                         <div className="flex flex-wrap gap-1">
                           {(() => {
                            // 중복 제거: 같은 option_name을 가진 것들을 합침
                            const uniqueChoices = reservation.reservationChoices.reduce((acc: Array<{
                              choice_id: string;
                              option_id: string;
                              quantity: number;
                              total_price: number;
                              choice?: { id: string; name_ko: string; name_en: string } | null;
                              option?: { id: string; name_ko: string; name_en: string } | null;
                            }>, choice: {
                              choice_id: string;
                              option_id: string;
                              quantity: number;
                              total_price: number;
                              choice?: { id: string; name_ko: string; name_en: string } | null;
                              option?: { id: string; name_ko: string; name_en: string } | null;
                            }) => {
                               const optionName = locale === 'ko' 
                                 ? (choice.option?.name_ko || choice.option?.name_en || 'Unknown Option')
                                 : (choice.option?.name_en || choice.option?.name_ko || 'Unknown Option');
                               
                               const existing = acc.find(item => {
                                 const itemOptionName = locale === 'ko' 
                                   ? (item.option?.name_ko || item.option?.name_en || 'Unknown Option')
                                   : (item.option?.name_en || item.option?.name_ko || 'Unknown Option');
                                 return itemOptionName === optionName;
                               });
                               
                               if (existing) {
                                 // 기존 항목이 있으면 수량과 가격을 합침
                                 existing.quantity += choice.quantity || 1;
                                 existing.total_price += choice.total_price || 0;
                               } else {
                                 // 새로운 항목 추가
                                 acc.push({ ...choice });
                               }
                               
                               return acc;
                             }, []);
                             
                             return uniqueChoices.map((choice, index) => {
                               const optionName = locale === 'ko' 
                                 ? (choice.option?.name_ko || choice.option?.name_en || 'Unknown Option')
                                 : (choice.option?.name_en || choice.option?.name_ko || 'Unknown Option');
                               
                               return (
                                 <span
                                   key={`${choice.choice_id}-${choice.option_id}-${index}`}
                                   className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                 >
                                   {optionName}
                                 </span>
                               );
                             });
                           })()}
                         </div>
                       )}
                     </div>
                     
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      onClick={() => handlePrint(reservation)}
                      className="hidden sm:inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      {t('print')}
                    </button>
                    <span className={`hidden sm:inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                    {getStatusText(reservation.status)}
                  </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 print:grid-cols-2 print:gap-6">
                  {/* 고객 이름 */}
                  {customer && (
                    <div className="flex items-center text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      <span className="text-sm font-semibold">{customer.name}</span>
                    </div>
                  )}

                  {/* 고객 이메일 */}
                  {customer && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      <span className="text-sm font-semibold">{customer.email}</span>
                    </div>
                  )}

                  {/* 고객 전화번호 */}
                  {customer && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      <span className="text-sm font-semibold">{customer.phone || 'N/A'}</span>
                    </div>
                  )}

                  {/* 총 인원 */}
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm font-semibold">
                      Total {reservation.total_people} people <span className="text-xs font-normal">(Adults: {reservation.adults}, Children: {reservation.child}, Infants: {reservation.infant})</span>
                    </span>
                  </div>

                  {/* 투어 날짜 */}
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {reservation.tour_date} ({new Date(reservation.tour_date).toLocaleDateString('en-US', { weekday: 'long' })})
                    </span>
                  </div>

                  {/* 픽업 시간 */}
                  {reservation.pickup_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">
                        {t('pickup')}: <span className="font-semibold text-blue-600">{formatTimeToAMPM(reservation.pickup_time)}</span>
                        {reservation.tour_date && (
                          <span className="ml-1 font-semibold text-blue-600">
                            ({calculatePickupDate(reservation.pickup_time, reservation.tour_date)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 픽업 호텔 */}
                  {reservation.pickupHotelInfo && (
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <div>
                        <span className="text-sm font-medium">{reservation.pickupHotelInfo.hotel}</span>
                        <span className="text-xs text-gray-500 ml-2">({reservation.pickupHotelInfo.pick_up_location})</span>
                      </div>
                    </div>
                  )}

                  {/* 채널 정보 */}
                  {(reservation.channel_id || reservation.channel_rn) && (
                    <div className="flex items-center text-gray-600">
                      {(() => {
                        const channel = channels.find(c => c.id === reservation.channel_id)
                        return (
                          <>
                            {channel && (
                          <>
                            {channel.favicon_url ? (
                              <Image 
                                src={channel.favicon_url} 
                                alt={`${channel.name} favicon`} 
                                width={16}
                                height={16}
                                    className="rounded mr-2 flex-shrink-0 print:w-6 print:h-6 print:mr-2"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const fallback = document.createElement('div')
                                    fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 mr-2'
                                    fallback.innerHTML = '🌐'
                                    parent.appendChild(fallback)
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 mr-2">
                                🌐
                              </div>
                            )}
                            <span className="text-sm">{channel.name}</span>
                  {reservation.channel_rn && (
                                  <span className="text-sm ml-2 text-blue-600 font-medium">
                                    (#{reservation.channel_rn})
                      </span>
                                )}
                              </>
                            )}
                            {!channel && reservation.channel_id && (
                              <span className="text-sm">채널을 찾을 수 없음 (ID: {reservation.channel_id})</span>
                            )}
                            {!channel && !reservation.channel_id && reservation.channel_rn && (
                              <span className="text-sm text-blue-600 font-medium">
                                채널 예약번호: #{reservation.channel_rn}
                      </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}

                </div>

                 {/* 가격 정보 */}
                 {(reservation.pricing || reservation.products?.base_price) && (
                   <div className="border-t border-gray-200 pt-4">
                     <h4 className="text-sm font-medium text-gray-900 mb-3">{t('priceInfo')}</h4>
                     <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                       {reservation.pricing ? (
                         <div className="divide-y divide-gray-200">
                           {/* 상품 가격 */}
                           <div className="p-4">
                             <div className="space-y-2 text-sm">
                               {reservation.adults > 0 && (
                                 <div className="flex justify-between items-center">
                                   <span className="text-gray-600">{t('adults')} {reservation.adults}{t('people')}</span>
                                   <span className="font-medium text-gray-900">
                                     ${((reservation.pricing.adult_product_price || 0) * reservation.adults).toFixed(2)}
                                   </span>
                                 </div>
                               )}
                               {reservation.child > 0 && (
                                 <div className="flex justify-between items-center">
                                   <span className="text-gray-600">{t('children')} {reservation.child}{t('people')}</span>
                                   <span className="font-medium text-gray-900">
                                     ${((reservation.pricing.child_product_price || 0) * reservation.child).toFixed(2)}
                                   </span>
                                 </div>
                               )}
                               {reservation.infant > 0 && (
                                 <div className="flex justify-between items-center">
                                   <span className="text-gray-600">{t('infants')} {reservation.infant}{t('people')}</span>
                                   <span className="font-medium text-gray-900">
                                     ${((reservation.pricing.infant_product_price || 0) * reservation.infant).toFixed(2)}
                                   </span>
                                 </div>
                               )}
                               <div className="flex justify-between items-center pt-2 border-t border-gray-100 font-semibold">
                                 <span className="text-gray-800">{t('productTotal')}</span>
                                 <span className="text-gray-900">${(reservation.pricing.product_price_total || 0).toFixed(2)}</span>
                               </div>
                             </div>
                           </div>

                           {/* 옵션 가격 */}
                           {(reservation.pricing.required_option_total > 0 || reservation.pricing.option_total > 0) && (
                             <div className="p-4 bg-gray-50">
                               <div className="space-y-2 text-sm">
                                 {reservation.pricing.required_option_total > 0 && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('requiredOptions')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${(reservation.pricing.required_option_total || 0).toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.option_total > 0 && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('optionalOptions')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${(reservation.pricing.option_total || 0).toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-semibold">
                                   <span className="text-gray-800">{t('optionTotal')}</span>
                                   <span className="text-gray-900">
                                     ${((reservation.pricing.required_option_total || 0) + (reservation.pricing.option_total || 0)).toFixed(2)}
                                   </span>
                                 </div>
                               </div>
                             </div>
                           )}

                           {/* 소계 */}
                           <div className="p-4 bg-blue-50">
                             <div className="flex justify-between items-center">
                               <span className="text-sm font-semibold text-blue-800">{t('subtotal')}</span>
                               <span className="text-lg font-bold text-blue-900">${(reservation.pricing.subtotal || 0).toFixed(2)}</span>
                             </div>
                           </div>

                           {/* 결제 정보 */}
                           <div className="p-4 bg-gray-50">
                             <div className="space-y-1 text-sm">
                               <div className="flex justify-between items-center">
                                 <div className="flex items-center space-x-1">
                                   <span className="text-gray-600">{t('deposit')}</span>
                                   {reservation.payments && reservation.payments.length > 0 && (
                                     <span className="text-xs text-gray-500">
                                       ({new Date(reservation.payments[0].submit_on).toLocaleDateString()})
                                     </span>
                                   )}
                                 </div>
                                 <span className="font-bold text-indigo-600">${(reservation.pricing.deposit_amount || 0).toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between items-center">
                                 <span className="text-gray-600">{t('balance')}</span>
                                 <span className="font-bold text-purple-600">${(reservation.pricing.balance_amount || 0).toFixed(2)}</span>
                               </div>
                             </div>
                           </div>

                           {/* 할인 및 추가 비용 */}
                           {(reservation.pricing.coupon_discount !== 0 || reservation.pricing.additional_discount !== 0 || 
                             reservation.pricing.additional_cost !== 0 || reservation.pricing.card_fee !== 0 || 
                             reservation.pricing.tax !== 0 || reservation.pricing.prepayment_cost !== 0 || 
                             reservation.pricing.prepayment_tip !== 0 || reservation.pricing.private_tour_additional_cost > 0) && (
                             <div className="p-4">
                               <div className="space-y-2 text-sm">
                                 {reservation.pricing.coupon_discount !== 0 && reservation.pricing.coupon_discount !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('couponDiscount')}</span>
                                     <span className="font-medium text-green-600">
                                       {reservation.pricing.coupon_discount < 0 
                                         ? `-$${Math.abs(reservation.pricing.coupon_discount).toFixed(2)}` 
                                         : `$${reservation.pricing.coupon_discount.toFixed(2)}`}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.additional_discount !== 0 && reservation.pricing.additional_discount !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('additionalDiscount')}</span>
                                     <span className="font-medium text-green-600">
                                       ${reservation.pricing.additional_discount.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.additional_cost !== 0 && reservation.pricing.additional_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('additionalCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.additional_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.card_fee !== 0 && reservation.pricing.card_fee !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('cardFee')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.card_fee.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.tax !== 0 && reservation.pricing.tax !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('tax')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.tax.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.prepayment_cost !== 0 && reservation.pricing.prepayment_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('prepaymentCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.prepayment_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.prepayment_tip !== 0 && reservation.pricing.prepayment_tip !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('prepaymentTip')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.prepayment_tip.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.private_tour_additional_cost > 0 && reservation.pricing.private_tour_additional_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('privateTourAdditionalCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.private_tour_additional_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}

                         </div>
                       ) : (
                         <div className="p-4">
                           <div className="space-y-2 text-sm">
                             <div className="flex justify-between items-center">
                               <span className="text-gray-600">{t('basePrice')}</span>
                               <span className="font-medium text-gray-900">
                                 ${(reservation.products?.base_price || 0).toFixed(2)} / {t('perPerson')}
                               </span>
                             </div>
                             <div className="flex justify-between items-center">
                               <span className="text-gray-600">{t('totalPeople')}</span>
                               <span className="font-medium text-gray-900">{reservation.total_people}{t('people')}</span>
                             </div>
                             <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-semibold">
                               <span className="text-gray-800">{t('estimatedTotal')}</span>
                               <span className="text-gray-900">
                                 ${((reservation.products?.base_price || 0) * reservation.total_people).toFixed(2)}
                               </span>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                {/* 특이사항 */}
                {reservation.event_note && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{t('specialNotes')}</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                      {reservation.event_note}
                    </p>
                  </div>
                )}

                {/* 상세 정보 */}
                  <div className="border-t border-gray-200 pt-6 mt-4 space-y-6">
                    {/* 상품 세부 정보 */}
                    {(reservationDetails[reservation.id]?.productDetails || reservation.multilingualDetails) && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <MapPin className="w-5 h-5 mr-2" />
                          {t('productDetails')}
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          {/* 다국어 상품 세부 정보 우선 표시 */}
                          {reservation.multilingualDetails?.included && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('included')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.not_included && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('notIncluded')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.not_included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.pickup_drop_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('meetingPoint')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.pickup_drop_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.cancellation_policy && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('cancellationPolicy')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.cancellation_policy}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.luggage_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('luggageInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.luggage_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.tour_operation_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('tourOperationInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.tour_operation_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.preparation_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('preparationInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.preparation_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.small_group_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('smallGroupInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.small_group_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.notice_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('noticeInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.notice_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.private_tour_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('privateTourInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.private_tour_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.chat_announcement && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('chatAnnouncement')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.chat_announcement}</p>
                            </div>
                          )}
                          
                          {/* 기존 상품 세부 정보 (다국어 정보가 없을 때만 표시) */}
                          {!reservation.multilingualDetails && reservationDetails[reservation.id]?.productDetails && (
                            <>
                              {reservationDetails[reservation.id]?.productDetails?.description && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('productDescription')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.description}</p>
                                </div>
                              )}
                              {reservationDetails[reservation.id]?.productDetails?.highlights && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('highlights')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.highlights}</p>
                                </div>
                              )}
                              {reservationDetails[reservation.id]?.productDetails?.included && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('included')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.included}</p>
                                </div>
                              )}
                              {reservationDetails[reservation.id]?.productDetails?.not_included && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('notIncluded')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.not_included}</p>
                                </div>
                              )}
                              {reservationDetails[reservation.id]?.productDetails?.meeting_point && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('meetingPoint')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.meeting_point}</p>
                                </div>
                              )}
                              {reservationDetails[reservation.id]?.productDetails?.cancellation_policy && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('cancellationPolicy')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservationDetails[reservation.id]?.productDetails?.cancellation_policy}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 상품 스케줄 */}
                    {reservationDetails[reservation.id]?.productSchedules && reservationDetails[reservation.id]?.productSchedules!.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Calendar className="w-5 h-5 mr-2" />
                          {t('tourSchedule')}
                        </h4>
                        <div className="space-y-3">
                          {reservationDetails[reservation.id]?.productSchedules!.map((schedule) => (
                            <div key={schedule.id} className="bg-gray-50 p-3 rounded-md border-l-4 border-green-500">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="space-y-2">
                                    {/* 시간 정보와 소요시간 - 같은 줄에 배치 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                    {schedule.start_time && (
                                        <span className="text-sm font-medium text-green-700">
                                        {formatTimeToAMPM(schedule.start_time)}
                                        {schedule.end_time && ` - ${formatTimeToAMPM(schedule.end_time)}`}
                                      </span>
                                    )}
                                    {schedule.start_time && schedule.end_time && calculateDuration(schedule.start_time, schedule.end_time) && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {calculateDuration(schedule.start_time, schedule.end_time)}
                                      </span>
                                    )}
                                    </div>
                                    {/* 스케줄 제목 - 별도 줄에 표시 */}
                                    <div>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {locale === 'ko' 
                                        ? (schedule.title_ko || schedule.title_en)
                                        : (schedule.title_en || schedule.title_ko)
                                      }
                                    </span>
                                    </div>
                                  </div>
                                  {(locale === 'ko' ? schedule.description_ko : schedule.description_en) && (
                                    <p className="text-xs text-gray-600 whitespace-pre-wrap">
                                      {locale === 'ko' 
                                        ? schedule.description_ko
                                        : schedule.description_en
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 픽업 스케줄 */}
                    {reservationDetails[reservation.id]?.pickupSchedule && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Clock className="w-5 h-5 mr-2" />
                          {t('pickupSchedule')}
                        </h4>
                        
                        {/* 자신의 픽업 정보 */}
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <h5 className="font-semibold text-blue-800 mb-3 flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {t('myPickup')}
                          </h5>
                          <div className="space-y-4">
                            {/* 픽업 타임만 표시 */}
                            <div>
                              <h6 className="font-medium text-gray-900 mb-2">{t('pickupTime')}</h6>
                              {(() => {
                                const pickupTime = reservationDetails[reservation.id]?.pickupSchedule?.pickup_time
                                const tourDate = reservationDetails[reservation.id]?.pickupSchedule?.tour_date
                                return pickupTime ? (
                                  <p className="text-sm text-gray-700">
                                    <span className="font-semibold text-blue-600">{formatTimeToAMPM(pickupTime)}</span>
                                    {tourDate && (
                                      <span className="ml-2 font-semibold text-blue-600">
                                        ({calculatePickupDate(pickupTime, tourDate)})
                                      </span>
                                    )}
                                  </p>
                                ) : null
                              })()}
                            </div>
                            
                            {/* 픽업 호텔 상세 정보 */}
                                    {(() => {
                              const pickupHotelData = reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels;
                              if (pickupHotelData?.hotel) {
                                return (
                                  <div className="mt-4">
                                <h6 className="font-medium text-gray-900 mb-2">{t('pickupHotel')}</h6>
                                    <p className="text-sm text-gray-700">{pickupHotelData.hotel}</p>
                                    <p className="text-xs text-gray-600">{pickupHotelData.pick_up_location}</p>
                                    {pickupHotelData.address && (
                                      <p className="text-xs text-gray-600">{pickupHotelData.address}</p>
                                )}
                                <div className="mt-2 space-y-1">
                                      {pickupHotelData.link && (
                                    <a 
                                          href={pickupHotelData.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      {t('viewOnMap')}
                                    </a>
                                  )}
                                      {pickupHotelData.youtube_link && (
                                    <a 
                                          href={pickupHotelData.youtube_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-red-600 hover:text-red-800 text-xs"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
                                      </svg>
                                      {t('viewVideo')}
                                    </a>
                                  )}
                                </div>
                              </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* MEDIA 섹션 - 데스크톱 4열, 모바일 2열 */}
                            {(() => {
                              const pickupHotelData = reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels;
                              const mediaUrls = pickupHotelData?.media;
                              
                              if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
                                return (
                                  <div className="mt-4">
                                    <h6 className="font-medium text-gray-900 mb-2">{t('media')}</h6>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {mediaUrls.filter((mediaUrl): mediaUrl is string => Boolean(mediaUrl)).map((mediaUrl: string, index: number) => (
                                        <div 
                                          key={index}
                                          className="relative cursor-pointer group"
                                          onClick={() => setSelectedMedia(mediaUrl)}
                                        >
                                          <div className="aspect-[4/3] w-full">
                                            <Image 
                                              src={mediaUrl}
                                              alt={`Hotel Media ${index + 1}`}
                                              width={200}
                                              height={150}
                                              className="w-full h-full object-cover rounded-lg border hover:opacity-80 transition-opacity print:w-32 print:h-24"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                              }}
                                            />
                                          </div>
                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                                            <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* 모든 픽업 정보 */}
                        {reservationDetails[reservation.id]?.pickupSchedule?.allPickups && (reservationDetails[reservation.id]?.pickupSchedule?.allPickups?.length || 0) > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {t('allPickups')}
                            </h5>
                            <div className="space-y-3">
                              {reservationDetails[reservation.id]?.pickupSchedule?.allPickups!.map((pickup) => (
                                <div key={pickup.reservation_id} className={`p-3 rounded-md border-l-4 ${
                                  pickup.reservation_id === reservation.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                                }`}>
                                  <div className="space-y-2">
                                    {/* 첫 번째 줄: 픽업 시간과 날짜 */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-blue-600">
                                          {formatTimeToAMPM(pickup.pickup_time)}
                                        </span>
                                      <span className="text-sm font-semibold text-blue-600">
                                          {pickup.tour_date && calculatePickupDate(pickup.pickup_time, pickup.tour_date)}
                                        </span>
                                    </div>
                                    
                                    {/* 두 번째 줄: 호텔 이름 */}
                                    <div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {pickup.hotel_name}
                                        </span>
                                      </div>
                                    
                                    {/* 세 번째 줄: 픽업 장소 (크기 키우고 다른 색깔) */}
                                    <div className="text-sm text-orange-600 font-medium">
                                        <p>{pickup.pick_up_location}</p>
                                    </div>
                                    
                                    {/* 네 번째 줄: 주소 (회색) */}
                                    {pickup.address && (
                                      <div className="text-sm text-gray-600">
                                        <p>{pickup.address}</p>
                                      </div>
                                    )}
                                    
                                    {/* 다섯 번째 줄: VIEW ON MAP과 MY RESERVATION */}
                                    <div className="flex items-center justify-between">
                                        <a 
                                          href={pickup.link || `https://maps.google.com/maps?q=${encodeURIComponent(pickup.hotel_name + (pickup.address ? ', ' + pickup.address : ''))}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs"
                                        >
                                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                          </svg>
                                          {t('viewOnMap')}
                                        </a>
                                      {pickup.reservation_id === reservation.id && (
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                          {t('myReservation')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 투어 상세 정보 */}
                    {reservationDetails[reservation.id]?.tourDetails && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Users className="w-5 h-5 mr-2" />
                          {t('tourDetails')}
                        </h4>
                        <div className="bg-green-50 p-4 rounded-lg space-y-4">
                          {/* 가이드 정보 */}
                          {reservationDetails[reservation.id]?.tourDetails?.tour_guide && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {t('guide')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">
                                  {locale === 'ko' 
                                    ? (reservationDetails[reservation.id]?.tourDetails?.tour_guide?.name_ko || reservationDetails[reservation.id]?.tourDetails?.tour_guide?.name_en)
                                    : (reservationDetails[reservation.id]?.tourDetails?.tour_guide?.name_en || reservationDetails[reservation.id]?.tourDetails?.tour_guide?.name_ko)
                                  }
                                </p>
                                {reservationDetails[reservation.id]?.tourDetails?.tour_guide?.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {reservationDetails[reservation.id]?.tourDetails?.tour_guide?.phone}
                                  </p>
                                )}
                                {reservationDetails[reservation.id]?.tourDetails?.tour_guide?.languages && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {t('languages')}: {Array.isArray(reservationDetails[reservation.id]?.tourDetails?.tour_guide?.languages) 
                                      ? (reservationDetails[reservation.id]?.tourDetails?.tour_guide?.languages as string[])?.join(', ')
                                      : reservationDetails[reservation.id]?.tourDetails?.tour_guide?.languages}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 어시스턴트 정보 */}
                          {reservationDetails[reservation.id]?.tourDetails?.assistant && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {t('assistant')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">
                                  {locale === 'ko' 
                                    ? (reservationDetails[reservation.id]?.tourDetails?.assistant?.name_ko || reservationDetails[reservation.id]?.tourDetails?.assistant?.name_en)
                                    : (reservationDetails[reservation.id]?.tourDetails?.assistant?.name_en || reservationDetails[reservation.id]?.tourDetails?.assistant?.name_ko)
                                  }
                                </p>
                                {reservationDetails[reservation.id]?.tourDetails?.assistant?.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {reservationDetails[reservation.id]?.tourDetails?.assistant?.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 차량 정보 */}
                          {reservationDetails[reservation.id]?.tourDetails?.vehicle && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                {t('vehicle')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info && (
                                  <div className="mb-3">
                                    <p className="text-sm font-medium text-gray-900">
                                      {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.name}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.brand} {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.model}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {t('capacity')}: {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.passenger_capacity} {t('people')}
                                    </p>
                                    {reservationDetails[reservation.id]?.tourDetails?.vehicle?.color && (
                                      <p className="text-xs text-gray-600">
                                        {t('color')}: {reservationDetails[reservation.id]?.tourDetails?.vehicle?.color}
                                      </p>
                                    )}
                                    {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.description && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_info?.description}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {(() => {
                                  const photos = reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_photos
                                  return photos && Array.isArray(photos) && photos.length > 0
                                })() && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {reservationDetails[reservation.id]?.tourDetails?.vehicle?.vehicle_type_photos?.map((photo, index) => (
                                      <div 
                                        key={index}
                                        className="relative cursor-pointer group"
                                        onClick={() => photo.photo_url && setSelectedMedia(photo.photo_url)}
                                      >
                                        <Image 
                                          src={photo.photo_url || ''}
                                          alt={photo.photo_name || `Vehicle ${index + 1}`}
                                          width={200}
                                          height={96}
                                          className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                                          <ExternalLink className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        {photo.is_primary && (
                                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                                            {t('primary')}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                    {/* 예약 일시 */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <p className="text-xs text-gray-500">
                          {t('reservationDate')}: {new Date(reservation.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                        </p>
                      </div>

                      {/* 프린트용 푸터 */}
                      <div className="hidden print:block text-center mt-8 print:mt-6 text-xs text-gray-500">
                        <p>{locale === 'ko' ? 'MANIA TOUR - 예약 관리 시스템' : 'MANIA TOUR - Reservation Management System'}</p>
                      </div>
                    </div>
                  </div>
              ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noReservations')}</h3>
              <p className="text-gray-500 mb-6">
                {filter === 'all' 
                  ? t('noToursReserved')
                  : t('noReservationsForStatus', { status: getStatusText(filter) })
                }
              </p>
              <button
                onClick={() => router.push('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {t('viewTourProducts')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 미디어 모달 */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <Image
              src={selectedMedia || ''}
              alt="Enlarged Media"
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}