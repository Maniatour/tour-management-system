'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { DollarSign, Users, Calendar, Search, ChevronDown } from 'lucide-react'
import { useReservationData } from '@/hooks/useReservationData'
import { getChannelName, getProductName, getCustomerName, getStatusColor } from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

interface ChannelSettlementTabProps {
  dateRange: { start: string; end: string }
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
  status: string
  channelRN: string
  totalPrice: number
}

// TourItem을 ReservationItem과 동일하게 사용

export default function ChannelSettlementTab({ dateRange }: ChannelSettlementTabProps) {
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

  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [toursLoading, setToursLoading] = useState(false)
  const [tourItems, setTourItems] = useState<ReservationItem[]>([])
  const [reservationPrices, setReservationPrices] = useState<Record<string, number>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'reservations' | 'tours'>('reservations')
  const [reservationSortOrder, setReservationSortOrder] = useState<'asc' | 'desc'>('asc')
  const [tourSortOrder, setTourSortOrder] = useState<'asc' | 'desc'>('asc')

  // 선택된 채널의 예약 내역 필터링 (등록일 기준)
  const filteredReservations = useMemo(() => {
    if (!selectedChannelId) return []
    
    return reservations.filter(reservation => {
      // 채널 필터
      if (reservation.channelId !== selectedChannelId) return false
      
      // 등록일 필터 (addedTime 기준)
      const registrationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999) // 하루의 끝까지 포함
      
      return registrationDate >= startDate && registrationDate <= endDate
    })
  }, [reservations, selectedChannelId, dateRange])

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
          .select('reservation_id, total_price')
          .in('reservation_id', reservationIds)

        if (error) {
          console.error('예약 가격 조회 오류:', error)
          setReservationPrices({})
          return
        }

        const pricesMap: Record<string, number> = {}
        pricingData?.forEach(p => {
          pricesMap[p.reservation_id] = p.total_price || 0
        })

        setReservationPrices(pricesMap)
      } catch (error) {
        console.error('예약 가격 정보 가져오기 오류:', error)
        setReservationPrices({})
      } finally {
        setPricesLoading(false)
      }
    }

    fetchPrices()
  }, [filteredReservations])

  // 예약 내역 데이터 포맷팅 및 정렬 (등록일 기준)
  const reservationItems = useMemo<ReservationItem[]>(() => {
    const items = filteredReservations.map(reservation => {
      return {
        id: reservation.id,
        tourDate: reservation.tourDate,
        registrationDate: reservation.addedTime,
        customerId: reservation.customerId,
        customerName: getCustomerName(reservation.customerId, customers || []),
        productId: reservation.productId,
        productName: getProductName(reservation.productId, products || []),
        totalPeople: reservation.totalPeople,
        status: reservation.status,
        channelRN: reservation.channelRN || '',
        totalPrice: reservationPrices[reservation.id] || 0
      }
    })
    
    // 등록일별 정렬
    return items.sort((a, b) => {
      const dateA = new Date(a.registrationDate).getTime()
      const dateB = new Date(b.registrationDate).getTime()
      return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [filteredReservations, customers, products, reservationPrices, reservationSortOrder])

  // 선택된 채널의 투어 진행 내역 가져오기 (투어 날짜 기준 예약 목록)
  useEffect(() => {
    const fetchTourReservations = async () => {
      if (!selectedChannelId) {
        setTourItems([])
        return
      }

      setToursLoading(true)
      try {
        // 선택된 채널의 예약들 중 투어 날짜가 기간 내에 있는 것들
        // 투어 날짜 기준으로 필터링
        const tourDateFilteredReservations = reservations.filter(reservation => {
          // 채널 필터
          if (reservation.channelId !== selectedChannelId) return false
          
          // 투어 날짜 필터
          const tourDate = new Date(reservation.tourDate)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          
          return tourDate >= startDate && tourDate <= endDate
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
          .select('reservation_id, total_price')
          .in('reservation_id', reservationIds)

        const pricesMap: Record<string, number> = {}
        pricingData?.forEach(p => {
          pricesMap[p.reservation_id] = p.total_price || 0
        })

        // 예약 아이템으로 변환
        const tourReservationItems: ReservationItem[] = tourDateFilteredReservations.map(reservation => ({
          id: reservation.id,
          tourDate: reservation.tourDate,
          registrationDate: reservation.addedTime,
          customerId: reservation.customerId,
          customerName: getCustomerName(reservation.customerId, customers || []),
          productId: reservation.productId,
          productName: getProductName(reservation.productId, products || []),
          totalPeople: reservation.totalPeople,
          status: reservation.status,
          channelRN: reservation.channelRN || '',
          totalPrice: pricesMap[reservation.id] || 0
        }))

        setTourItems(tourReservationItems)
      } catch (error) {
        console.error('투어 진행 내역 조회 오류:', error)
        setTourItems([])
      } finally {
        setToursLoading(false)
      }
    }

    fetchTourReservations()
  }, [selectedChannelId, reservations, dateRange, customers, products])

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
      {/* 채널 선택 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">채널 선택:</label>
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
          >
            <option value="">채널을 선택하세요</option>
            {channels?.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          {selectedChannelId && (
            <span className="text-sm text-gray-600">
              선택 기간: {dateRange.start} ~ {dateRange.end}
            </span>
          )}
        </div>
      </div>

      {!selectedChannelId && (
        <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">채널을 선택하시면 정산 내역을 확인할 수 있습니다.</p>
        </div>
      )}

      {selectedChannelId && (
        <>
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
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => setReservationSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900"
                        title="등록일로 정렬"
                      >
                        <span>등록일</span>
                        <span className={`transition-transform ${reservationSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                          <ChevronDown size={14} />
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널 RN</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservationItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        {pricesLoading ? '가격 정보를 불러오는 중...' : '예약 내역이 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    reservationItems.map((item, idx) => (
                      <tr 
                        key={`reservation-${item.id}-${idx}`} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(item.registrationDate).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.totalPeople}명
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          ${item.totalPrice.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                            {item.status === 'confirmed' ? '확정' :
                             item.status === 'pending' ? '대기' :
                             item.status === 'cancelled' ? '취소' :
                             item.status === 'completed' ? '완료' :
                             item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.channelRN || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900">
                      합계
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {totals.reservations.totalPeople}명
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${totals.reservations.totalPrice.toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            )}

            {/* 투어 진행 내역 탭 */}
            {activeDetailTab === 'tours' && (
              <div>
                {toursLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <button
                          onClick={() => setTourSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900"
                          title="투어 날짜로 정렬"
                        >
                          <span>투어 날짜</span>
                          <span className={`transition-transform ${tourSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={14} />
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널 RN</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedTourItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          {toursLoading ? '투어 진행 내역을 불러오는 중...' : '투어 진행 내역이 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      sortedTourItems.map((item, idx) => (
                        <tr 
                          key={`tour-${item.id}-${idx}`} 
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/${locale}/admin/reservations/${item.id}`)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(item.tourDate).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.customerName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.productName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.totalPeople}명
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                            ${item.totalPrice.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                              {item.status === 'confirmed' ? '확정' :
                               item.status === 'pending' ? '대기' :
                               item.status === 'cancelled' ? '취소' :
                               item.status === 'completed' ? '완료' :
                               item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.channelRN || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900">
                        합계
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {totals.tours.totalPeople}명
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        ${totals.tours.totalPrice.toLocaleString()}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

