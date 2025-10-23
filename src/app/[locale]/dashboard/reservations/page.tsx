'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, Clock, MapPin, Users, CreditCard, ArrowLeft, Filter, User, Phone } from 'lucide-react'
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
  created_at: string
  products?: {
    name: string
    customer_name_ko: string | null
    customer_name_en: string | null
    duration: number | null
    base_price: number | null
  }
  multilingualDetails?: {
    description?: string
    slogan1?: string
    included?: string
    not_included?: string
    pickup_drop_info?: string
    cancellation_policy?: string
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
  } | null
}

interface TourDetails {
  id?: string
  tour_guide_id?: string
  assistant_id?: string
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
}

interface SupabaseCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

export default function CustomerReservations() {
  const { user, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservationDetails, setReservationDetails] = useState<Record<string, ReservationDetails>>({})

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
                  .select('name, customer_name_ko, customer_name_en, duration, base_price')
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

                // 다국어 상품 세부 정보도 함께 가져오기
                let multilingualDetails = null
                try {
                  const { data: detailsData } = await supabase
                    .from('product_details_multilingual')
                    .select('*')
                    .eq('product_id', reservation.product_id)
                    .eq('language_code', locale)
                    .single()
                  
                  multilingualDetails = detailsData
                } catch (error) {
                  console.warn('다국어 상품 세부 정보 조회 실패:', error)
                }

                // 픽업 호텔 정보 가져오기
                let pickupHotelInfo = null
                if (reservation.pickup_hotel) {
                  try {
                    const { data: hotelData } = await supabase
                      .from('pickup_hotels')
                      .select('hotel, pick_up_location, address')
                      .eq('id', reservation.pickup_hotel)
                      .single()
                    
                    pickupHotelInfo = hotelData
                  } catch (error) {
                    console.warn('픽업 호텔 정보 조회 실패:', error)
                  }
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
                  pickupHotelInfo
                } as Reservation
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
                  }
                } as Reservation
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
        // 각 예약에 대해 상품 정보를 별도로 조회
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation: SupabaseReservation) => {
            try {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name, customer_name_ko, customer_name_en, duration, base_price')
                .eq('id', reservation.product_id)
                .single()

              if (productError) {
                console.warn(t('simulationProductError'), {
                  error: productError,
                  message: productError?.message || 'Unknown error',
                  code: productError?.code || 'No code',
                  product_id: reservation.product_id,
                  reservation_id: reservation.id
                })
              }

              // 픽업 호텔 정보 가져오기
              let pickupHotelInfo = null
              if (reservation.pickup_hotel) {
                try {
                  const { data: hotelData } = await supabase
                    .from('pickup_hotels')
                    .select('hotel, pick_up_location, address')
                    .eq('id', reservation.pickup_hotel)
                    .single()
                  
                  pickupHotelInfo = hotelData
                } catch (error) {
                  console.warn('시뮬레이션 픽업 호텔 정보 조회 실패:', error)
                }
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
                  pickupHotelInfo
                } as Reservation
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
                }
              } as Reservation
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
  }, [t])

  // 데이터 로딩 (시뮬레이션 상태와 분리)
  useEffect(() => {
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
  }, [isSimulating, simulatedUser, user, loadReservations, loadSimulatedReservationsByEmail])

  // 상품 세부 정보 가져오기
  const getProductDetails = useCallback(async (productId: string) => {
    try {
      const { data: productDetails, error } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', locale)
        .single()

      if (error) {
        console.warn('상품 세부 정보 조회 오류:', error)
        return null
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
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(`
          pickup_hotel,
          pickup_time,
          tour_date,
          tour_time
        `)
        .eq('id', reservationId)
        .single()

      if (error) {
        console.warn('픽업 스케줄 조회 오류:', error)
        return null
      }

      // 픽업 호텔 정보가 있으면 추가 조회
      if ((reservation as SupabaseReservation)?.pickup_hotel) {
        const { data: hotelInfo } = await supabase
          .from('pickup_hotels')
          .select(`
            hotel,
            pick_up_location,
            address,
            description_ko
          `)
          .eq('id', (reservation as SupabaseReservation).pickup_hotel!)
          .single()

        return {
          ...(reservation as SupabaseReservation),
          pickup_hotels: hotelInfo
        }
      }

      return reservation
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

      if ((tourDetails as any)?.tour_guide_id) {
        const { data: guideData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email, languages')
          .eq('email', (tourDetails as any).tour_guide_id)
          .single()
        tourGuideInfo = guideData
      }

      if ((tourDetails as any)?.assistant_id) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('name_ko, name_en, phone, email')
          .eq('email', (tourDetails as any).assistant_id)
          .single()
        assistantInfo = assistantData
      }

      return {
        ...(tourDetails as any),
        tour_guide: tourGuideInfo,
        assistant: assistantInfo
      } as TourDetails
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
        .select('id, day_number, start_time, end_time, title_ko, title_en, description_ko, description_en, show_to_customers')
        .eq('product_id', productId)
        .eq('show_to_customers', true)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })

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
          getProductDetails(reservation.product_id),
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

  // 총 가격 계산
  const calculateTotalPrice = (reservation: Reservation) => {
    if (!reservation.products) return 0
    
    const basePrice = reservation.products.base_price || 0
    return basePrice * reservation.total_people
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
      <div className="container mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('back')}
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{t('myReservations')}</h1>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {t('simulating')}: {simulatedUser.name_ko}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    {t('dashboard')}
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                  >
                    {t('myInfo')}
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    {t('backToAdmin')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-gray-600">{t('checkReservationHistory')}</p>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{t('filterByStatus')}</span>
            <div className="flex space-x-2">
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
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
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
        <div className="space-y-6">
          {filteredReservations.length > 0 ? (
            filteredReservations.map((reservation) => (
              <div key={reservation.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {locale === 'ko' 
                        ? (reservation.products?.customer_name_ko || reservation.products?.name || t('noProductName'))
                        : (reservation.products?.customer_name_en || reservation.products?.name || t('noProductName'))
                      }
                    </h3>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                    {getStatusText(reservation.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {/* 투어 날짜 */}
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {new Date(reservation.tour_date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long'
                      })}
                    </span>
                  </div>

                  {/* 투어 시간 */}
                  {reservation.tour_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">{reservation.tour_time}</span>
                    </div>
                  )}

                  {/* 소요시간 */}
                  {reservation.products?.duration && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">{reservation.products.duration}{t('hours')}</span>
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

                  {/* 픽업 시간 */}
                  {reservation.pickup_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">{t('pickup')}: {reservation.pickup_time}</span>
                    </div>
                  )}

                  {/* 인원 */}
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {t('totalPeople', { total: reservation.total_people, adults: reservation.adults, children: reservation.child, infants: reservation.infant })}
                    </span>
                  </div>
                </div>

                {/* 가격 정보 */}
                {reservation.products && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{t('priceInfo')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>{t('totalPeople', { total: reservation.total_people, adults: reservation.adults, children: reservation.child, infants: reservation.infant })}</span>
                          <span>${(reservation.products.base_price || 0).toLocaleString()} {t('perPerson')}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-lg font-semibold text-gray-900 border-t border-gray-200 pt-2">
                        <span>{t('totalAmount')}</span>
                        <span className="flex items-center">
                          <CreditCard className="w-4 h-4 mr-1" />
                          ${calculateTotalPrice(reservation).toLocaleString()}
                        </span>
                      </div>
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
                          {reservation.multilingualDetails?.description && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('productDescription')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.description}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.slogan1 && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('highlights')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.slogan1}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.included && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('included')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.not_included && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('notIncluded')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.not_included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.pickup_drop_info && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('meetingPoint')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.pickup_drop_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.cancellation_policy && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">{t('cancellationPolicy')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.cancellation_policy}</p>
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
                        <div className="bg-green-50 p-4 rounded-lg space-y-3">
                          {reservationDetails[reservation.id]?.productSchedules!.map((schedule) => (
                            <div key={schedule.id} className="bg-white p-3 rounded-md border-l-4 border-green-500">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center mb-1">
                                    {schedule.start_time && (
                                      <span className="text-sm font-medium text-green-700 mr-2">
                                        {schedule.start_time}
                                        {schedule.end_time && ` - ${schedule.end_time}`}
                                      </span>
                                    )}
                                    <span className="text-sm font-semibold text-gray-900">
                                      {locale === 'ko' 
                                        ? (schedule.title_ko || schedule.title_en)
                                        : (schedule.title_en || schedule.title_ko)
                                      }
                                    </span>
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
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">{t('pickupTime')}</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id]?.pickupSchedule?.pickup_time}</p>
                            </div>
                            {reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels && (
                              <div>
                                <h5 className="font-medium text-gray-900 mb-2">{t('pickupHotel')}</h5>
                                <p className="text-sm text-gray-700">{reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels?.hotel}</p>
                                <p className="text-xs text-gray-600">{reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels?.pick_up_location}</p>
                                {reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels?.address && (
                                  <p className="text-xs text-gray-600">{reservationDetails[reservation.id]?.pickupSchedule?.pickup_hotels?.address}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
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

                          {/* 차량 정보는 현재 스키마에서 직접 연결되지 않으므로 제거 */}
                        </div>
                      </div>
                    )}
                  </div>

                {/* 예약 일시 */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs text-gray-500">
                    {t('reservationDate')}: {new Date(reservation.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                  </p>
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
    </div>
  )
}
