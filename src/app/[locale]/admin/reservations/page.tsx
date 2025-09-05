'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Search, Calendar, MapPin, Users, Grid3X3, CalendarDays } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import CustomerForm from '@/components/CustomerForm'
import ReservationForm from '@/components/reservation/ReservationForm'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import TourCalendar from '@/components/TourCalendar'
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

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // 고급 필터링 상태
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''})
  const [sortBy, setSortBy] = useState<'created_at' | 'tour_date' | 'customer_name' | 'product_name'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 필터링 및 정렬 로직
  const filteredAndSortedReservations = useCallback(() => {
    const filtered = reservations.filter(reservation => {
      // 검색 조건
    const matchesSearch = 
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.channelRN.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(reservation.customerId, customers).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getProductName(reservation.productId, products).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getChannelName(reservation.channelId, channels).toLowerCase().includes(searchTerm.toLowerCase())
    
      // 상태 필터
    const matchesStatus = selectedStatus === 'all' || reservation.status === selectedStatus
      
      // 채널 필터
      const matchesChannel = selectedChannel === 'all' || reservation.channelId === selectedChannel
      
      // 날짜 범위 필터
      let matchesDateRange = true
      if (dateRange.start && dateRange.end) {
        const tourDate = new Date(reservation.tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        matchesDateRange = tourDate >= startDate && tourDate <= endDate
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
          aValue = getCustomerName(a.customerId, customers)
          bValue = getCustomerName(b.customerId, customers)
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
  
  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedReservations = filteredReservations.slice(startIndex, endIndex)

  // 달력뷰용 데이터 변환
  const calendarReservations = useMemo(() => {
    return filteredReservations.map(reservation => ({
      id: reservation.id,
      product_id: getProductName(reservation.productId, products),
      tour_date: reservation.tourDate,
      tour_status: reservation.status,
      tour_time: reservation.tourTime,
      pickup_hotel: reservation.pickUpHotel,
      pickup_time: reservation.pickUpTime,
      adults: reservation.adults,
      child: reservation.child,
      infant: reservation.infant,
      customer_name: getCustomerName(reservation.customerId, customers),
      channel_name: getChannelName(reservation.channelId, channels),
      total_price: calculateTotalPrice(reservation, products, optionChoices)
    }))
  }, [filteredReservations, products, customers, channels, optionChoices])

  const handleAddReservation = async (reservation: Omit<Reservation, 'id'>) => {
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
        selected_option_prices: reservation.selectedOptionPrices
      }

      const { data: newReservation, error } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single()

      if (error) {
        console.error('Error adding reservation:', error)
        alert('예약 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 가격 정보가 있으면 저장
      if (reservation.pricingInfo && newReservation) {
        try {
          const pricingData = {
            id: crypto.randomUUID(),
            reservation_id: newReservation.id,
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
            is_private_tour: reservation.pricingInfo.isPrivateTour,
            private_tour_additional_cost: reservation.pricingInfo.privateTourAdditionalCost
          }

          const { error: pricingError } = await supabase
            .from('reservation_pricing')
            .insert([pricingData])

          if (pricingError) {
            console.error('Error saving pricing info:', pricingError)
            // 가격 정보 저장 실패는 예약 성공에 영향을 주지 않음
          } else {
            console.log('가격 정보가 성공적으로 저장되었습니다.')
          }
        } catch (pricingError) {
          console.error('Error saving pricing info:', pricingError)
        }
      }

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
          selected_option_prices: reservation.selectedOptionPrices
        }

        const { error } = await supabase
          .from('reservations')
          .update(reservationData)
          .eq('id', editingReservation.id)

        if (error) {
          console.error('Error updating reservation:', error)
          alert('예약 수정 중 오류가 발생했습니다: ' + error.message)
          return
        }

        // 가격 정보가 있으면 업데이트
        if (reservation.pricingInfo) {
          try {
            const pricingData = {
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
              is_private_tour: reservation.pricingInfo.isPrivateTour,
              private_tour_additional_cost: reservation.pricingInfo.privateTourAdditionalCost
            }

            const { error: pricingError } = await supabase
              .from('reservation_pricing')
              .update(pricingData)
              .eq('reservation_id', editingReservation.id)

            if (pricingError) {
              console.error('Error updating pricing info:', pricingError)
              // 가격 정보 업데이트 실패는 예약 수정 성공에 영향을 주지 않음
            } else {
              console.log('가격 정보가 성공적으로 업데이트되었습니다.')
            }
          } catch (pricingError) {
            console.error('Error updating pricing info:', pricingError)
          }
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        setEditingReservation(null)
        alert('예약이 성공적으로 수정되었습니다!')
      } catch (error) {
        console.error('Error updating reservation:', error)
        alert('예약 수정 중 오류가 발생했습니다.')
      }
    }
  }

  // 예약 편집 모달 열기
  const handleEditReservationClick = (reservation: Reservation) => {
    setEditingReservation(reservation)
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
        .insert(customerData)
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
        alert(`새 고객 "${newCustomer.name}"이 추가되었습니다. 고객을 선택해주세요.`)
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [showAddForm, refreshCustomers])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addReservation')}</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-4">
        {/* 기본 검색 및 필터 */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
              placeholder="예약 ID, 고객명, 상품명, 채널명으로 검색..."
            value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // 검색 시 첫 페이지로 이동
              }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
          
        <select
          value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 채널</option>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </select>
        </div>
        
        {/* 뷰 전환 버튼 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'card' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span>카드뷰</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'calendar' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>달력뷰</span>
          </button>
        </div>

        {/* 고급 필터 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">투어 날짜:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at">등록일</option>
              <option value="tour_date">투어 날짜</option>
              <option value="customer_name">고객명</option>
              <option value="product_name">상품명</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">페이지당:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
        </select>
          </div>
          
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedStatus('all')
              setSelectedChannel('all')
              setDateRange({start: '', end: ''})
              setSortBy('created_at')
              setSortOrder('desc')
              setCurrentPage(1)
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            필터 초기화
          </button>
        </div>
        
        {/* 결과 정보 */}
        <div className="text-sm text-gray-600">
          총 {filteredReservations.length}개 예약 중 {startIndex + 1}-{Math.min(endIndex, filteredReservations.length)}개 표시
          {filteredReservations.length !== reservations.length && (
            <span className="ml-2 text-blue-600">
              (전체 {reservations.length}개 중 필터링됨)
            </span>
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
        <TourCalendar 
          tours={calendarReservations} 
          onTourClick={handleCalendarReservationClick}
        />
      ) : (
        /* 카드뷰 */
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedReservations.map((reservation) => (
            <div
              key={reservation.id}
              onClick={() => handleEditReservationClick(reservation)}
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
                      const customer = customers.find(c => c.id === reservation.customerId);
                      if (customer) {
                        setEditingCustomer(customer);
                      }
                    }}
                  >
                    {/* 언어별 국기 아이콘 */}
                    {(() => {
                      const customer = customers.find(c => c.id === reservation.customerId);
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
                    <span>{getCustomerName(reservation.customerId, customers)}</span>
                  </div>
                  <div className="text-xs text-gray-500">{customers.find(c => c.id === reservation.customerId)?.email}</div>
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
                  </div>
                </div>
              </div>

                  
            </div>
          ))}
        </div>
        
        {/* 페이지네이션 - 카드뷰에서만 표시 */}
        {totalPages > 1 && (
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
              const { error } = await supabase
                .from('customers')
                .update(customerData)
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