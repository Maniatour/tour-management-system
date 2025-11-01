'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { DollarSign, Users, Calendar, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { useReservationData } from '@/hooks/useReservationData'
import { getChannelName, getProductName, getCustomerName, getStatusColor } from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

interface ChannelSettlementTabProps {
  dateRange: { start: string; end: string }
  selectedChannelId?: string // 더 이상 사용하지 않지만 호환성을 위해 유지
  selectedStatuses: string[]
  searchQuery?: string
}

interface ChannelGroup {
  type: 'OTA' | 'SELF'
  label: string
  channels: Array<{ id: string; name: string; type?: string; category?: string }>
}

interface ReservationItem {
  id: string
  tourDate: string
  registrationDate: string
  customerId: string
  customerName: string
  productId: string
  productName: string
  totalPeople: number
  adults: number
  child: number
  infant: number
  status: string
  channelRN: string
  channelId?: string
  channelName?: string
  totalPrice: number
  adultPrice?: number
  productPriceTotal?: number
  optionTotal?: number
  subtotal?: number
  commissionAmount?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  tax?: number
  depositAmount?: number
  balanceAmount?: number
}

// TourItem을 ReservationItem과 동일하게 사용

export default function ChannelSettlementTab({ dateRange, selectedChannelId, selectedStatuses, searchQuery = '' }: ChannelSettlementTabProps) {
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string || 'ko'
  
  const {
    reservations,
    customers,
    products,
    channels,
    loading: reservationsLoading
  } = useReservationData()
  const [toursLoading, setToursLoading] = useState(false)
  const [tourItems, setTourItems] = useState<ReservationItem[]>([])
  const [reservationPrices, setReservationPrices] = useState<Record<string, number>>({})
  const [reservationPricingData, setReservationPricingData] = useState<Record<string, {
    adultPrice: number
    productPriceTotal: number
    optionTotal: number
    subtotal: number
    commissionAmount: number
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
    tax: number
    depositAmount: number
    balanceAmount: number
  }>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'reservations' | 'tours'>('reservations')
  const [reservationSortOrder, setReservationSortOrder] = useState<'asc' | 'desc'>('asc')
  const [tourSortOrder, setTourSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())

  // 채널 그룹화
  const channelGroups = useMemo((): ChannelGroup[] => {
    if (!channels || channels.length === 0) return []
    
    const otaChannels = channels.filter(channel => {
      const type = (channel.type || '').toLowerCase()
      const category = (channel.category || '').toLowerCase()
      return type === 'ota' || category === 'ota'
    })
    
    const selfChannels = channels.filter(channel => {
      const type = (channel.type || '').toLowerCase()
      const category = (channel.category || '').toLowerCase()
      return type === 'self' || type === 'partner' || category === 'own' || category === 'self' || category === 'partner'
    })
    
    return [
      {
        type: 'OTA',
        label: 'OTA 채널',
        channels: otaChannels
      },
      {
        type: 'SELF',
        label: '자체 채널',
        channels: selfChannels
      }
    ].filter(group => group.channels.length > 0)
  }, [channels])

  // 그룹 토글
  const toggleGroup = (groupType: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupType)) {
        next.delete(groupType)
        // 그룹이 닫힐 때 하위 채널도 모두 닫기
        const group = channelGroups.find(g => g.type === groupType)
        if (group) {
          group.channels.forEach(ch => setExpandedChannels(prevCh => {
            const nextCh = new Set(prevCh)
            nextCh.delete(ch.id)
            return nextCh
          }))
        }
      } else {
        next.add(groupType)
      }
      return next
    })
  }

  // 채널 토글
  const toggleChannel = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }

  // 예약 내역 필터링 (등록일 기준, 상태 필터, 검색 필터) - 채널 필터는 아코디언에서 처리
  const filteredReservations = useMemo(() => {
    return reservations.filter(reservation => {
      // 상태 필터 (선택된 경우에만)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false
      
      // 등록일 필터 (addedTime 기준)
      const registrationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999) // 하루의 끝까지 포함
      
      if (!(registrationDate >= startDate && registrationDate <= endDate)) return false

      // 검색 필터
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        // 고객명 검색
        const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
        // 채널RN 검색
        const channelRN = reservation.channelRN?.toLowerCase() || ''
        // 상품명 검색
        const productName = getProductName(reservation.productId, products || []).toLowerCase()
        // 투어 날짜 검색
        const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
        // 등록일 검색
        const regDate = registrationDate.toLocaleDateString('ko-KR')
        
        if (
          !customerName.includes(query) &&
          !channelRN.includes(query) &&
          !productName.includes(query) &&
          !tourDate.includes(query) &&
          !regDate.includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [reservations, selectedStatuses, dateRange, searchQuery, customers, products])

  // 채널별로 예약 필터링하는 헬퍼 함수
  const getReservationsByChannel = useCallback((channelId: string) => {
    return filteredReservations.filter(reservation => reservation.channelId === channelId)
  }, [filteredReservations])

  // 투어 아이템을 채널별로 필터링하는 헬퍼 함수
  const getTourItemsByChannel = useCallback((channelId: string) => {
    return tourItems.filter(item => item.channelId === channelId)
  }, [tourItems])

  // 예약 가격 정보 가져오기
  useEffect(() => {
    const fetchPrices = async () => {
      if (filteredReservations.length === 0) {
        setReservationPrices({})
        return
      }

      setPricesLoading(true)
      try {
        const reservationIds = filteredReservations.map(r => r.id)
        
        const { data: pricingData, error } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price, adult_product_price, product_price_total, option_total, subtotal, commission_amount, coupon_discount, additional_discount, additional_cost, tax, deposit_amount, balance_amount')
          .in('reservation_id', reservationIds)

        if (error) {
          console.error('예약 가격 조회 오류:', error)
          setReservationPrices({})
          setReservationPricingData({})
          return
        }

        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, {
          adultPrice: number
          productPriceTotal: number
          optionTotal: number
          subtotal: number
          commissionAmount: number
          couponDiscount: number
          additionalDiscount: number
          additionalCost: number
          tax: number
          depositAmount: number
          balanceAmount: number
        }> = {}
        
        pricingData?.forEach(p => {
          pricesMap[p.reservation_id] = p.total_price || 0
          pricingDataMap[p.reservation_id] = {
            adultPrice: p.adult_product_price || 0,
            productPriceTotal: p.product_price_total || 0,
            optionTotal: p.option_total || 0,
            subtotal: p.subtotal || 0,
            commissionAmount: p.commission_amount || 0,
            couponDiscount: p.coupon_discount || 0,
            additionalDiscount: p.additional_discount || 0,
            additionalCost: p.additional_cost || 0,
            tax: p.tax || 0,
            depositAmount: p.deposit_amount || 0,
            balanceAmount: p.balance_amount || 0
          }
        })

        setReservationPrices(pricesMap)
        setReservationPricingData(pricingDataMap)
      } catch (error) {
        console.error('예약 가격 정보 가져오기 오류:', error)
        setReservationPrices({})
        setReservationPricingData({})
      } finally {
        setPricesLoading(false)
      }
    }

    fetchPrices()
  }, [filteredReservations])

  // 예약 내역 데이터 포맷팅 및 정렬 (등록일 기준)
  const reservationItems = useMemo<ReservationItem[]>(() => {
    const items = filteredReservations.map(reservation => {
      const pricing = reservationPricingData[reservation.id] || {
        adultPrice: 0,
        productPriceTotal: 0,
        optionTotal: 0,
        subtotal: 0,
        commissionAmount: 0,
        couponDiscount: 0,
        additionalDiscount: 0,
        additionalCost: 0,
        tax: 0,
        depositAmount: 0,
        balanceAmount: 0
      }
      return {
        id: reservation.id,
        tourDate: reservation.tourDate,
        registrationDate: reservation.addedTime,
        customerId: reservation.customerId,
        customerName: getCustomerName(reservation.customerId, customers || []),
        productId: reservation.productId,
        productName: getProductName(reservation.productId, products || []),
        totalPeople: reservation.totalPeople,
        adults: reservation.adults || 0,
        child: reservation.child || 0,
        infant: reservation.infant || 0,
        status: reservation.status,
        channelRN: reservation.channelRN || '',
        totalPrice: reservationPrices[reservation.id] || 0,
        adultPrice: pricing.adultPrice,
        productPriceTotal: pricing.productPriceTotal,
        optionTotal: pricing.optionTotal,
        subtotal: pricing.subtotal,
        commissionAmount: pricing.commissionAmount,
        couponDiscount: pricing.couponDiscount,
        additionalDiscount: pricing.additionalDiscount,
        additionalCost: pricing.additionalCost,
        tax: pricing.tax,
        depositAmount: pricing.depositAmount,
        balanceAmount: pricing.balanceAmount
      }
    })
    
    // 등록일별 정렬
    return items.sort((a, b) => {
      const dateA = new Date(a.registrationDate).getTime()
      const dateB = new Date(b.registrationDate).getTime()
      return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [filteredReservations, customers, products, reservationPrices, reservationPricingData, reservationSortOrder])

  // 선택된 채널의 투어 진행 내역 가져오기 (투어 날짜 기준 예약 목록)
  useEffect(() => {
    const fetchTourReservations = async () => {
      setToursLoading(true)
      try {
        // 선택된 채널의 예약들 중 기간 필터에 맞는 것들
        // 투어 날짜 기준으로 필터링 (기간 필터 적용)
        let tourDateFilteredReservations = reservations.filter(reservation => {
          // 투어 날짜 기준 기간 필터
          const tourDate = new Date(reservation.tourDate)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          
          if (!(tourDate >= startDate && tourDate <= endDate)) return false
          
          return true
        })

        // 추가 필터링 (채널, 상태, 검색)
        tourDateFilteredReservations = tourDateFilteredReservations.filter(reservation => {
          // 채널 필터 (선택된 경우에만)
          if (selectedChannelId && reservation.channelId !== selectedChannelId) return false
          
          // 상태 필터 (선택된 경우에만)
          if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false

          // 검색 필터
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
            const channelRN = reservation.channelRN?.toLowerCase() || ''
            const productName = getProductName(reservation.productId, products || []).toLowerCase()
            const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
            const regDate = new Date(reservation.addedTime).toLocaleDateString('ko-KR')
            
            if (
              !customerName.includes(query) &&
              !channelRN.includes(query) &&
              !productName.includes(query) &&
              !tourDate.includes(query) &&
              !regDate.includes(query)
            ) {
              return false
            }
          }

          return true
        })

        if (tourDateFilteredReservations.length === 0) {
          setTourItems([])
          setToursLoading(false)
          return
        }

        // 예약 가격 정보 가져오기
        const reservationIds = tourDateFilteredReservations.map(r => r.id)
        const { data: pricingData } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price, adult_product_price, product_price_total, option_total, subtotal, commission_amount, coupon_discount, additional_discount, additional_cost, tax, deposit_amount, balance_amount')
          .in('reservation_id', reservationIds)

        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, {
          adultPrice: number
          productPriceTotal: number
          optionTotal: number
          subtotal: number
          commissionAmount: number
          couponDiscount: number
          additionalDiscount: number
          additionalCost: number
          tax: number
          depositAmount: number
          balanceAmount: number
        }> = {}
        
        pricingData?.forEach(p => {
          pricesMap[p.reservation_id] = p.total_price || 0
          pricingDataMap[p.reservation_id] = {
            adultPrice: p.adult_product_price || 0,
            productPriceTotal: p.product_price_total || 0,
            optionTotal: p.option_total || 0,
            subtotal: p.subtotal || 0,
            commissionAmount: p.commission_amount || 0,
            couponDiscount: p.coupon_discount || 0,
            additionalDiscount: p.additional_discount || 0,
            additionalCost: p.additional_cost || 0,
            tax: p.tax || 0,
            depositAmount: p.deposit_amount || 0,
            balanceAmount: p.balance_amount || 0
          }
        })

        // 예약 아이템으로 변환
        const tourReservationItems: ReservationItem[] = tourDateFilteredReservations.map(reservation => {
          const pricing = pricingDataMap[reservation.id] || {
            adultPrice: 0,
            productPriceTotal: 0,
            optionTotal: 0,
            subtotal: 0,
            commissionAmount: 0,
            couponDiscount: 0,
            additionalDiscount: 0,
            additionalCost: 0,
            tax: 0,
            depositAmount: 0,
            balanceAmount: 0
          }
          return {
            id: reservation.id,
            tourDate: reservation.tourDate,
            registrationDate: reservation.addedTime,
            customerId: reservation.customerId,
            customerName: getCustomerName(reservation.customerId, customers || []),
            productId: reservation.productId,
            productName: getProductName(reservation.productId, products || []),
            totalPeople: reservation.totalPeople,
            adults: reservation.adults || 0,
            child: reservation.child || 0,
            infant: reservation.infant || 0,
            status: reservation.status,
            channelRN: reservation.channelRN || '',
            channelId: reservation.channelId,
            channelName: getChannelName(reservation.channelId, channels || []),
            totalPrice: pricesMap[reservation.id] || 0,
            adultPrice: pricing.adultPrice,
            productPriceTotal: pricing.productPriceTotal,
            optionTotal: pricing.optionTotal,
            subtotal: pricing.subtotal,
            commissionAmount: pricing.commissionAmount,
            couponDiscount: pricing.couponDiscount,
            additionalDiscount: pricing.additionalDiscount,
            additionalCost: pricing.additionalCost,
            tax: pricing.tax,
            depositAmount: pricing.depositAmount,
            balanceAmount: pricing.balanceAmount
          }
        })

        setTourItems(tourReservationItems)
      } catch (error) {
        console.error('투어 진행 내역 조회 오류:', error)
        setTourItems([])
      } finally {
        setToursLoading(false)
      }
    }

    fetchTourReservations()
  }, [reservations, selectedChannelId, selectedStatuses, dateRange, customers, products, searchQuery])

  // 투어 내역 정렬
  const sortedTourItems = useMemo(() => {
    return [...tourItems].sort((a, b) => {
      const dateA = new Date(a.tourDate).getTime()
      const dateB = new Date(b.tourDate).getTime()
      return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [tourItems, tourSortOrder])

  // 합계 계산
  const totals = useMemo(() => {
    const reservationTotalPrice = reservationItems.reduce((sum, r) => sum + r.totalPrice, 0)
    const reservationTotalPeople = reservationItems.reduce((sum, r) => sum + r.totalPeople, 0)
    const tourTotalPrice = sortedTourItems.reduce((sum, t) => sum + t.totalPrice, 0)
    const tourTotalPeople = sortedTourItems.reduce((sum, t) => sum + t.totalPeople, 0)

    return {
      reservations: {
        count: reservationItems.length,
        totalPeople: reservationTotalPeople,
        totalPrice: reservationTotalPrice
      },
      tours: {
        count: sortedTourItems.length,
        totalPeople: tourTotalPeople,
        totalPrice: tourTotalPrice
      }
    }
  }, [reservationItems, sortedTourItems])

  if (reservationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">예약 건수</p>
              <p className="text-2xl font-bold text-gray-900">{totals.reservations.count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">예약 인원</p>
              <p className="text-2xl font-bold text-gray-900">{totals.reservations.totalPeople}명</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">투어 진행 예약</p>
              <p className="text-2xl font-bold text-gray-900">{totals.tours.count}건</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">투어 진행 총액</p>
              <p className="text-2xl font-bold text-green-600">
                ${totals.tours.totalPrice.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 상세 내역 탭 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveDetailTab('reservations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeDetailTab === 'reservations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              예약 내역
            </button>
            <button
              onClick={() => setActiveDetailTab('tours')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeDetailTab === 'tours'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              투어 진행 내역
            </button>
          </nav>
        </div>

        {/* 예약 내역 탭 */}
        {activeDetailTab === 'reservations' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setReservationSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                title="등록일로 정렬"
              >
                <span>등록일 정렬</span>
                <span className={`transition-transform ${reservationSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                </span>
              </button>
            </div>

            {channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                {pricesLoading ? '가격 정보를 불러오는 중...' : '채널 데이터가 없습니다.'}
              </div>
            ) : (
               channelGroups.map(group => {
                 const isGroupExpanded = expandedGroups.has(group.type)
                 const groupReservations = group.channels.flatMap(ch => getReservationsByChannel(ch.id))
                 const groupTotal = groupReservations.reduce((sum, r) => {
                   const pricing = reservationPricingData[r.id] || {}
                   const discountTotal = (pricing.couponDiscount || 0) + (pricing.additionalDiscount || 0)
                   const grandTotal = (pricing.productPriceTotal || 0) - discountTotal + (pricing.additionalCost || 0)
                   const totalPrice = grandTotal - (pricing.commissionAmount || 0)
                   const netPrice = totalPrice + (pricing.optionTotal || 0)
                   return sum + netPrice
                 }, 0)

                 // 자체 채널은 바로 모든 예약을 합쳐서 표시
                 if (group.type === 'SELF') {
                   // 자체 채널의 모든 예약 아이템 생성 및 정렬
                   const allChannelItems = groupReservations.map(reservation => {
                     const pricing = reservationPricingData[reservation.id] || {
                       adultPrice: 0,
                       productPriceTotal: 0,
                       optionTotal: 0,
                       subtotal: 0,
                       commissionAmount: 0,
                       couponDiscount: 0,
                       additionalDiscount: 0,
                       additionalCost: 0,
                       tax: 0,
                       depositAmount: 0,
                       balanceAmount: 0
                     }
                     return {
                       id: reservation.id,
                       tourDate: reservation.tourDate,
                       registrationDate: reservation.addedTime,
                       customerId: reservation.customerId,
                       customerName: getCustomerName(reservation.customerId, customers || []),
                       productId: reservation.productId,
                       productName: getProductName(reservation.productId, products || []),
                       totalPeople: reservation.totalPeople,
                       adults: reservation.adults || 0,
                       child: reservation.child || 0,
                       infant: reservation.infant || 0,
                       status: reservation.status,
                       channelRN: reservation.channelRN || '',
                       channelId: reservation.channelId,
                       channelName: getChannelName(reservation.channelId, channels || []),
                       totalPrice: 0,
                       adultPrice: pricing.adultPrice,
                       productPriceTotal: pricing.productPriceTotal,
                       optionTotal: pricing.optionTotal,
                       subtotal: pricing.subtotal,
                       commissionAmount: pricing.commissionAmount,
                       couponDiscount: pricing.couponDiscount,
                       additionalDiscount: pricing.additionalDiscount,
                       additionalCost: pricing.additionalCost,
                       tax: pricing.tax,
                       depositAmount: pricing.depositAmount,
                       balanceAmount: pricing.balanceAmount
                     }
                   }).sort((a, b) => {
                     const dateA = new Date(a.registrationDate).getTime()
                     const dateB = new Date(b.registrationDate).getTime()
                     return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                   })

                   return (
                     <div key={group.type} className="border-b border-gray-200">
                       {/* 자체 채널 그룹 헤더 */}
                       <button
                         onClick={() => toggleGroup(group.type)}
                         className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                       >
                         <div className="flex items-center space-x-3">
                           {isGroupExpanded ? (
                             <ChevronDown className="w-5 h-5 text-gray-500" />
                           ) : (
                             <ChevronRight className="w-5 h-5 text-gray-500" />
                           )}
                           <span className="font-semibold text-gray-900">{group.label}</span>
                           <span className="text-sm text-gray-500">({group.channels.length}개 채널)</span>
                           <span className="text-sm font-medium text-green-600">
                             총 ${groupTotal.toLocaleString()}
                           </span>
                         </div>
                       </button>

                       {/* 자체 채널의 모든 예약 내역 테이블 */}
                       {isGroupExpanded && (
                         <div className="overflow-x-auto bg-gray-50">
                           <table className="min-w-full divide-y divide-gray-200 text-xs">
                             <thead className="bg-white">
                               <tr>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">성인 가격</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품가격 합계</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">할인총액</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가비용 총액</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">커미션</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">총 가격</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">옵션 총합</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net 가격</th>
                               </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                               {allChannelItems.length === 0 ? (
                                 <tr>
                                   <td colSpan={16} className="px-2 py-3 text-center text-gray-500 text-xs">
                                     예약 내역이 없습니다.
                                   </td>
                                 </tr>
                               ) : (
                                 allChannelItems.map((item, idx) => {
                                   const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                   const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                   const totalPrice = grandTotal - (item.commissionAmount || 0)
                                   const netPrice = totalPrice + (item.optionTotal || 0)
                                   return (
                                     <tr 
                                       key={`self-${item.id}-${idx}`} 
                                       className="hover:bg-gray-50 cursor-pointer transition-colors"
                                       onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                                     >
                                       <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                         <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                           {item.status === 'Confirmed' ? '확정' :
                                            item.status === 'Pending' ? '대기' :
                                            item.status === 'Canceled' ? '취소' :
                                            item.status === 'Completed' ? '완료' :
                                            item.status}
                                         </span>
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                         {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                         {item.customerName}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                         {item.channelRN || '-'}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                         {item.channelName}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                         {item.productName}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center">
                                         {item.totalPeople}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                         ${(item.adultPrice || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                         ${(item.productPriceTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right">
                                         -${discountTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right">
                                         ${(item.additionalCost || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                         ${grandTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right">
                                         ${(item.commissionAmount || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                         ${totalPrice.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                         ${(item.optionTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right">
                                         ${netPrice.toLocaleString()}
                                       </td>
                                     </tr>
                                   )
                                 })
                               )}
                             </tbody>
                             <tfoot className="bg-gray-50">
                               <tr>
                                 <td colSpan={7} className="px-2 py-2 text-xs font-medium text-gray-900">
                                   합계
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                   -${allChannelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                     return sum + (grandTotal - (item.commissionAmount || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                   ${groupTotal.toLocaleString()}
                                 </td>
                               </tr>
                             </tfoot>
                           </table>
                         </div>
                       )}
                     </div>
                   )
                 }

                 // OTA 채널은 기존대로 채널별로 나누어 표시
                 return (
                   <div key={group.type} className="border-b border-gray-200">
                     {/* 그룹 헤더 */}
                     <button
                       onClick={() => toggleGroup(group.type)}
                       className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                     >
                       <div className="flex items-center space-x-3">
                         {isGroupExpanded ? (
                           <ChevronDown className="w-5 h-5 text-gray-500" />
                         ) : (
                           <ChevronRight className="w-5 h-5 text-gray-500" />
                         )}
                         <span className="font-semibold text-gray-900">{group.label}</span>
                         <span className="text-sm text-gray-500">({group.channels.length}개 채널)</span>
                         <span className="text-sm font-medium text-green-600">
                           총 ${groupTotal.toLocaleString()}
                         </span>
                       </div>
                     </button>

                     {/* 채널 목록 */}
                     {isGroupExpanded && (
                       <div className="bg-gray-50">
                         {group.channels.map(channel => {
                          const channelReservations = getReservationsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 예약 아이템 생성 및 정렬
                          const channelItems = channelReservations.map(reservation => {
                            const pricing = reservationPricingData[reservation.id] || {
                              adultPrice: 0,
                              productPriceTotal: 0,
                              optionTotal: 0,
                              subtotal: 0,
                              commissionAmount: 0,
                              couponDiscount: 0,
                              additionalDiscount: 0,
                              additionalCost: 0,
                              tax: 0,
                              depositAmount: 0,
                              balanceAmount: 0
                            }
                            return {
                              id: reservation.id,
                              tourDate: reservation.tourDate,
                              registrationDate: reservation.addedTime,
                              customerId: reservation.customerId,
                              customerName: getCustomerName(reservation.customerId, customers || []),
                              productId: reservation.productId,
                              productName: getProductName(reservation.productId, products || []),
                              totalPeople: reservation.totalPeople,
                              adults: reservation.adults || 0,
                              child: reservation.child || 0,
                              infant: reservation.infant || 0,
                              status: reservation.status,
                              channelRN: reservation.channelRN || '',
                              totalPrice: 0,
                              adultPrice: pricing.adultPrice,
                              productPriceTotal: pricing.productPriceTotal,
                              optionTotal: pricing.optionTotal,
                              subtotal: pricing.subtotal,
                              commissionAmount: pricing.commissionAmount,
                              couponDiscount: pricing.couponDiscount,
                              additionalDiscount: pricing.additionalDiscount,
                              additionalCost: pricing.additionalCost,
                              tax: pricing.tax,
                              depositAmount: pricing.depositAmount,
                              balanceAmount: pricing.balanceAmount
                            }
                          }).sort((a, b) => {
                            const dateA = new Date(a.registrationDate).getTime()
                            const dateB = new Date(b.registrationDate).getTime()
                            return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          // 채널별 통계 계산
                          const channelStats = channelItems.reduce((acc, item) => {
                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                            const totalPrice = grandTotal - (item.commissionAmount || 0)
                            const netPrice = totalPrice + (item.optionTotal || 0)
                            
                            return {
                              grandTotal: acc.grandTotal + grandTotal,
                              commission: acc.commission + (item.commissionAmount || 0),
                              totalPrice: acc.totalPrice + totalPrice,
                              netPrice: acc.netPrice + netPrice
                            }
                          }, { grandTotal: 0, commission: 0, totalPrice: 0, netPrice: 0 })

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더 */}
                              <button
                                onClick={() => toggleChannel(channel.id)}
                                className="w-full px-8 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  {isChannelExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                  <span className="font-medium text-gray-800">{channel.name}</span>
                                  <span className="text-xs text-gray-500">({channelItems.length}건)</span>
                                  <div className="flex items-center space-x-4 text-xs">
                                    <span className="font-medium text-green-600">
                                      Grand Total: ${channelStats.grandTotal.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-blue-600">
                                      Commission: ${channelStats.commission.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 가격: ${channelStats.totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {/* 채널 예약 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">성인 가격</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품가격 합계</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">할인총액</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가비용 총액</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">커미션</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">총 가격</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">옵션 총합</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net 가격</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {channelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={15} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            예약 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        channelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const netPrice = totalPrice + (item.optionTotal || 0)
                                          return (
                                            <tr 
                                              key={`${channel.id}-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'Confirmed' ? '확정' :
                                                   item.status === 'Pending' ? '대기' :
                                                   item.status === 'Canceled' ? '취소' :
                                                   item.status === 'Completed' ? '완료' :
                                                   item.status}
                                                </span>
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                                {item.channelRN || '-'}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                                {item.productName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center">
                                                {item.totalPeople}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right">
                                                ${netPrice.toLocaleString()}
                                              </td>
                                            </tr>
                                          )
                                        })
                                      )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                      <tr>
                                        <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                                          합계
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${channelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${channelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${channelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                            return sum + (grandTotal - (item.commissionAmount || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${channelStats.netPrice.toLocaleString()}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 투어 진행 내역 탭 */}
        {activeDetailTab === 'tours' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setTourSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                title="투어 날짜로 정렬"
              >
                <span>투어 날짜 정렬</span>
                <span className={`transition-transform ${tourSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                </span>
              </button>
            </div>

            {toursLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                채널 데이터가 없습니다.
              </div>
            ) : (
              channelGroups.map(group => {
                const isGroupExpanded = expandedGroups.has(group.type)
                const groupTourItems = group.channels.flatMap(ch => getTourItemsByChannel(ch.id))
                const groupTotal = groupTourItems.reduce((sum, item) => {
                  const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                  const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                  const totalPrice = grandTotal - (item.commissionAmount || 0)
                  const netPrice = totalPrice + (item.optionTotal || 0)
                  return sum + netPrice
                }, 0)

                // 자체 채널은 바로 모든 예약을 합쳐서 표시
                if (group.type === 'SELF') {
                  // 자체 채널의 모든 투어 아이템 생성 및 정렬
                  const allTourItems = groupTourItems.sort((a, b) => {
                    const dateA = new Date(a.tourDate).getTime()
                    const dateB = new Date(b.tourDate).getTime()
                    return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                  })

                  return (
                    <div key={group.type} className="border-b border-gray-200">
                      {/* 자체 채널 그룹 헤더 */}
                      <button
                        onClick={() => toggleGroup(group.type)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {isGroupExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          )}
                          <span className="font-semibold text-gray-900">{group.label}</span>
                          <span className="text-sm text-gray-500">({group.channels.length}개 채널)</span>
                          <span className="text-sm font-medium text-green-600">
                            총 ${groupTotal.toLocaleString()}
                          </span>
                        </div>
                      </button>

                      {/* 자체 채널의 모든 투어 내역 테이블 */}
                      {isGroupExpanded && (
                        <div className="overflow-x-auto bg-gray-50">
                          <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">성인 가격</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품가격 합계</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">할인총액</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가비용 총액</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">커미션</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">총 가격</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">옵션 총합</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net 가격</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {allTourItems.length === 0 ? (
                                <tr>
                                  <td colSpan={16} className="px-2 py-3 text-center text-gray-500 text-xs">
                                    투어 진행 내역이 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                allTourItems.map((item, idx) => {
                                  const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                  const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                  const totalPrice = grandTotal - (item.commissionAmount || 0)
                                  const netPrice = totalPrice + (item.optionTotal || 0)
                                  return (
                                    <tr 
                                      key={`self-tour-${item.id}-${idx}`} 
                                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                                      onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                                    >
                                      <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                          {item.status === 'Confirmed' ? '확정' :
                                           item.status === 'Pending' ? '대기' :
                                           item.status === 'Canceled' ? '취소' :
                                           item.status === 'Completed' ? '완료' :
                                           item.status}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                        {new Date(item.tourDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                        {item.customerName}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                        {item.channelRN || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                        {item.channelName || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                        {item.productName}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center">
                                        {item.totalPeople}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                        ${(item.adultPrice || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                        ${(item.productPriceTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right">
                                        -${discountTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right">
                                        ${(item.additionalCost || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                        ${grandTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right">
                                        ${(item.commissionAmount || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                        ${totalPrice.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                        ${(item.optionTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right">
                                        ${netPrice.toLocaleString()}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={7} className="px-2 py-2 text-xs font-medium text-gray-900">
                                  합계
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                  -${allTourItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                    return sum + (grandTotal - (item.commissionAmount || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                  ${groupTotal.toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                }

                // OTA 채널은 기존대로 채널별로 나누어 표시
                return (
                  <div key={group.type} className="border-b border-gray-200">
                    {/* 그룹 헤더 */}
                    <button
                      onClick={() => toggleGroup(group.type)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {isGroupExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <span className="font-semibold text-gray-900">{group.label}</span>
                        <span className="text-sm text-gray-500">({group.channels.length}개 채널)</span>
                        <span className="text-sm font-medium text-green-600">
                          총 ${groupTotal.toLocaleString()}
                        </span>
                      </div>
                    </button>

                    {/* 채널 목록 */}
                    {isGroupExpanded && (
                      <div className="bg-gray-50">
                        {group.channels.map(channel => {
                          const channelTourItems = getTourItemsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 투어 아이템 정렬
                          const sortedChannelItems = channelTourItems.sort((a, b) => {
                            const dateA = new Date(a.tourDate).getTime()
                            const dateB = new Date(b.tourDate).getTime()
                            return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          // 채널별 통계 계산 (투어 진행 내역)
                          const channelStats = sortedChannelItems.reduce((acc, item) => {
                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                            const totalPrice = grandTotal - (item.commissionAmount || 0)
                            const netPrice = totalPrice + (item.optionTotal || 0)
                            
                            return {
                              grandTotal: acc.grandTotal + grandTotal,
                              commission: acc.commission + (item.commissionAmount || 0),
                              totalPrice: acc.totalPrice + totalPrice,
                              netPrice: acc.netPrice + netPrice
                            }
                          }, { grandTotal: 0, commission: 0, totalPrice: 0, netPrice: 0 })

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더 */}
                              <button
                                onClick={() => toggleChannel(channel.id)}
                                className="w-full px-8 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  {isChannelExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                  <span className="font-medium text-gray-800">{channel.name}</span>
                                  <span className="text-xs text-gray-500">({sortedChannelItems.length}건)</span>
                                  <div className="flex items-center space-x-4 text-xs">
                                    <span className="font-medium text-green-600">
                                      Grand Total: ${channelStats.grandTotal.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-blue-600">
                                      Commission: ${channelStats.commission.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 가격: ${channelStats.totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {/* 채널 투어 진행 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">성인 가격</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">상품가격 합계</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">할인총액</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가비용 총액</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">커미션</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">총 가격</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">옵션 총합</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net 가격</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {sortedChannelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={15} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            투어 진행 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        sortedChannelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const netPrice = totalPrice + (item.optionTotal || 0)
                                          return (
                                            <tr 
                                              key={`${channel.id}-tour-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'Confirmed' ? '확정' :
                                                   item.status === 'Pending' ? '대기' :
                                                   item.status === 'Canceled' ? '취소' :
                                                   item.status === 'Completed' ? '완료' :
                                                   item.status}
                                                </span>
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {new Date(item.tourDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                                {item.channelRN || '-'}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                                {item.productName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center">
                                                {item.totalPeople}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right">
                                                ${netPrice.toLocaleString()}
                                              </td>
                                            </tr>
                                          )
                                        })
                                      )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                      <tr>
                                        <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                                          합계
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${sortedChannelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                            return sum + (grandTotal - (item.commissionAmount || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${channelStats.netPrice.toLocaleString()}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

