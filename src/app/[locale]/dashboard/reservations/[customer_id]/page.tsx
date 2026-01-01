'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, Clock, MapPin, Users, ArrowLeft, Filter, User, Phone, Mail, ExternalLink, Printer } from 'lucide-react'
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
  }
  pricing?: {
    total_price: number
    deposit_amount: number
    balance_amount: number
  }
  reservationChoices?: Array<{
    id: string
    choice_id: string
    option_id: string
    quantity: number
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
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  created_at: string
}

interface SupabaseCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  created_at: string
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
}

export default function CustomerReservations() {
  const { user, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const customerId = params.customer_id as string
  const t = useTranslations('common')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 프린트 함수
  const handlePrint = (reservation: Reservation) => {
    try {
      console.log('프린트 시작:', reservation.id)
      window.print()
    } catch (error) {
      console.error('프린트 오류:', error)
    }
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

  // 픽업 날짜 계산 함수
  const calculatePickupDate = (pickupTime: string, tourDate: string) => {
    if (!pickupTime || !tourDate) return tourDate
    
    const time = pickupTime.split(':')[0]
    const hour = parseInt(time, 10)
    
    // 오후 9시(21시) 이후이면 투어 날짜에서 1일 빼기
    if (hour >= 21) {
      let tourDateObj: Date
      
      if (tourDate.includes(',')) {
        tourDateObj = new Date(tourDate)
      } else if (tourDate.includes('-')) {
        tourDateObj = new Date(tourDate)
      } else {
        tourDateObj = new Date(tourDate)
      }
      
      if (isNaN(tourDateObj.getTime())) {
        console.warn('Invalid tour date:', tourDate)
        return tourDate
      }
      
      tourDateObj.setDate(tourDateObj.getDate() - 1)
      return tourDateObj.toISOString().split('T')[0]
    }
    
    return tourDate
  }

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

  // 특정 고객의 예약 정보 로드
  const loadCustomerReservations = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      console.log('고객 예약 조회 시작:', customerId)
      
      // 고객 정보 조회
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) {
        console.error('고객 정보 조회 오류:', customerError)
        setError(t('customerNotFound'))
        setLoading(false)
        return
      }

      if (!customerData) {
        setError(t('customerNotFound'))
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
        // 각 예약에 대해 기본 정보만 조회 (간단한 카드뷰용)
        const reservationsWithBasicInfo = await Promise.all(
          reservationsData.map(async (reservation: SupabaseReservation) => {
            try {
              // 상품 기본 정보만 조회
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name, customer_name_ko, customer_name_en, duration, base_price')
                .eq('id', reservation.product_id)
                .single()

              if (productError) {
                console.warn('상품 정보 조회 오류:', productError)
              }

              // 가격 정보만 조회
              let pricingInfo = null
              try {
                const { data: pricingData, error: pricingError } = await supabase
                  .from('reservation_pricing')
                  .select('total_price, deposit_amount, balance_amount')
                  .eq('reservation_id', reservation.id.toString())
                  .single()
                
                if (!pricingError) {
                  pricingInfo = pricingData
                }
              } catch (error) {
                console.warn('가격 정보 조회 실패:', error)
              }

              // 예약 선택사항만 조회
              let reservationChoicesInfo = null
              try {
                const { data: choicesData, error: choicesError } = await supabase
                  .from('reservation_choices')
                  .select('id, choice_id, option_id, quantity')
                  .eq('reservation_id', reservation.id.toString())
                
                if (!choicesError && choicesData && choicesData.length > 0) {
                  // choice와 option 정보 매핑
                  const choiceIds = [...new Set(choicesData.map((c: { choice_id: string }) => c.choice_id))]
                  const optionIds = [...new Set(choicesData.map((c: { option_id: string }) => c.option_id))]
                  
                  const { data: choicesData2 } = await supabase
                    .from('product_choices')
                    .select('id, choice_group, choice_group_ko')
                    .in('id', choiceIds)
                  
                  const { data: optionsData } = await supabase
                    .from('choice_options')
                    .select('id, option_key, option_name, option_name_ko')
                    .in('id', optionIds)
                  
                  if (choicesData2 && optionsData) {
                    reservationChoicesInfo = choicesData.map((choice: {
                      id: string
                      choice_id: string
                      option_id: string
                      quantity: number
                    }) => {
                      const choiceInfo = choicesData2.find((c: { id: string }) => c.id === choice.choice_id)
                      const optionInfo = optionsData.find((o: { id: string }) => o.id === choice.option_id)
                      
                      return {
                        ...choice,
                        choice: choiceInfo ? {
                          id: (choiceInfo as any).id,
                          name_ko: (choiceInfo as any).choice_group_ko,
                          name_en: (choiceInfo as any).choice_group
                        } : null,
                        option: optionInfo ? {
                          id: (optionInfo as any).id,
                          name_ko: (optionInfo as any).option_name_ko,
                          name_en: (optionInfo as any).option_name
                        } : null
                      }
                    })
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
                pricing: pricingInfo,
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
                pricing: null,
                reservationChoices: null
              } as unknown as Reservation
            }
          })
        )
        setReservations(reservationsWithBasicInfo)
      } else {
        setReservations([])
      }
    } catch (error) {
      console.error('예약 로드 중 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [customerId, t])

  useEffect(() => {
    loadCustomerReservations()
  }, [loadCustomerReservations])

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      setTimeout(() => {
        router.push(`/${locale}/admin`)
        window.location.href = `/${locale}/admin`
      }, 200)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      router.push(`/${locale}/admin`)
      window.location.href = `/${locale}/admin`
    }
  }

  // 상태별 필터링
  const filteredReservations = reservations.filter(reservation => {
    if (filter === 'all') return true
    return reservation.status === filter
  })

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

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('customerNotFound')}</h1>
          <button
            onClick={() => router.push(`/${locale}/dashboard/reservations`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('backToReservations')}
          </button>
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
                onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-3 sm:mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="text-sm sm:text-base">{t('back')}</span>
              </button>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                {customer.name} - {t('reservations')}
              </h1>
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
          <p className="text-sm sm:text-base text-gray-600">
            {customer.email} • {customer.phone || 'N/A'}
          </p>
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

        {/* 예약 목록 - 간단한 카드뷰 */}
        <div className="space-y-1 sm:space-y-4">
          {filteredReservations.length > 0 ? (
            filteredReservations.map((reservation) => (
              <div key={reservation.id} className="bg-white shadow-sm p-4 sm:p-6 rounded-none sm:rounded-lg hover:shadow-md transition-shadow">
                
                {/* 카드 헤더 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                        <button
                          onClick={() => router.push(`/${locale}/dashboard/reservations/${customerId}/${reservation.id}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {locale === 'ko' 
                            ? (reservation.products?.customer_name_ko || reservation.products?.name || t('noProductName'))
                            : (reservation.products?.customer_name_en || reservation.products?.name || t('noProductName'))
                          }
                        </button>
                      </h3>
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                        {getStatusText(reservation.status)}
                      </span>
                    </div>
                    
                    {/* Choice 옵션 뱃지 */}
                    {reservation.reservationChoices && reservation.reservationChoices.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(() => {
                          // 중복 제거: 같은 option_name을 가진 것들을 합침
                          const uniqueChoices = reservation.reservationChoices.reduce((acc: any[], choice: any) => {
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
                              existing.quantity += choice.quantity || 1;
                            } else {
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
                  
                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/${locale}/dashboard/reservations/${customerId}/${reservation.id}`)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {t('viewDetails')}
                    </button>
                    <button
                      onClick={() => handlePrint(reservation)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      {t('print')}
                    </button>
                  </div>
                </div>

                {/* 기본 정보 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* 투어 날짜 */}
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{reservation.tour_date}</span>
                    </div>
                  </div>

                  {/* 픽업 시간 */}
                  {reservation.pickup_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-blue-600">{formatTimeToAMPM(reservation.pickup_time)}</span>
                        {reservation.tour_date && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({calculatePickupDate(reservation.pickup_time, reservation.tour_date)})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 총 인원 */}
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{reservation.total_people} {t('people')}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        (A:{reservation.adults}, C:{reservation.child}, I:{reservation.infant})
                      </span>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  {reservation.pricing && (
                    <div className="flex items-center text-gray-600">
                      <div className="w-4 h-4 mr-2 flex-shrink-0 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-xs font-bold">$</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-green-600">
                          ${reservation.pricing.total_price?.toFixed(2) || '0.00'}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          (Deposit: ${reservation.pricing.deposit_amount?.toFixed(2) || '0.00'})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 픽업 호텔 정보 */}
                {reservation.pickup_hotel && (
                  <div className="flex items-center text-gray-600 mb-2">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">{reservation.pickup_hotel}</span>
                  </div>
                )}

                {/* 채널 정보 */}
                {reservation.channel_rn && (
                  <div className="flex items-center text-gray-600">
                    <ExternalLink className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-sm text-blue-600 font-medium">
                      #{reservation.channel_rn}
                    </span>
                  </div>
                )}
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
                onClick={() => router.push(`/${locale}/products`)}
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
