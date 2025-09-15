'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, Search, Calendar, MapPin, Users, Grid3X3, CalendarDays, Play } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import CustomerForm from '@/components/CustomerForm'
import ReservationForm from '@/components/reservation/ReservationForm'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import ReservationCalendar from '@/components/ReservationCalendar'
import { useReservationData } from '@/hooks/useReservationData'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  getStatusLabel, 
  getStatusColor, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'
import type { 
  Customer, 
  Reservation 
} from '@/types/reservation'

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ }: AdminReservationsProps) {
  const t = useTranslations('reservations')
  const router = useRouter()
  const routeParams = useParams() as { locale?: string }
  const locale = routeParams?.locale || 'ko'
  
  // 커스텀 훅으로 데이터 관리
  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
    options,
    pickupHotels,
    coupons,
    loading,
    loadingProgress,
    refreshReservations,
    refreshCustomers
  } = useReservationData()

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'calendar'>('card')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [pricingModalReservation, setPricingModalReservation] = useState<Reservation | null>(null)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // 주간 페이지네이션 상태
  const [currentWeek, setCurrentWeek] = useState(0) // 0은 현재 주, 음수는 이전 주, 양수는 다음 주
  
  // 고급 필터링 상태
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''})
  const [sortBy, setSortBy] = useState<'created_at' | 'tour_date' | 'customer_name' | 'product_name'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [groupByDate, setGroupByDate] = useState<boolean>(true) // 기본값을 true로 설정하여 날짜별 그룹화
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 그룹 접기/펼치기 함수
  const toggleGroupCollapse = (date: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  // 주간 통계 아코디언 상태
  const [isWeeklyStatsCollapsed, setIsWeeklyStatsCollapsed] = useState(false)

  // 검색어에 따른 그룹화 상태 조정
  useEffect(() => {
    if (searchTerm.trim()) {
      // 검색어가 있을 때는 그룹화 해제
      setGroupByDate(false)
    } else {
      // 검색어가 없을 때는 그룹화 활성화
      setGroupByDate(true)
    }
  }, [searchTerm])

  // 필터링 및 정렬 로직
  const filteredAndSortedReservations = useCallback(() => {
    const filtered = reservations.filter(reservation => {
      // 검색 조건 - 검색어가 있을 때만 검색 수행
      const matchesSearch = !searchTerm || 
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.channelRN.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(reservation.customerId, customers as Customer[]).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProductName(reservation.productId, products).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getChannelName(reservation.channelId, channels).toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.tourDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.tourTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.pickUpHotel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.addedBy.toLowerCase().includes(searchTerm.toLowerCase())
    
      // 상태 필터
    const matchesStatus = selectedStatus === 'all' || reservation.status === selectedStatus
      
      // 채널 필터
      const matchesChannel = selectedChannel === 'all' || reservation.channelId === selectedChannel
      
      // 날짜 범위 필터 - 빈 날짜 범위일 때는 모든 데이터 표시
      let matchesDateRange = true
      if (dateRange.start && dateRange.end) {
        const tourDate = new Date(reservation.tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        // 날짜가 유효한 경우에만 필터링 적용
        if (!isNaN(tourDate.getTime()) && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          matchesDateRange = tourDate >= startDate && tourDate <= endDate
        }
      }
      
      return matchesSearch && matchesStatus && matchesChannel && matchesDateRange
    })
    
    // 정렬
    filtered.sort((a, b) => {
      let aValue: string | Date, bValue: string | Date
      
      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.addedTime)
          bValue = new Date(b.addedTime)
          break
        case 'tour_date':
          aValue = new Date(a.tourDate)
          bValue = new Date(b.tourDate)
          break
        case 'customer_name':
          aValue = getCustomerName(a.customerId, customers as Customer[])
          bValue = getCustomerName(b.customerId, customers as Customer[])
          break
        case 'product_name':
          aValue = getProductName(a.productId, products)
          bValue = getProductName(b.productId, products)
          break
        default:
          aValue = new Date(a.addedTime)
          bValue = new Date(b.addedTime)
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
    
    return filtered
  }, [reservations, customers, products, channels, searchTerm, selectedStatus, selectedChannel, dateRange, sortBy, sortOrder])
  
  const filteredReservations = filteredAndSortedReservations()
  
  // 주간 페이지네이션을 위한 유틸리티 함수들
  const getWeekStartDate = useCallback((weekOffset: number) => {
    const now = new Date()
    const currentDay = now.getDay() // 0 = 일요일, 1 = 월요일, ..., 6 = 토요일
    const daysToSubtract = currentDay // 일요일부터 시작하므로 현재 요일만큼 빼기
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysToSubtract + (weekOffset * 7))
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }, [])

  const getWeekEndDate = useCallback((weekOffset: number) => {
    const weekStart = getWeekStartDate(weekOffset)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    return weekEnd
  }, [getWeekStartDate])

  const formatWeekRange = useCallback((weekOffset: number) => {
    const weekStart = getWeekStartDate(weekOffset)
    const weekEnd = getWeekEndDate(weekOffset)
    return {
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
      display: `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
    }
  }, [getWeekStartDate, getWeekEndDate])

  // 날짜별 그룹화 로직 (created_at 기준) - 주간 페이지네이션 적용
  const groupedReservations = useMemo(() => {
    if (!groupByDate) {
      return { 'all': filteredReservations }
    }
    
    const groups: { [key: string]: typeof filteredReservations } = {}
    
    // 현재 주의 날짜 범위 계산
    const weekRange = formatWeekRange(currentWeek)
    const weekStart = new Date(weekRange.start)
    const weekEnd = new Date(weekRange.end)
    
    filteredReservations.forEach(reservation => {
      // created_at 날짜를 라스베가스 현지 시간으로 변환하여 YYYY-MM-DD 형식으로 변환
      const utcDate = new Date(reservation.addedTime)
      const lasVegasDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
      const createdDate = lasVegasDate.toISOString().split('T')[0]
      
      // 현재 주 범위에 포함되는지 확인
      const reservationDate = new Date(createdDate)
      if (reservationDate >= weekStart && reservationDate <= weekEnd) {
        if (!groups[createdDate]) {
          groups[createdDate] = []
        }
        groups[createdDate].push(reservation)
      }
    })
    
    // 날짜별로 정렬 (최신 날짜부터)
    const sortedGroups: { [key: string]: typeof filteredReservations } = {}
    Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(date => {
        sortedGroups[date] = groups[date]
      })
    
    return sortedGroups
  }, [filteredReservations, groupByDate, currentWeek, formatWeekRange])

  // 주간 통계 데이터 계산
  const weeklyStats = useMemo(() => {
    const allReservations = Object.values(groupedReservations).flat()
    
    // 상품별 인원 통계
    const productStats = allReservations.reduce((groups, reservation) => {
      const productName = getProductName(reservation.productId, products)
      if (!groups[productName]) {
        groups[productName] = 0
      }
      groups[productName] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    // 채널별 인원 통계
    const channelStats = allReservations.reduce((groups, reservation) => {
      const channelName = getChannelName(reservation.channelId, channels)
      if (!groups[channelName]) {
        groups[channelName] = 0
      }
      groups[channelName] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    // 상태별 인원 통계
    const statusStats = allReservations.reduce((groups, reservation) => {
      const status = reservation.status
      if (!groups[status]) {
        groups[status] = 0
      }
      groups[status] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    return {
      productStats: Object.entries(productStats).sort(([,a], [,b]) => b - a),
      channelStats: Object.entries(channelStats).sort(([,a], [,b]) => b - a),
      statusStats: Object.entries(statusStats).sort(([,a], [,b]) => b - a),
      totalReservations: allReservations.length,
      totalPeople: allReservations.reduce((total, reservation) => total + reservation.totalPeople, 0)
    }
  }, [groupedReservations, products, channels])
  
  // 페이지네이션 계산 (그룹화되지 않은 경우에만)
  const totalPages = groupByDate ? 1 : Math.ceil(filteredReservations.length / itemsPerPage)
  const startIndex = groupByDate ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = groupByDate ? filteredReservations.length : startIndex + itemsPerPage
  const paginatedReservations = groupByDate ? filteredReservations : filteredReservations.slice(startIndex, endIndex)

  // 달력뷰용 데이터 변환
  const calendarReservations = useMemo(() => {
    return filteredReservations.map(reservation => ({
      id: reservation.id,
      product_id: reservation.productId,
      product_name: getProductName(reservation.productId, products),
      tour_date: reservation.tourDate,
      tour_status: reservation.status,
      tour_time: reservation.tourTime,
      pickup_hotel: reservation.pickUpHotel,
      pickup_time: reservation.pickUpTime,
      adults: reservation.adults,
      child: reservation.child,
      infant: reservation.infant,
      total_people: reservation.totalPeople,
      customer_name: getCustomerName(reservation.customerId, customers as Customer[]),
      channel_name: getChannelName(reservation.channelId, channels),
      created_at: reservation.addedTime,
      total_price: calculateTotalPrice(reservation, products, optionChoices)
    }))
  }, [filteredReservations, products, customers, channels, optionChoices])

  const handleAddReservation = async (reservation: Omit<Reservation, 'id'>) => {
    try {
      // Supabase에 저장할 데이터 준비
      // tour_id는 먼저 null로 설정하고, 투어 생성 후 업데이트
      const reservationData = {
        customer_id: reservation.customerId,
        product_id: reservation.productId,
        tour_date: reservation.tourDate,
        tour_time: reservation.tourTime || null, // 빈 문자열을 null로 변환
        event_note: reservation.eventNote,
        pickup_hotel: reservation.pickUpHotel,
        pickup_time: reservation.pickUpTime || null, // 빈 문자열을 null로 변환
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        total_people: reservation.totalPeople,
        channel_id: reservation.channelId,
        channel_rn: reservation.channelRN,
        added_by: reservation.addedBy,
        tour_id: null, // 먼저 null로 설정
        status: reservation.status,
        selected_options: reservation.selectedOptions,
        selected_option_prices: reservation.selectedOptionPrices,
        is_private_tour: reservation.isPrivateTour || false
      }

      const { data: newReservation, error } = await supabase
        .from('reservations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(reservationData as any)
        .select()
        .single()

      if (error) {
        console.error('Error adding reservation:', error)
        alert('예약 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('New reservation created with ID:', (newReservation as any)?.id)
      console.log('Full reservation data:', newReservation)

      // 투어 자동 생성 또는 업데이트
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (newReservation && (newReservation as any).id) {
        try {
          const tourResult = await autoCreateOrUpdateTour(
            reservation.productId,
            reservation.tourDate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newReservation as any).id,
            reservation.isPrivateTour
          )
          
          if (tourResult.success && tourResult.tourId) {
            console.log('Tour created/updated successfully:', tourResult.tourId)
          } else {
            console.warn('Tour creation failed:', tourResult.message)
          }
        } catch (tourError) {
          console.error('Error in tour auto-creation:', tourError)
        }
      }

      // selected_options는 reservations 테이블의 selected_options 컬럼에 저장됨
      // 별도의 reservation_options 테이블 저장은 현재 비활성화

      // 가격 정보는 현재 reservations 테이블의 selected_option_prices 컬럼에 저장됨
      // 별도의 reservation_pricing 테이블 저장은 현재 비활성화


      // 성공 시 예약 목록 새로고침
      await refreshReservations()
      setShowAddForm(false)
      alert('예약이 성공적으로 추가되었습니다!')
    } catch (error) {
      console.error('Error adding reservation:', error)
      alert('예약 추가 중 오류가 발생했습니다.')
    }
  }

  const handleEditReservation = async (reservation: Omit<Reservation, 'id'>) => {
    if (editingReservation) {
      try {
        // Supabase에 저장할 데이터 준비
        const reservationData = {
          customer_id: reservation.customerId,
          product_id: reservation.productId,
          tour_date: reservation.tourDate,
          tour_time: reservation.tourTime || null, // 빈 문자열을 null로 변환
          event_note: reservation.eventNote,
          pickup_hotel: reservation.pickUpHotel,
          pickup_time: reservation.pickUpTime || null, // 빈 문자열을 null로 변환
          adults: reservation.adults,
          child: reservation.child,
          infant: reservation.infant,
          total_people: reservation.totalPeople,
          channel_id: reservation.channelId,
          channel_rn: reservation.channelRN,
          added_by: reservation.addedBy,
          tour_id: reservation.tourId,
          status: reservation.status,
          selected_options: reservation.selectedOptions,
          selected_option_prices: reservation.selectedOptionPrices,
          is_private_tour: reservation.isPrivateTour || false
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('reservations')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(reservationData as any)
          .eq('id', editingReservation.id)

        if (error) {
          console.error('Error updating reservation:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          alert('예약 수정 중 오류가 발생했습니다: ' + error.message)
          return
        }

        // 가격 정보가 있으면 업데이트 또는 삽입
        if (reservation.pricingInfo) {
          try {
            const pricingData = {
              reservation_id: editingReservation.id,
              adult_product_price: reservation.pricingInfo.adultProductPrice,
              child_product_price: reservation.pricingInfo.childProductPrice,
              infant_product_price: reservation.pricingInfo.infantProductPrice,
              product_price_total: reservation.pricingInfo.productPriceTotal,
              required_options: reservation.pricingInfo.requiredOptions,
              required_option_total: reservation.pricingInfo.requiredOptionTotal,
              subtotal: reservation.pricingInfo.subtotal,
              coupon_code: reservation.pricingInfo.couponCode,
              coupon_discount: reservation.pricingInfo.couponDiscount,
              additional_discount: reservation.pricingInfo.additionalDiscount,
              additional_cost: reservation.pricingInfo.additionalCost,
              card_fee: reservation.pricingInfo.cardFee,
              tax: reservation.pricingInfo.tax,
              prepayment_cost: reservation.pricingInfo.prepaymentCost,
              prepayment_tip: reservation.pricingInfo.prepaymentTip,
              selected_options: reservation.pricingInfo.selectedOptionalOptions,
              option_total: reservation.pricingInfo.optionTotal,
              total_price: reservation.pricingInfo.totalPrice,
              deposit_amount: reservation.pricingInfo.depositAmount,
              balance_amount: reservation.pricingInfo.balanceAmount,
            private_tour_additional_cost: reservation.pricingInfo.privateTourAdditionalCost,
            commission_percent: reservation.pricingInfo.commission_percent || 0
            }

            // upsert를 사용하여 기존 레코드가 있으면 업데이트, 없으면 삽입
            const { error: pricingError } = await supabase
              .from('reservation_pricing')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .upsert(pricingData as any, { 
                onConflict: 'reservation_id',
                ignoreDuplicates: false 
              })

            if (pricingError) {
              console.error('Error saving pricing info:', pricingError)
              // 가격 정보 저장 실패는 예약 수정 성공에 영향을 주지 않음
            } else {
              console.log('가격 정보가 성공적으로 저장되었습니다.')
            }
          } catch (pricingError) {
            console.error('Error saving pricing info:', pricingError)
          }
        }

        // Mania Tour 또는 Mania Service인 경우 자동으로 투어 생성 또는 업데이트
        try {
          const tourResult = await autoCreateOrUpdateTour(
            reservation.productId,
            reservation.tourDate,
            editingReservation.id,
            reservation.isPrivateTour
          )
          
          if (tourResult.success) {
            console.log('투어 자동 생성/업데이트 성공:', tourResult.message)
          } else {
            console.warn('투어 자동 생성/업데이트 실패:', tourResult.message)
            // 투어 생성 실패는 예약 수정 성공에 영향을 주지 않음
          }
        } catch (tourError) {
          console.error('투어 자동 생성/업데이트 중 예상치 못한 오류:', tourError)
          // 투어 생성 실패는 예약 수정 성공에 영향을 주지 않음
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        setEditingReservation(null)
        alert('예약이 성공적으로 수정되었습니다!')
      } catch (error) {
        console.error('Error updating reservation:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          error: error
        })
        alert('예약 수정 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
      }
    }
  }

  // 예약 편집 모달 열기
  const handleEditReservationClick = (reservation: Reservation) => {
    setEditingReservation(reservation)
  }


  // 투어 존재 여부 확인 함수
  const checkTourExists = async (productId: string, tourDate: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('id')
        .eq('product_id', productId)
        .eq('tour_date', tourDate)
        .limit(1)

      if (error) {
        console.error('Error checking tour existence:', error)
        return false
      }

      return data && data.length > 0
    } catch (error) {
      console.error('Error checking tour existence:', error)
      return false
    }
  }

  // 투어 생성 함수
  const handleCreateTour = async (reservation: Reservation) => {
    try {
      // 먼저 투어가 실제로 존재하는지 다시 한번 확인
      const tourExists = await checkTourExists(reservation.productId, reservation.tourDate)
      
      if (tourExists) {
        alert('해당 날짜에 이미 투어가 존재합니다.')
        // 예약 목록 새로고침하여 최신 상태 반영
        await refreshReservations()
        return
      }

      const result = await autoCreateOrUpdateTour(
        reservation.productId,
        reservation.tourDate,
        reservation.id,
        reservation.isPrivateTour
      )

      if (result.success) {
        alert('투어가 성공적으로 생성되었습니다!')
        // 예약 목록 새로고침
        await refreshReservations()
      } else {
        alert('투어 생성 중 오류가 발생했습니다: ' + result.message)
      }
    } catch (error) {
      console.error('Error creating tour:', error)
      alert('투어 생성 중 오류가 발생했습니다.')
    }
  }

  // 달력뷰에서 예약 클릭 시 편집 모달 열기
  const handleCalendarReservationClick = (calendarReservation: { id: string }) => {
    const originalReservation = reservations.find(r => r.id === calendarReservation.id)
    if (originalReservation) {
      setEditingReservation(originalReservation)
    }
  }

  // 가격 정보 모달 열기
  const handlePricingInfoClick = (reservation: Reservation) => {
    setPricingModalReservation(reservation)
    setShowPricingModal(true)
  }

  // 가격 정보 모달 닫기
  const handleClosePricingModal = () => {
    setShowPricingModal(false)
    setPricingModalReservation(null)
  }

  const handleDeleteReservation = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting reservation:', error)
          alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
          return
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        alert('예약이 성공적으로 삭제되었습니다!')
      } catch (error) {
        console.error('Error deleting reservation:', error)
        alert('예약 삭제 중 오류가 발생했습니다.')
      }
    }
  }

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // Supabase에 저장
      const { data, error } = await supabase
        .from('customers')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(customerData as any)
        .select()

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 고객 목록 새로고침
      await refreshCustomers()
      setShowCustomerForm(false)
      alert('고객이 성공적으로 추가되었습니다!')
      
      // 새로 추가된 고객을 자동으로 선택 (예약 폼이 열려있는 경우)
      if (showAddForm && data && data[0]) {
        const newCustomer = data[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        alert(`새 고객 "${(newCustomer as any).name}"이 추가되었습니다. 고객을 선택해주세요.`)
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [showAddForm, refreshCustomers])

  // 로딩 화면
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">예약 데이터 로딩 중...</h3>
            {loadingProgress.total > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  {loadingProgress.current} / {loadingProgress.total} 예약 로딩 중
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% 완료
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="space-y-4">
        {/* 첫 번째 줄: 타이틀과 액션 버튼들 */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex-shrink-0">{t('title')}</h1>
            
            {/* 뷰 전환 버튼 - 제목 바로 오른쪽에 배치 */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                  viewMode === 'card' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Grid3X3 className="w-3 h-3" />
                <span className="hidden sm:inline">카드</span>
              </button>
              <button
                onClick={() => {
                  setCalendarLoading(true)
                  setViewMode('calendar')
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                  viewMode === 'calendar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                <span className="hidden sm:inline">달력</span>
              </button>
            </div>
          </div>
          
          {/* 검색창과 새예약 추가 버튼 */}
          <div className="flex items-center space-x-2 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // 검색 시 첫 페이지로 이동
                }}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center space-x-1 text-xs sm:text-sm flex-shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t('addReservation')}</span>
              <span className="sm:hidden">추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-4">

        {/* 고급 필터 - 모바일 최적화 */}
        <div className="space-y-3">
          {/* 첫 번째 줄: 상태, 채널, 시작일, 종료일 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
              <option value="recruiting">모집중</option>
            </select>
            
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value)
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">모든 채널</option>
              {channels.map(channel => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
            
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="시작일"
            />
            
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="종료일"
            />
          </div>
          
          {/* 두 번째 줄: 정렬, 그룹화, 페이지당, 초기화 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap">정렬:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
                className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs flex-1"
              >
                <option value="created_at">등록일</option>
                <option value="tour_date">투어 날짜</option>
                <option value="customer_name">고객명</option>
                <option value="product_name">상품명</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <button
              onClick={() => setGroupByDate(!groupByDate)}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                groupByDate 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {groupByDate ? '그룹화 ON' : '그룹화 OFF'}
            </button>
            
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedStatus('all')
                setSelectedChannel('all')
                setDateRange({start: '', end: ''})
                setSortBy('created_at')
                setSortOrder('desc')
                setGroupByDate(true) // 그룹화 상태도 초기화
                setCurrentPage(1)
                setCurrentWeek(0) // 주간 페이지네이션도 현재 주로 초기화
              }}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              초기화
            </button>
          </div>
        </div>
        
        {/* 주간 페이지네이션 및 통계 통합 패널 - 날짜별 그룹화가 활성화된 경우에만 표시 */}
        {groupByDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg">
            {/* 주간 네비게이션 헤더 - 초컴팩트 모바일 최적화 */}
            <div className="p-2 sm:p-4 border-b border-blue-200">
              <div className="flex items-center justify-between">
                {/* 제목과 통계 정보 - 한 줄에 압축 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <h3 className="text-sm sm:text-lg font-semibold text-blue-900 whitespace-nowrap">
                      {currentWeek === 0 ? '이번 주' : 
                       currentWeek < 0 ? `${Math.abs(currentWeek)}주 전` : 
                       `${currentWeek}주 후`}
                    </h3>
                    <div className="text-xs sm:text-sm text-blue-700 whitespace-nowrap">
                      {formatWeekRange(currentWeek).display}
                    </div>
                  </div>
                  
                  {/* 통계 정보 - 한 줄에 압축 */}
                  <div className="mt-1 flex items-center space-x-3 text-xs">
                    <span className="text-blue-600">
                      <span className="font-semibold">{Object.keys(groupedReservations).length}일</span>
                    </span>
                    <span className="text-blue-600">
                      <span className="font-semibold">{Object.values(groupedReservations).flat().length}예약</span>
                    </span>
                    <span className="text-green-600">
                      <span className="font-semibold">{weeklyStats.totalPeople}명</span>
                    </span>
                    <span className="text-green-600">
                      <span className="font-semibold">{Math.round(weeklyStats.totalPeople / Math.max(Object.keys(groupedReservations).length, 1))}/일</span>
                    </span>
                  </div>
                </div>
                
                {/* 네비게이션 버튼들 - 초컴팩트 */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentWeek(prev => prev - 1)}
                    className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
                  >
                    ←
                  </button>
                  
                  <button
                    onClick={() => setCurrentWeek(0)}
                    className={`px-1.5 py-1 text-xs font-medium rounded ${
                      currentWeek === 0
                        ? 'text-white bg-blue-600 border border-blue-600'
                        : 'text-blue-700 bg-white border border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    이번주
                  </button>
                  
                  <button
                    onClick={() => setCurrentWeek(prev => prev + 1)}
                    className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
                  >
                    →
                  </button>
                  
                  {/* 아코디언 화살표 */}
                  {weeklyStats.totalReservations > 0 && (
                    <button
                      onClick={() => setIsWeeklyStatsCollapsed(!isWeeklyStatsCollapsed)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                    >
                      <svg 
                        className={`w-3 h-3 transition-transform ${isWeeklyStatsCollapsed ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 주간 통계 아코디언 - 초컴팩트 모바일 최적화 */}
            {weeklyStats.totalReservations > 0 && !isWeeklyStatsCollapsed && (
              <div className="p-2 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* 상품별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      상품별
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.productStats.slice(0, 3).map(([productName, count]) => (
                        <div key={productName} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{productName}</span>
                          <span className="font-semibold bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                            {count}명
                          </span>
                        </div>
                      ))}
                      {weeklyStats.productStats.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-0.5">
                          +{weeklyStats.productStats.length - 3}개
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 채널별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      채널별
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.channelStats.slice(0, 3).map(([channelName, count]) => (
                        <div key={channelName} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{channelName}</span>
                          <span className="font-semibold bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs">
                            {count}명
                          </span>
                        </div>
                      ))}
                      {weeklyStats.channelStats.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-0.5">
                          +{weeklyStats.channelStats.length - 3}개
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 상태별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      상태별
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.statusStats.map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{getStatusLabel(status, t)}</span>
                          <span className="font-semibold bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
                            {count}명
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 결과 정보 */}
        <div className="text-sm text-gray-600">
          {groupByDate ? (
            <>
              {Object.values(groupedReservations).flat().length}개 예약이 {Object.keys(groupedReservations).length}개 등록일로 그룹화됨
              {Object.values(groupedReservations).flat().length !== reservations.length && (
                <span className="ml-2 text-blue-600">
                  (전체 {reservations.length}개 중 필터링됨)
                </span>
              )}
            </>
          ) : (
            <>
              총 {filteredReservations.length}개 예약 중 {startIndex + 1}-{Math.min(endIndex, filteredReservations.length)}개 표시
              {filteredReservations.length !== reservations.length && (
                <span className="ml-2 text-blue-600">
                  (전체 {reservations.length}개 중 필터링됨)
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        /* 달력뷰 */
        calendarLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">달력을 불러오는 중...</p>
          </div>
        ) : (
          <ReservationCalendar 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reservations={calendarReservations as any} 
            onReservationClick={handleCalendarReservationClick}
            onLoadComplete={() => setCalendarLoading(false)}
          />
        )
      ) : (
        /* 카드뷰 */
        <>
        {groupByDate ? (
          /* 날짜별 그룹화된 카드뷰 */
          <div className="space-y-8">
            {Object.keys(groupedReservations).length === 0 ? (
              /* 예약이 없을 때 안내 메시지 */
              <div className="text-center py-16">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                  <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">선택한 기간에 예약이 없습니다</h3>
                  <p className="text-gray-500 mb-6">
                    {dateRange.start && dateRange.end ? 
                      `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
                      '현재 선택한 필터 조건에 해당하는 예약이 없습니다.'
                    }
                  </p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>• 다른 날짜 범위를 선택해보세요</p>
                    <p>• 필터 조건을 변경해보세요</p>
                    <p>• 새로운 예약을 등록해보세요</p>
                  </div>
                </div>
              </div>
            ) : (
              Object.entries(groupedReservations).map(([date, reservations]) => (
              <div key={date} className="space-y-4">
                {/* 등록일 헤더 */}
                <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-100 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => toggleGroupCollapse(date)}
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          weekday: 'long',
                          timeZone: 'America/Los_Angeles'
                        })} 등록 (라스베가스 시간)
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                          {reservations.length}개 예약
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          총 {reservations.reduce((total, reservation) => total + reservation.totalPeople, 0)}명
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg 
                        className={`w-5 h-5 text-gray-500 transition-transform ${collapsedGroups.has(date) ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* 상세 정보 (접혀있지 않을 때만 표시) */}
                  {!collapsedGroups.has(date) && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 상품별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          상품별 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const productGroups = reservations.reduce((groups, reservation) => {
                              const productName = getProductName(reservation.productId, products)
                              if (!groups[productName]) {
                                groups[productName] = 0
                              }
                              groups[productName] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(productGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([productName, count]) => (
                                <div key={productName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                  <span className="text-gray-700 text-sm truncate flex-1 mr-2">{productName}</span>
                                  <span className="font-semibold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full min-w-0">
                                    {count}명
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                      
                      {/* 채널별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          채널별 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const channelGroups = reservations.reduce((groups, reservation) => {
                              const channelName = getChannelName(reservation.channelId, channels)
                              if (!groups[channelName]) {
                                groups[channelName] = 0
                              }
                              groups[channelName] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(channelGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([channelName, count]) => (
                                <div key={channelName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                  <span className="text-gray-700 text-sm truncate flex-1 mr-2">{channelName}</span>
                                  <span className="font-semibold text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full min-w-0">
                                    {count}명
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                      
                      {/* 상태별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          상태별 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const statusGroups = reservations.reduce((groups, reservation) => {
                              const status = reservation.status
                              if (!groups[status]) {
                                groups[status] = 0
                              }
                              groups[status] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(statusGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([status, count]) => (
                                <div key={status} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                  <span className="text-gray-700 text-sm truncate flex-1 mr-2">{getStatusLabel(status, t)}</span>
                                  <span className="font-semibold text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full min-w-0">
                                    {count}명
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 해당 날짜의 예약 카드들 (항상 표시) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {reservations.map((reservation) => (
            <div
              key={reservation.id}
              onClick={() => router.push(`/${locale}/admin/reservations/${reservation.id}`)}
              className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
            >
              {/* 카드 헤더 - 상태 표시 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                    {getStatusLabel(reservation.status, t)}
                  </span>
                  <div className="text-xs text-gray-400">RN: {reservation.channelRN}</div>
                </div>
                
                {/* 고객 이름 */}
                <div className="mb-2">
                  <div 
                    className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                      if (customer) {
                        setEditingCustomer(customer);
                      }
                    }}
                  >
                    {/* 언어별 국기 아이콘 */}
                    {(() => {
                      const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                      if (!customer?.language) return null;
                      
                      const language = customer.language.toLowerCase();
                      if (language === 'kr' || language === 'ko' || language === '한국어') {
                        return <ReactCountryFlag countryCode="KR" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'en' || language === '영어') {
                        return <ReactCountryFlag countryCode="US" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'jp' || language === '일본어') {
                        return <ReactCountryFlag countryCode="JP" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'cn' || language === '중국어') {
                        return <ReactCountryFlag countryCode="CN" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      }
                      return null;
                    })()}
                    <span>{getCustomerName(reservation.customerId, customers as Customer[])}</span>
                  </div>
                  <div className="text-xs text-gray-500">{(customers as Customer[]).find(c => c.id === reservation.customerId)?.email}</div>
                </div>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 상품 정보 */}
                <div>
                  <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId, products)}</div>
                  {/* 필수 선택된 옵션들만 표시 */}
                  {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                        if (!choiceIds || choiceIds.length === 0) return null;
                        
                        const option = productOptions.find(opt => opt.id === optionId);
                        
                        if (!option) return null;
                        
                        // 필수 옵션만 표시 (is_required가 true인 옵션만)
                        if (!option.is_required) return null;
                        
                        // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션명을 직접 표시
                        return (
                          <div key={optionId} className="text-xs text-gray-600">
                            <span className="font-medium">{option.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 투어 날짜 */}
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{reservation.tourDate}</span>
                </div>

                {/* 인원 정보 */}
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <div className="text-sm text-gray-900">
                    성인 {reservation.adults}명, 아동 {reservation.child}명, 유아 {reservation.infant}명
                  </div>
                </div>

                {/* 픽업 호텔 정보 */}
                {reservation.pickUpHotel && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels)}</span>
                  </div>
                )}

                {/* 채널 정보 */}
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 rounded-full bg-blue-100 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  </div>
                  <div className="text-sm text-gray-900">{getChannelName(reservation.channelId, channels)}</div>
                  <div className="text-xs text-gray-500">({channels.find(c => c.id === reservation.channelId)?.type})</div>
                </div>

                {/* 가격 정보 */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-blue-600">
                      {calculateTotalPrice(reservation, products, optionChoices).toLocaleString()}원
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePricingInfoClick(reservation);
                        }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <span>가격</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditReservationClick(reservation);
                        }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors border border-blue-200"
                        title="빠른 수정"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${locale}/admin/reservations/${reservation.id}`)
                        }}
                        className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
                        title="상세 보기"
                      >
                        상세
                      </button>
                      
                      {/* 투어 생성 버튼 - Mania Tour/Service이고 투어가 없을 때만 표시 */}
                      {(() => {
                        const product = products.find(p => p.id === reservation.productId);
                        const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service';
                        
                        // hasExistingTour 필드를 사용하여 투어 존재 여부 확인
                        if (isManiaTour && !reservation.hasExistingTour) {
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateTour(reservation);
                              }}
                              className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200"
                              title="투어 생성"
                            >
                              <Play className="w-3 h-3" />
                              <span>투어</span>
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

                  
            </div>
                  ))}
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          /* 일반 카드뷰 */
          paginatedReservations.length === 0 ? (
            /* 예약이 없을 때 안내 메시지 */
            <div className="text-center py-16">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <Grid3X3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">선택한 조건에 예약이 없습니다</h3>
                <p className="text-gray-500 mb-6">
                  {dateRange.start && dateRange.end ? 
                    `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
                    '현재 선택한 필터 조건에 해당하는 예약이 없습니다.'
                  }
                </p>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>• 다른 날짜 범위를 선택해보세요</p>
                  <p>• 필터 조건을 변경해보세요</p>
                  <p>• 새로운 예약을 등록해보세요</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedReservations.map((reservation) => (
              <div
                key={reservation.id}
                onClick={() => router.push(`/${locale}/admin/reservations/${reservation.id}`)}
                className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
              >
                {/* 카드 헤더 - 상태 표시 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                      {getStatusLabel(reservation.status, t)}
                    </span>
                    <div className="text-xs text-gray-400">RN: {reservation.channelRN}</div>
                  </div>
                  
                  {/* 고객 이름 */}
                  <div className="mb-2">
                    <div 
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                        if (customer) {
                          setEditingCustomer(customer);
                        }
                      }}
                    >
                      {/* 언어별 국기 아이콘 */}
                      {(() => {
                        const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                        if (!customer?.language) return null;
                        
                        const language = customer.language.toLowerCase();
                        if (language === 'kr' || language === 'ko' || language === '한국어') {
                          return <ReactCountryFlag countryCode="KR" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'en' || language === '영어') {
                          return <ReactCountryFlag countryCode="US" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'jp' || language === '일본어') {
                          return <ReactCountryFlag countryCode="JP" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'cn' || language === '중국어') {
                          return <ReactCountryFlag countryCode="CN" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        }
                        return null;
                      })()}
                      <span>{getCustomerName(reservation.customerId, customers as Customer[])}</span>
                    </div>
                    <div className="text-xs text-gray-500">{(customers as Customer[]).find(c => c.id === reservation.customerId)?.email}</div>
                  </div>
                </div>

                {/* 카드 본문 */}
                <div className="p-4 space-y-3">
                  {/* 상품 정보 */}
                  <div>
                    <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId, products)}</div>
                    {/* 필수 선택된 옵션들만 표시 */}
                    {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
                      <div className="mt-1 space-y-1">
                        {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                          if (!choiceIds || choiceIds.length === 0) return null;
                          
                          const option = productOptions.find(opt => opt.id === optionId);
                          
                          if (!option) return null;
                          
                          // 필수 옵션만 표시 (is_required가 true인 옵션만)
                          if (!option.is_required) return null;
                          
                          // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션명을 직접 표시
                          return (
                            <div key={optionId} className="text-xs text-gray-600">
                              <span className="font-medium">{option.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 투어 날짜 */}
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{reservation.tourDate}</span>
                  </div>

                  {/* 인원 정보 */}
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div className="text-sm text-gray-900">
                      성인 {reservation.adults}명, 아동 {reservation.child}명, 유아 {reservation.infant}명
                    </div>
                  </div>

                  {/* 픽업 호텔 정보 */}
                  {reservation.pickUpHotel && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels)}</span>
                    </div>
                  )}

                  {/* 채널 정보 */}
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full bg-blue-100 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="text-sm text-gray-900">{getChannelName(reservation.channelId, channels)}</div>
                    <div className="text-xs text-gray-500">({channels.find(c => c.id === reservation.channelId)?.type})</div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-blue-600">
                        {calculateTotalPrice(reservation, products, optionChoices).toLocaleString()}원
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePricingInfoClick(reservation);
                        }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <span>가격</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditReservationClick(reservation);
                        }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors border border-blue-200"
                        title="빠른 수정"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${locale}/admin/reservations/${reservation.id}`)
                        }}
                        className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
                        title="상세 보기"
                      >
                        상세
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )
        )}
        
        {/* 페이지네이션 - 카드뷰에서만 표시 (그룹화되지 않은 경우에만) */}
        {!groupByDate && totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-gray-700">
              페이지 {currentPage} / {totalPages} (총 {filteredReservations.length}개)
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 이전 페이지 버튼 */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              
              {/* 페이지 번호들 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNum
                        ? 'text-white bg-blue-600 border border-blue-600'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
              {/* 다음 페이지 버튼 */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {/* 예약 추가/편집 모달 */}
      {(showAddForm || editingReservation) && (
        <ReservationForm
          reservation={editingReservation}
          customers={customers}
          products={products}
          channels={channels}
          productOptions={productOptions}
          optionChoices={optionChoices}
          options={options}
          pickupHotels={pickupHotels}
          coupons={coupons}
          onSubmit={editingReservation ? handleEditReservation : handleAddReservation}
          onCancel={() => {
            setShowAddForm(false)
            setEditingReservation(null)
          }}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          layout="modal"
        />
      )}

      {/* 고객 추가 모달 */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}

      {/* 고객 수정 모달 */}
      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          channels={channels}
          onSubmit={async (customerData) => {
            try {
              // Supabase에 고객 정보 업데이트
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from('customers')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .update(customerData as any)
                .eq('id', editingCustomer.id)

              if (error) {
                console.error('Error updating customer:', error)
                alert('고객 정보 수정 중 오류가 발생했습니다: ' + error.message)
                return
              }

              // 성공 시 고객 목록 새로고침
              await refreshCustomers()
              setEditingCustomer(null)
              alert('고객 정보가 성공적으로 수정되었습니다!')
            } catch (error) {
              console.error('Error updating customer:', error)
              alert('고객 정보 수정 중 오류가 발생했습니다.')
            }
          }}
          onCancel={() => setEditingCustomer(null)}
          onDelete={async () => {
            if (confirm('정말로 이 고객을 삭제하시겠습니까?')) {
              try {
                const { error } = await supabase
                  .from('customers')
                  .delete()
                  .eq('id', editingCustomer.id)

                if (error) {
                  console.error('Error deleting customer:', error)
                  alert('고객 삭제 중 오류가 발생했습니다: ' + error.message)
                  return
                }

                // 성공 시 고객 목록 새로고침
                await refreshCustomers()
                setEditingCustomer(null)
                alert('고객이 성공적으로 삭제되었습니다!')
              } catch (error) {
                console.error('Error deleting customer:', error)
                alert('고객 삭제 중 오류가 발생했습니다.')
              }
            }
          }}
        />
      )}

      {/* 가격 정보 모달 */}
      <PricingInfoModal
        reservation={pricingModalReservation}
        isOpen={showPricingModal}
        onClose={handleClosePricingModal}
      />
    </div>
  )
}