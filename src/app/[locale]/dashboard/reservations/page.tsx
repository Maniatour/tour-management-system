'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, Clock, MapPin, Users, CreditCard, ArrowLeft, Filter, ChevronDown, ChevronUp, User, Phone, Car } from 'lucide-react'
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
    description: string | null
    duration: number | null
    adult_price: number | null
    child_price: number | null
    infant_price: number | null
  }
}

export default function CustomerReservations() {
  const { user, userRole, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<any>(null)
  const [expandedReservations, setExpandedReservations] = useState<Set<string>>(new Set())
  const [reservationDetails, setReservationDetails] = useState<Record<string, any>>({})

  // 예약 상세 정보 토글
  const toggleReservationDetails = async (reservationId: string) => {
    const isExpanded = expandedReservations.has(reservationId)
    
    if (isExpanded) {
      // 축소
      setExpandedReservations(prev => {
        const newSet = new Set(prev)
        newSet.delete(reservationId)
        return newSet
      })
    } else {
      // 확장 - 상세 정보 로드
      setExpandedReservations(prev => new Set(prev).add(reservationId))
      
      // 상세 정보가 아직 로드되지 않은 경우에만 로드
      if (!reservationDetails[reservationId]) {
        const reservation = reservations.find(r => r.id === reservationId)
        if (reservation) {
          const [productDetails, pickupSchedule, tourDetails] = await Promise.all([
            getProductDetails(reservation.product_id),
            getPickupSchedule(reservationId),
            getTourDetails(reservationId)
          ])
          
          setReservationDetails(prev => ({
            ...prev,
            [reservationId]: {
              productDetails,
              pickupSchedule,
              tourDetails
            }
          }))
        }
      }
    }
  }

  // 인증 확인 (시뮬레이션 상태 우선 확인)
  useEffect(() => {
    // 시뮬레이션 중인 경우 인증 체크 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('Reservations: Simulation active, skipping authentication check')
      return
    }
    
    if (!user) {
      router.push(`/${locale}/auth`)
      return
    }
  }, [user, isSimulating, simulatedUser, router, locale])

  // 데이터 로딩 (시뮬레이션 상태와 분리)
  useEffect(() => {
    // 시뮬레이션 중이 아닌 경우에만 고객 데이터 로드
    if (!isSimulating && user) {
      loadReservations()
    } else if (isSimulating && simulatedUser && simulatedUser.id) {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보로 설정
      console.log('Reservations: Loading simulated customer data:', simulatedUser)
      setCustomer({
        id: simulatedUser.id,
        name: simulatedUser.name_ko,
        email: simulatedUser.email,
        phone: simulatedUser.phone,
        language: simulatedUser.language,
        created_at: simulatedUser.created_at
      })
      
      // 시뮬레이션된 사용자의 예약 정보 로드
      loadSimulatedReservations(simulatedUser.id)
    } else if (isSimulating && !simulatedUser) {
      // 시뮬레이션 중이지만 simulatedUser가 없는 경우
      console.warn('Reservations: 시뮬레이션 중이지만 simulatedUser가 없습니다.')
      setLoading(false)
    }
  }, [isSimulating, simulatedUser, user])

  // 예약 정보 로드
  const loadReservations = async () => {
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
        console.error('고객 정보 조회 오류:', {
          error: customerError,
          message: customerError?.message || 'Unknown error',
          code: customerError?.code || 'No code',
          details: customerError?.details || 'No details',
          hint: customerError?.hint || 'No hint',
          status: customerError?.status || 'No status',
          email: authUser.email
        })
        // 406 오류나 다른 권한 오류의 경우 빈 상태로 설정
        if (customerError.code === 'PGRST116' || customerError.code === 'PGRST301' || customerError.status === 406) {
          setCustomer(null)
          setReservations([])
          setLoading(false)
          return
        }
        // 다른 오류의 경우에도 빈 상태로 설정
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
          .eq('customer_id', customerData.id)
          .order('tour_date', { ascending: false })

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', {
            error: reservationsError,
            message: reservationsError?.message || 'Unknown error',
            code: reservationsError?.code || 'No code',
            details: reservationsError?.details || 'No details',
            customer_id: customerData.id
          })
          setReservations([])
        } else if (reservationsData && reservationsData.length > 0) {
          // 각 예약에 대해 상품 정보를 별도로 조회
          const reservationsWithProducts = await Promise.all(
            reservationsData.map(async (reservation) => {
              try {
                const { data: productData, error: productError } = await supabase
                  .from('products')
                  .select('name, description, duration, adult_price, child_price, infant_price')
                  .eq('id', reservation.product_id)
                  .single()

                if (productError) {
                  console.warn('상품 정보 조회 오류:', {
                    error: productError,
                    message: productError?.message || 'Unknown error',
                    code: productError?.code || 'No code',
                    product_id: reservation.product_id,
                    reservation_id: reservation.id
                  })
                }

                return {
                  ...reservation,
                  products: productData || { 
                    name: '상품명 없음', 
                    description: null, 
                    duration: null, 
                    base_price: null
                  }
                }
              } catch (error) {
                console.error('상품 정보 조회 중 예외:', error)
                return {
                  ...reservation,
                  products: { 
                    name: '상품명 없음', 
                    description: null, 
                    duration: null, 
                    adult_price: null, 
                    child_price: null, 
                    infant_price: null 
                  }
                }
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
      console.error('데이터 로드 오류:', error)
      setCustomer(null)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  // 시뮬레이션된 사용자의 예약 정보 로드
  const loadSimulatedReservations = async (customerId: string) => {
    if (!customerId) {
      console.error('고객 ID가 없습니다.')
      setReservations([])
      setLoading(false)
      return
    }

    try {
      // 먼저 예약 정보만 조회
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('customer_id', customerId)
        .order('tour_date', { ascending: false })

      if (reservationsError) {
        console.error('시뮬레이션 예약 정보 조회 오류:', reservationsError)
        setReservations([])
        setLoading(false)
        return
      }

      if (reservationsData && reservationsData.length > 0) {
        // 각 예약에 대해 상품 정보를 별도로 조회
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation) => {
            try {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name, description, duration, base_price')
                .eq('id', reservation.product_id)
                .single()

              if (productError) {
                console.warn('시뮬레이션 상품 정보 조회 오류:', {
                  error: productError,
                  message: productError?.message || 'Unknown error',
                  code: productError?.code || 'No code',
                  product_id: reservation.product_id,
                  reservation_id: reservation.id
                })
              }

              return {
                ...reservation,
                products: productData || { 
                  name: '상품명 없음', 
                  description: null, 
                  duration: null, 
                  base_price: null
                }
              }
            } catch (error) {
              console.error('시뮬레이션 상품 정보 조회 중 예외:', error)
              return {
                ...reservation,
                products: { 
                  name: '상품명 없음', 
                  description: null, 
                  duration: null, 
                  base_price: null
                }
              }
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
  }

  // 상품 세부 정보 가져오기
  const getProductDetails = async (productId: string) => {
    try {
      const { data: productDetails, error } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('language_code', 'ko')
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
  }

  // 픽업 스케줄 정보 가져오기
  const getPickupSchedule = async (reservationId: string) => {
    try {
      const { data: pickupSchedule, error } = await supabase
        .from('pickup_schedules')
        .select(`
          *,
          pickup_hotels (
            hotel_name,
            pick_up_location,
            address,
            description_ko
          )
        `)
        .eq('reservation_id', reservationId)
        .single()

      if (error) {
        console.warn('픽업 스케줄 조회 오류:', error)
        return null
      }

      return pickupSchedule
    } catch (error) {
      console.error('픽업 스케줄 조회 중 예외:', error)
      return null
    }
  }

  // 투어 상세 정보 가져오기
  const getTourDetails = async (reservationId: string) => {
    try {
      // reservation_ids에서 tour_id 찾기
      const { data: reservationIds, error: reservationIdsError } = await supabase
        .from('reservation_ids')
        .select('tour_id')
        .eq('reservation_id', reservationId)
        .single()

      if (reservationIdsError || !reservationIds) {
        console.warn('예약 ID 조회 오류:', reservationIdsError)
        return null
      }

      // tour_id로 투어 상세 정보 조회
      const { data: tourDetails, error: tourError } = await supabase
        .from('tours')
        .select(`
          *,
          guides (
            name,
            phone,
            email,
            languages
          ),
          assistants (
            name,
            phone,
            email
          ),
          vehicles (
            type,
            capacity,
            license_plate,
            driver_name,
            driver_phone
          )
        `)
        .eq('id', reservationIds.tour_id)
        .single()

      if (tourError) {
        console.warn('투어 상세 정보 조회 오류:', tourError)
        return null
      }

      return tourDetails
    } catch (error) {
      console.error('투어 상세 정보 조회 중 예외:', error)
      return null
    }
  }

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

  // 상태 한글 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'confirmed': return '확정'
      case 'completed': return '완료'
      case 'cancelled': return '취소'
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
    
    const adultPrice = reservation.products.adult_price || 0
    const childPrice = reservation.products.child_price || 0
    const infantPrice = reservation.products.infant_price || 0
    
    return (adultPrice * reservation.adults) + 
           (childPrice * reservation.child) + 
           (infantPrice * reservation.infant)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">고객 정보가 없습니다</h2>
          <p className="text-gray-600 mb-4">먼저 고객 정보를 등록해주세요.</p>
          <button
            onClick={() => router.push('/dashboard/profile')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            프로필 등록하기
          </button>
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
                뒤로
              </button>
              <h1 className="text-2xl font-bold text-gray-900">내 예약</h1>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    대시보드
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                  >
                    내 정보
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    관리자로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-gray-600">투어 예약 내역을 확인하세요.</p>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">상태별 필터:</span>
            <div className="flex space-x-2">
              {[
                { value: 'all', label: '전체' },
                { value: 'pending', label: '대기중' },
                { value: 'confirmed', label: '확정' },
                { value: 'completed', label: '완료' },
                { value: 'cancelled', label: '취소' }
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
                      {reservation.products?.name || '상품명 없음'}
                    </h3>
                    {reservation.products?.description && (
                      <p className="text-gray-600 mb-4">{reservation.products.description}</p>
                    )}
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
                      {new Date(reservation.tour_date).toLocaleDateString('ko-KR', {
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
                      <span className="text-sm">{reservation.products.duration}시간</span>
                    </div>
                  )}

                  {/* 픽업 호텔 */}
                  {reservation.pickup_hotel && (
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-sm">{reservation.pickup_hotel}</span>
                    </div>
                  )}

                  {/* 픽업 시간 */}
                  {reservation.pickup_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">픽업: {reservation.pickup_time}</span>
                    </div>
                  )}

                  {/* 인원 */}
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      총 {reservation.total_people}명 (성인 {reservation.adults}명, 어린이 {reservation.child}명, 유아 {reservation.infant}명)
                    </span>
                  </div>
                </div>

                {/* 가격 정보 */}
                {reservation.products && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">가격 정보</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 text-sm text-gray-600">
                        {reservation.adults > 0 && reservation.products.adult_price && (
                          <div className="flex justify-between">
                            <span>성인 {reservation.adults}명</span>
                            <span>${(reservation.products.adult_price * reservation.adults).toLocaleString()}</span>
                          </div>
                        )}
                        {reservation.child > 0 && reservation.products.child_price && (
                          <div className="flex justify-between">
                            <span>어린이 {reservation.child}명</span>
                            <span>${(reservation.products.child_price * reservation.child).toLocaleString()}</span>
                          </div>
                        )}
                        {reservation.infant > 0 && reservation.products.infant_price && (
                          <div className="flex justify-between">
                            <span>유아 {reservation.infant}명</span>
                            <span>${(reservation.products.infant_price * reservation.infant).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-lg font-semibold text-gray-900 border-t border-gray-200 pt-2">
                        <span>총 금액</span>
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
                    <h4 className="text-sm font-medium text-gray-900 mb-2">특이사항</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                      {reservation.event_note}
                    </p>
                  </div>
                )}

                {/* 상세 정보 토글 버튼 */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    onClick={() => toggleReservationDetails(reservation.id)}
                    className="flex items-center justify-center w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    {expandedReservations.has(reservation.id) ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        상세 정보 숨기기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        상세 정보 보기
                      </>
                    )}
                  </button>
                </div>

                {/* 확장된 상세 정보 */}
                {expandedReservations.has(reservation.id) && (
                  <div className="border-t border-gray-200 pt-6 mt-4 space-y-6">
                    {/* 상품 세부 정보 */}
                    {reservationDetails[reservation.id]?.productDetails && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <MapPin className="w-5 h-5 mr-2" />
                          상품 세부 정보
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          {reservationDetails[reservation.id].productDetails.description && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">상품 설명</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.description}</p>
                            </div>
                          )}
                          {reservationDetails[reservation.id].productDetails.highlights && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">하이라이트</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.highlights}</p>
                            </div>
                          )}
                          {reservationDetails[reservation.id].productDetails.included && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">포함 사항</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.included}</p>
                            </div>
                          )}
                          {reservationDetails[reservation.id].productDetails.not_included && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">불포함 사항</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.not_included}</p>
                            </div>
                          )}
                          {reservationDetails[reservation.id].productDetails.meeting_point && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">만남 장소</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.meeting_point}</p>
                            </div>
                          )}
                          {reservationDetails[reservation.id].productDetails.cancellation_policy && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-1">취소 정책</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].productDetails.cancellation_policy}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 픽업 스케줄 */}
                    {reservationDetails[reservation.id]?.pickupSchedule && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Clock className="w-5 h-5 mr-2" />
                          픽업 스케줄
                        </h4>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">픽업 시간</h5>
                              <p className="text-sm text-gray-700">{reservationDetails[reservation.id].pickupSchedule.pickup_time}</p>
                            </div>
                            {reservationDetails[reservation.id].pickupSchedule.pickup_hotels && (
                              <div>
                                <h5 className="font-medium text-gray-900 mb-2">픽업 호텔</h5>
                                <p className="text-sm text-gray-700">{reservationDetails[reservation.id].pickupSchedule.pickup_hotels.hotel_name}</p>
                                <p className="text-xs text-gray-600">{reservationDetails[reservation.id].pickupSchedule.pickup_hotels.pick_up_location}</p>
                                {reservationDetails[reservation.id].pickupSchedule.pickup_hotels.address && (
                                  <p className="text-xs text-gray-600">{reservationDetails[reservation.id].pickupSchedule.pickup_hotels.address}</p>
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
                          투어 상세 정보
                        </h4>
                        <div className="bg-green-50 p-4 rounded-lg space-y-4">
                          {/* 가이드 정보 */}
                          {reservationDetails[reservation.id].tourDetails.guides && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                가이드
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">{reservationDetails[reservation.id].tourDetails.guides.name}</p>
                                {reservationDetails[reservation.id].tourDetails.guides.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {reservationDetails[reservation.id].tourDetails.guides.phone}
                                  </p>
                                )}
                                {reservationDetails[reservation.id].tourDetails.guides.languages && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    언어: {reservationDetails[reservation.id].tourDetails.guides.languages}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 어시스턴트 정보 */}
                          {reservationDetails[reservation.id].tourDetails.assistants && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                어시스턴트
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">{reservationDetails[reservation.id].tourDetails.assistants.name}</p>
                                {reservationDetails[reservation.id].tourDetails.assistants.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {reservationDetails[reservation.id].tourDetails.assistants.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 차량 정보 */}
                          {reservationDetails[reservation.id].tourDetails.vehicles && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                차량
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">{reservationDetails[reservation.id].tourDetails.vehicles.type}</p>
                                <p className="text-xs text-gray-600">정원: {reservationDetails[reservation.id].tourDetails.vehicles.capacity}명</p>
                                {reservationDetails[reservation.id].tourDetails.vehicles.license_plate && (
                                  <p className="text-xs text-gray-600">번호판: {reservationDetails[reservation.id].tourDetails.vehicles.license_plate}</p>
                                )}
                                {reservationDetails[reservation.id].tourDetails.vehicles.driver_name && (
                                  <p className="text-xs text-gray-600">기사: {reservationDetails[reservation.id].tourDetails.vehicles.driver_name}</p>
                                )}
                                {reservationDetails[reservation.id].tourDetails.vehicles.driver_phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {reservationDetails[reservation.id].tourDetails.vehicles.driver_phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 예약 일시 */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs text-gray-500">
                    예약 일시: {new Date(reservation.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">예약 내역이 없습니다</h3>
              <p className="text-gray-500 mb-6">
                {filter === 'all' 
                  ? '아직 예약한 투어가 없습니다.' 
                  : `${getStatusText(filter)} 상태의 예약이 없습니다.`
                }
              </p>
              <button
                onClick={() => router.push('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                투어 상품 보기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
