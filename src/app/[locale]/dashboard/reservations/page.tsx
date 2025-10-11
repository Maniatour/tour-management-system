'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, Clock, MapPin, Users, CreditCard, ArrowLeft, Filter } from 'lucide-react'
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
  const { user, userRole, authUser, simulatedUser, isSimulating } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<any>(null)

  // 인증 확인
  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }

    loadReservations()
  }, [user, userRole, router])

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
        console.error('고객 정보 조회 오류:', customerError)
        // 406 오류나 다른 권한 오류의 경우 빈 상태로 설정
        if (customerError.code === 'PGRST116' || customerError.code === 'PGRST301' || customerError.status === 406) {
          setCustomer(null)
          setReservations([])
          setLoading(false)
          return
        }
        setLoading(false)
        return
      }

      if (customerData) {
        setCustomer(customerData)
        
        // 고객의 예약 정보 조회
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select(`
            *,
            products (
              name,
              description,
              duration,
              adult_price,
              child_price,
              infant_price
            )
          `)
          .eq('customer_id', customerData.id)
          .order('tour_date', { ascending: false })

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', reservationsError)
          setReservations([])
        } else {
          setReservations(reservationsData || [])
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
