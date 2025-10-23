'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Car, 
  Fuel, 
  Users, 
  Calendar,
  PieChart,
  LineChart,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { useReservationData } from '@/hooks/useReservationData'
import AdvancedCharts from './AdvancedCharts'
import { generateTourStatisticsPDF, generateChartPDF } from '@/utils/pdfExport'
import { supabase } from '@/lib/supabase'
import TourExpenseManager from '../TourExpenseManager'

interface TourStatisticsData {
  totalTours: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  averageProfitPerTour: number
  tourStats: Array<{
    tourId: string
    tourDate: string
    productName: string
    totalPeople: number
    revenue: number
    expenses: number
    netProfit: number
    vehicleType?: string
    gasCost?: number
    ticketBookingsCost?: number
    hotelBookingsCost?: number
    guideFee?: number
    assistantFee?: number
    hasValidTourId?: boolean
  }>
  expenseBreakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
  vehicleStats: Array<{
    vehicleType: string
    totalTours: number
    totalPeople: number
    averageGasCost: number
    totalGasCost: number
  }>
}

interface TourStatisticsTabProps {
  dateRange: { start: string; end: string }
}

// 날짜 포맷팅 함수 (시간대 문제 해결)
function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00') // 로컬 시간대로 처리
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 투어별 정산 통계를 가져오는 함수 (TourExpenseManager 로직 재사용)
async function getTourFinancialStats(tourId: string) {
  try {
    console.log('투어 정산 통계 조회 시작:', tourId)

    // 먼저 투어가 존재하는지 확인
    const { data: tourExists, error: tourExistsError } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .maybeSingle()

    if (tourExistsError) {
      console.error('투어 존재 확인 오류:', tourExistsError)
    }

    console.log(`투어 ${tourId} 존재 여부:`, !!tourExists)

    // 투어 지출이 있는지 확인 (상태 무관)
    const { data: allExpenses, error: allExpensesError } = await supabase
      .from('tour_expenses')
      .select('amount, status, paid_for')
      .eq('tour_id', tourId)

    if (allExpensesError) {
      console.error('전체 투어 지출 조회 오류:', allExpensesError)
    }

    console.log(`투어 ${tourId}의 전체 지출 (상태 무관):`, allExpenses)
    console.log(`투어 ${tourId}의 전체 지출 개수:`, allExpenses?.length || 0)

    // 예약 데이터 가져오기 (별도 쿼리로 고객 정보 조회)
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, customer_id, adults, child, infant')
      .eq('tour_id', tourId)

    if (reservationsError) {
      console.error('예약 데이터 조회 오류:', reservationsError)
      throw reservationsError
    }

    console.log('예약 데이터:', reservations)

    // 고객 정보 별도 조회
    let customersData = []
    if (reservations && reservations.length > 0) {
      const customerIds = [...new Set(reservations.map(r => r.customer_id).filter(Boolean))]
      
      if (customerIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        
        if (customersError) {
          console.error('고객 정보 조회 오류:', customersError)
          // 고객 정보가 없어도 계속 진행
        } else {
          customersData = customers || []
        }
      }
    }

    console.log('고객 데이터:', customersData)

    // 예약 가격 정보 가져오기
    const reservationIds = reservations?.map(r => r.id) || []
    let reservationPricing = []
    
    if (reservationIds.length > 0) {
      const { data: pricingData, error: pricingError } = await supabase
        .from('reservation_pricing')
        .select('reservation_id, total_price')
        .in('reservation_id', reservationIds)

      if (pricingError) {
        console.error('예약 가격 정보 조회 오류:', pricingError)
        // 가격 정보가 없어도 계속 진행
      } else {
        reservationPricing = pricingData || []
      }
    }

    console.log('예약 가격 정보:', reservationPricing)

    // 투어 지출 가져오기 (모든 상태의 지출 포함)
    const { data: expenses, error: expensesError } = await supabase
      .from('tour_expenses')
      .select('amount, paid_for, status')
      .eq('tour_id', tourId)

    if (expensesError) {
      console.error('투어 지출 조회 오류:', expensesError)
      // 지출 정보가 없어도 계속 진행
    }

    console.log(`투어 ${tourId}의 모든 지출 데이터:`, expenses)
    console.log(`투어 ${tourId}의 지출 개수:`, expenses?.length || 0)

    // 입장권 부킹 가져오기
    const { data: ticketBookings, error: ticketError } = await supabase
      .from('ticket_bookings')
      .select('expense')
      .eq('tour_id', tourId)
      .eq('status', 'confirmed')

    if (ticketError) {
      console.error('입장권 부킹 조회 오류:', ticketError)
      // 부킹 정보가 없어도 계속 진행
    }

    console.log('입장권 부킹:', ticketBookings)

    // 호텔 부킹 가져오기
    const { data: hotelBookings, error: hotelError } = await supabase
      .from('tour_hotel_bookings')
      .select('total_price')
      .eq('tour_id', tourId)
      .eq('status', 'confirmed')

    if (hotelError) {
      console.error('호텔 부킹 조회 오류:', hotelError)
      // 부킹 정보가 없어도 계속 진행
    }

    console.log('호텔 부킹:', hotelBookings)

    // 투어 수수료 가져오기 (투어가 존재하지 않을 수 있음)
    let tour = null
    try {
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('guide_fee, assistant_fee')
        .eq('id', tourId)
        .maybeSingle() // .single() 대신 .maybeSingle() 사용

      if (tourError) {
        console.error('투어 수수료 조회 오류:', tourError)
        // 투어가 존재하지 않아도 계속 진행
      } else {
        tour = tourData
      }
    } catch (error) {
      console.error('투어 수수료 조회 중 예외 발생:', error)
      // 예외가 발생해도 계속 진행
    }

    console.log('투어 수수료:', tour)

    // TourExpenseManager와 동일한 계산 로직 적용
    const totalPayments = reservationPricing?.reduce((sum, pricing) => sum + (pricing.total_price || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0
    const totalFees = (tour?.guide_fee || 0) + (tour?.assistant_fee || 0)
    const totalTicketCosts = ticketBookings?.reduce((sum, booking) => sum + (booking.expense || 0), 0) || 0
    const totalHotelCosts = hotelBookings?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0
    const totalBookingCosts = totalTicketCosts + totalHotelCosts
    const totalExpensesWithFeesAndBookings = totalExpenses + totalFees + totalBookingCosts
    const profit = totalPayments - totalExpensesWithFeesAndBookings

    console.log(`투어 ${tourId} 계산 결과:`, {
      totalPayments,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      expensesCount: expenses?.length || 0,
      ticketBookingsCount: ticketBookings?.length || 0,
      hotelBookingsCount: hotelBookings?.length || 0
    })

    const result = {
      tourId,
      totalPayments,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      reservationCount: reservations?.length || 0,
      totalPeople: reservations?.reduce((sum, r) => sum + (r.adults + r.child + r.infant), 0) || 0
    }

    console.log('투어 정산 통계 결과:', result)
    return result
  } catch (error) {
    console.error('투어 정산 통계 조회 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return {
      tourId,
      totalPayments: 0,
      totalExpenses: 0,
      totalFees: 0,
      totalTicketCosts: 0,
      totalHotelCosts: 0,
      totalBookingCosts: 0,
      totalExpensesWithFeesAndBookings: 0,
      profit: 0,
      reservationCount: 0,
      totalPeople: 0
    }
  }
}

export default function TourStatisticsTab({ dateRange }: TourStatisticsTabProps) {
  const {
    reservations,
    products,
    loading
  } = useReservationData()

  const [selectedChart, setSelectedChart] = useState<'profit' | 'expenses' | 'vehicles'>('profit')
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all')
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({})
  const [expenseDetails, setExpenseDetails] = useState<Record<string, any>>({})
  const [tourStatisticsData, setTourStatisticsData] = useState<TourStatisticsData>({
    totalTours: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    averageProfitPerTour: 0,
    tourStats: [],
    expenseBreakdown: [],
    vehicleStats: []
  })
  const [isCalculating, setIsCalculating] = useState(false)

  // 지출 상세 내역 토글
  const toggleExpenseDetails = async (tourId: string, tourDate?: string) => {
    const isExpanded = expandedExpenses[tourId]
    setExpandedExpenses(prev => ({
      ...prev,
      [tourId]: !isExpanded
    }))

    // 지출 상세 내역이 아직 로드되지 않은 경우 로드
    if (!isExpanded && !expenseDetails[tourId]) {
      try {
        const details = await getTourExpenseDetails(tourId, tourDate)
        setExpenseDetails(prev => ({
          ...prev,
          [tourId]: details
        }))
      } catch (error) {
        console.error('지출 상세 내역 로드 오류:', error)
      }
    }
  }

  // 투어별 상세 내역 가져오기 (지출 + 입금)
  const getTourExpenseDetails = async (tourId: string, tourDate?: string) => {
    try {
      // 투어 지출 상세 조회 (모든 상태의 지출 포함)
      const { data: expenses, error: expensesError } = await supabase
        .from('tour_expenses')
        .select('*')
        .eq('tour_id', tourId)

      // 입장권 부킹 상세 조회
      const { data: ticketBookings, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .eq('status', 'confirmed')

      // 호텔 부킹 상세 조회
      const { data: hotelBookings, error: hotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .eq('status', 'confirmed')

      // 투어 수수료 조회 (가이드/어시스턴트 이름 포함)
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('guide_fee, assistant_fee, tour_guide_id, assistant_id')
        .eq('id', tourId)
        .maybeSingle()

      // 가이드와 어시스턴트 이름 별도 조회 (team 테이블 사용)
      let guideName = ''
      let assistantName = ''
      
      if (tour?.tour_guide_id) {
        const { data: guideData } = await supabase
          .from('team')
          .select('name_ko')
          .eq('email', tour.tour_guide_id)
          .maybeSingle()
        guideName = guideData?.name_ko || ''
      }
      
      if (tour?.assistant_id) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('name_ko')
          .eq('email', tour.assistant_id)
          .maybeSingle()
        assistantName = assistantData?.name_ko || ''
      }

      // 입금 내역 조회 (예약별 입금 정보) - 날짜 필터링 적용
      let reservationsQuery = supabase
        .from('reservations')
        .select('id, customer_id, adults, child, infant')
        .eq('tour_id', tourId)

      // 날짜 필터링이 있는 경우 적용
      if (tourDate) {
        const reservationDate = new Date(tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        
        // 투어 날짜가 선택된 기간 내에 있는지 확인
        if (reservationDate >= startDate && reservationDate <= endDate) {
          // 날짜 필터링이 적용된 상태에서 조회
        } else {
          // 날짜 범위 밖이면 빈 결과 반환
          return {
            expenses: [],
            ticketBookings: [],
            hotelBookings: [],
            tourFees: { guide_fee: 0, assistant_fee: 0, guide_name: '', assistant_name: '' },
            reservations: [],
            customers: [],
            reservationPricing: []
          }
        }
      }

      const { data: reservations, error: reservationsError } = await reservationsQuery

      // 고객 정보 조회
      let customers: any[] = []
      if (reservations && reservations.length > 0) {
        const customerIds = reservations.map(r => r.customer_id).filter(Boolean)
        if (customerIds.length > 0) {
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds)

          customers = customersData || []
        }
      }

      // 예약 가격 정보 조회
      let reservationPricing: any[] = []
      if (reservations && reservations.length > 0) {
        const reservationIds = reservations.map(r => r.id)
        const { data: pricingData, error: pricingError } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price')
          .in('reservation_id', reservationIds)

        reservationPricing = pricingData || []
      }

      return {
        expenses: expenses || [],
        ticketBookings: ticketBookings || [],
        hotelBookings: hotelBookings || [],
        tourFees: { 
          guide_fee: tour?.guide_fee || 0, 
          assistant_fee: tour?.assistant_fee || 0, 
          guide_name: guideName, 
          assistant_name: assistantName
        },
        reservations: reservations || [],
        customers: customers || [],
        reservationPricing: reservationPricing || []
      }
    } catch (error) {
      console.error('상세 내역 조회 오류:', error)
      return {
        expenses: [],
        ticketBookings: [],
        hotelBookings: [],
        tourFees: { 
          guide_fee: 0, 
          assistant_fee: 0, 
          guide_name: '', 
          assistant_name: '',
          tour_guide: null,
          assistant: null
        },
        reservations: [],
        customers: [],
        reservationPricing: []
      }
    }
  }

  // 투어 통계 데이터 계산 (TourExpenseManager 로직 재사용)
  useEffect(() => {
    const calculateTourStatistics = async () => {
      if (!reservations.length) {
        setTourStatisticsData({
          totalTours: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          averageProfitPerTour: 0,
          tourStats: [],
          expenseBreakdown: [],
          vehicleStats: []
        })
        return
      }

      setIsCalculating(true)

      try {
        // 날짜 필터링된 예약들
        const filteredReservations = reservations.filter(reservation => {
          const reservationDate = new Date(reservation.tourDate)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          return reservationDate >= startDate && reservationDate <= endDate
        })

        // 투어별 그룹화 (tourId 기준)
        const tourGroups = filteredReservations.reduce((groups, reservation) => {
          // 실제 투어 ID가 있으면 사용, 없으면 날짜+상품ID로 생성
          const tourId = reservation.tourId || `${reservation.tourDate}-${reservation.productId}`
          
          if (!groups[tourId]) {
            groups[tourId] = {
              tourId,
              tourDate: reservation.tourDate,
              productId: reservation.productId,
              reservations: [],
              totalPeople: 0,
              hasValidTourId: !!reservation.tourId // 실제 투어 ID가 있는지 표시
            }
          }
          
          groups[tourId].reservations.push(reservation)
          groups[tourId].totalPeople += reservation.totalPeople
          
          return groups
        }, {} as Record<string, any>)

        console.log('투어 그룹:', tourGroups)

        // 투어 상태 확인 및 필터링 (한 번에 모든 투어 상태 조회)
        const validTourIds = []
        const tourIdsToCheck = Object.keys(tourGroups).filter(tourId => tourGroups[tourId].hasValidTourId)
        
        if (tourIdsToCheck.length > 0) {
          try {
            const { data: toursData, error: toursError } = await supabase
              .from('tours')
              .select('id, tour_status')
              .in('id', tourIdsToCheck)

            if (toursError) {
              console.error('투어 상태 조회 오류:', toursError)
            } else {
              console.log('투어 상태 데이터:', toursData)
              
              // Recruiting 또는 Confirmed 상태인 투어만 필터링
              const validTours = toursData?.filter(tour => 
                tour.tour_status === 'Recruiting' || tour.tour_status === 'Confirmed'
              ) || []
              
              validTourIds.push(...validTours.map(tour => tour.id))
              
              console.log('유효한 투어 상태:', validTours.map(tour => ({ id: tour.id, status: tour.tour_status })))
            }
          } catch (error) {
            console.error('투어 상태 조회 중 예외 발생:', error)
          }
        }

        console.log('유효한 투어 ID 목록:', validTourIds)

        // 유효한 투어만 필터링
        const filteredTourGroups = Object.fromEntries(
          Object.entries(tourGroups).filter(([tourId]) => validTourIds.includes(tourId))
        )

        console.log('필터링된 투어 그룹:', filteredTourGroups)

        // 각 투어별로 TourExpenseManager와 동일한 정산 통계 계산
        const tourStatsPromises = Object.values(filteredTourGroups).map(async (tour: any) => {
          console.log('투어 그룹 처리 중:', tour)
          
          // 투어 ID가 유효한지 확인
          if (!tour.hasValidTourId || !tour.tourId || tour.tourId.startsWith('undefined')) {
            console.log('유효하지 않은 투어 ID 또는 실제 투어가 없음:', tour.tourId)
            return {
              tourId: tour.tourId,
              tourDate: tour.tourDate,
              productName: products.find(p => p.id === tour.productId)?.name_ko || 'Unknown',
              totalPeople: tour.totalPeople,
              revenue: 0,
              expenses: 0,
              netProfit: 0,
              vehicleType: tour.totalPeople > 10 ? '대형버스' : '소형버스',
              gasCost: 0,
              ticketBookingsCost: 0,
              hotelBookingsCost: 0,
              guideFee: 0,
              assistantFee: 0,
              hasValidTourId: false
            }
          }

          console.log('투어 ID로 정산 통계 조회 시작:', tour.tourId)
          const financialStats = await getTourFinancialStats(tour.tourId)
          
          return {
            tourId: tour.tourId,
            tourDate: tour.tourDate,
            productName: products.find(p => p.id === tour.productId)?.name_ko || 'Unknown',
            totalPeople: financialStats.totalPeople,
            revenue: financialStats.totalPayments,
            expenses: financialStats.totalExpensesWithFeesAndBookings,
            netProfit: financialStats.profit,
            vehicleType: financialStats.totalPeople > 10 ? '대형버스' : '소형버스',
            gasCost: financialStats.totalExpenses,
            ticketBookingsCost: financialStats.totalTicketCosts,
            hotelBookingsCost: financialStats.totalHotelCosts,
            guideFee: financialStats.totalFees,
            assistantFee: 0, // 별도로 계산됨
            hasValidTourId: tour.hasValidTourId
          }
        })

        // Promise.all로 비동기 처리
        const resolvedTourStats = await Promise.all(tourStatsPromises)

        // 전체 통계 계산
        const totalTours = resolvedTourStats.length
        const totalRevenue = resolvedTourStats.reduce((sum, tour) => sum + tour.revenue, 0)
        const totalExpenses = resolvedTourStats.reduce((sum, tour) => sum + tour.expenses, 0)
        const netProfit = totalRevenue - totalExpenses
        const averageProfitPerTour = totalTours > 0 ? netProfit / totalTours : 0

        // 지출 분석 (실제 데이터 기반)
        const totalTourExpenses = resolvedTourStats.reduce((sum, tour) => sum + tour.gasCost, 0)
        const totalTicketBookings = resolvedTourStats.reduce((sum, tour) => sum + tour.ticketBookingsCost, 0)
        const totalHotelBookings = resolvedTourStats.reduce((sum, tour) => sum + tour.hotelBookingsCost, 0)
        const totalGuideFees = resolvedTourStats.reduce((sum, tour) => sum + tour.guideFee, 0)

        const expenseBreakdown = [
          { category: '투어 지출', amount: totalTourExpenses, percentage: 0 },
          { category: '입장권 부킹', amount: totalTicketBookings, percentage: 0 },
          { category: '호텔 부킹', amount: totalHotelBookings, percentage: 0 },
          { category: '가이드/어시스턴트비', amount: totalGuideFees, percentage: 0 }
        ]

        // 비율 계산
        expenseBreakdown.forEach(item => {
          item.percentage = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0
        })

        // 차량별 통계
        const vehicleGroups = resolvedTourStats.reduce((groups, tour) => {
          const vehicleType = tour.vehicleType || '소형버스'
          
          if (!groups[vehicleType]) {
            groups[vehicleType] = {
              vehicleType,
              totalTours: 0,
              totalPeople: 0,
              totalGasCost: 0
            }
          }
          
          groups[vehicleType].totalTours++
          groups[vehicleType].totalPeople += tour.totalPeople
          groups[vehicleType].totalGasCost += tour.gasCost
          
          return groups
        }, {} as Record<string, any>)

        const vehicleStats = Object.values(vehicleGroups).map((vehicle: any) => ({
          ...vehicle,
          averageGasCost: vehicle.totalTours > 0 ? vehicle.totalGasCost / vehicle.totalTours : 0
        }))

        setTourStatisticsData({
          totalTours,
          totalRevenue,
          totalExpenses,
          netProfit,
          averageProfitPerTour,
          tourStats: resolvedTourStats,
          expenseBreakdown,
          vehicleStats
        })
      } catch (error) {
        console.error('투어 통계 계산 오류:', error)
      } finally {
        setIsCalculating(false)
      }
    }

    calculateTourStatistics()
  }, [reservations, products, dateRange])

  // 차량별 가스비 비교 데이터
  const vehicleGasComparison = useMemo(() => {
    if (selectedVehicle === 'all') {
      return tourStatisticsData.vehicleStats
    }
    
    return tourStatisticsData.vehicleStats.filter(v => v.vehicleType === selectedVehicle)
  }, [tourStatisticsData.vehicleStats, selectedVehicle])

  if (loading || isCalculating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isCalculating ? '투어 통계를 계산 중입니다...' : '데이터를 불러오는 중입니다...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 투어 수</p>
              <p className="text-2xl font-bold text-gray-900">{tourStatisticsData.totalTours}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 수익</p>
              <p className="text-2xl font-bold text-gray-900">${tourStatisticsData.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 지출</p>
              <p className="text-2xl font-bold text-gray-900">${tourStatisticsData.totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">순수익</p>
              <p className={`text-2xl font-bold ${tourStatisticsData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${tourStatisticsData.netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 선택 탭 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex space-x-4 mb-6">
          {[
            { key: 'profit', label: '투어별 손익', icon: BarChart3 },
            { key: 'expenses', label: '지출 상세', icon: PieChart },
            { key: 'vehicles', label: '차량별 가스비', icon: Car }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                selectedChart === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 투어별 손익 차트 */}
        {selectedChart === 'profit' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">투어별 손익 분석</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => generateTourStatisticsPDF({ data: tourStatisticsData, dateRange })}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Download size={16} />
                  <span>전체 리포트</span>
                </button>
                <button 
                  onClick={() => generateChartPDF('profit-chart', '투어별손익차트.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트만</span>
                </button>
              </div>
            </div>
            
            {/* 고급 차트 */}
            <div id="profit-chart">
              <AdvancedCharts
                data={tourStatisticsData.tourStats.map(tour => ({
                  name: `${tour.productName} (${formatDate(tour.tourDate)})`,
                  revenue: tour.revenue,
                  expenses: tour.expenses,
                  profit: tour.netProfit,
                  people: tour.totalPeople
                }))}
                type="bar"
                title="투어별 손익 비교"
                height={400}
              />
            </div>
          </div>
        )}

        {/* 지출 상세 차트 */}
        {selectedChart === 'expenses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">지출 상세 분석</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => generateChartPDF('expense-chart', '지출분석차트.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트 다운로드</span>
                </button>
              </div>
            </div>
            
            {/* 파이 차트 */}
            <div id="expense-chart">
              <AdvancedCharts
                data={tourStatisticsData.expenseBreakdown.map(item => ({
                  name: item.category,
                  value: item.amount
                }))}
                type="pie"
                title="지출 구성 비율"
                height={400}
              />
            </div>

            {/* 지출 상세 테이블 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="font-semibold text-gray-700">지출 상세 내역</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">항목</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">비율</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">투어당 평균</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tourStatisticsData.expenseBreakdown.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${item.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.percentage.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${tourStatisticsData.totalTours > 0 ? (item.amount / tourStatisticsData.totalTours).toFixed(0) : 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 차량별 가스비 비교 */}
        {selectedChart === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">차량별 가스비 분석</h3>
              <div className="flex space-x-2">
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">전체 차량</option>
                  {tourStatisticsData.vehicleStats.map((vehicle, index) => (
                    <option key={index} value={vehicle.vehicleType}>
                      {vehicle.vehicleType}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={() => generateChartPDF('vehicle-chart', '차량별가스비차트.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트 다운로드</span>
                </button>
              </div>
            </div>
            
            {/* 차량별 가스비 차트 */}
            <div id="vehicle-chart">
              <AdvancedCharts
                data={vehicleGasComparison.map(vehicle => ({
                  name: vehicle.vehicleType,
                  value: vehicle.totalGasCost,
                  tours: vehicle.totalTours,
                  people: vehicle.totalPeople,
                  averageGasCost: vehicle.averageGasCost
                }))}
                type="bar"
                title="차량별 가스비 비교"
                height={400}
              />
            </div>

            {/* 차량별 상세 정보 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {vehicleGasComparison.map((vehicle, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center space-x-3">
                      <Car className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">{vehicle.vehicleType}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">${vehicle.totalGasCost.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">총 가스비</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">투어 수</p>
                      <p className="font-semibold">{vehicle.totalTours}회</p>
                    </div>
                    <div>
                      <p className="text-gray-600">총 인원</p>
                      <p className="font-semibold">{vehicle.totalPeople}명</p>
                    </div>
                    <div>
                      <p className="text-gray-600">평균 가스비</p>
                      <p className="font-semibold">${vehicle.averageGasCost.toFixed(0)}</p>
                    </div>
                  </div>
                  
                  {/* 인원별 가스비 효율성 표시 */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>인원당 가스비 효율성</span>
                      <span>${(vehicle.totalGasCost / vehicle.totalPeople).toFixed(2)}/명</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ 
                          width: `${Math.min((vehicle.totalPeople / Math.max(...vehicleGasComparison.map(v => v.totalPeople))) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 투어 통계 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">투어 상세 통계</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">투어 날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">순수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익률</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">1인당 수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">1인당 지출</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">1인당 순수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상세</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tourStatisticsData.tourStats.map((tour, index) => (
                <React.Fragment key={index}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(tour.tourDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tour.hasValidTourId ? (
                        <Link 
                          href={`/ko/admin/tours/${tour.tourId}`}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          <span>{tour.productName}</span>
                          <ExternalLink size={14} />
                        </Link>
                      ) : (
                        <span className="text-gray-500">{tour.productName}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tour.totalPeople}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      ${tour.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      ${tour.expenses.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      tour.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${tour.netProfit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tour.revenue > 0 ? ((tour.netProfit / tour.revenue) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      ${tour.totalPeople > 0 ? (tour.revenue / tour.totalPeople).toFixed(2) : 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      ${tour.totalPeople > 0 ? (tour.expenses / tour.totalPeople).toFixed(2) : 0}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      tour.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${tour.totalPeople > 0 ? (tour.netProfit / tour.totalPeople).toFixed(2) : 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => toggleExpenseDetails(tour.tourId, tour.tourDate)}
                        className="flex items-center justify-center space-x-1 hover:text-blue-700 transition-colors text-blue-600"
                        title="상세 내역 보기"
                      >
                        <Eye size={16} />
                        {expandedExpenses[tour.tourId] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* 지출 상세 내역 */}
                  {expandedExpenses[tour.tourId] && (
                    <tr>
                      <td colSpan={11} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900">상세 내역</h4>
                          
                          {expenseDetails[tour.tourId] ? (
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                              {/* 요약 컬럼 */}
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium text-gray-900 mb-2">요약</h5>
                                <div className="space-y-2 text-sm">
                                  {/* 입금액 */}
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">입금액</span>
                                    <span className="font-medium text-green-600">
                                      ${expenseDetails[tour.tourId].reservationPricing.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0).toLocaleString()}
                                    </span>
                                  </div>
                                  
                                  {/* 투어 지출 그룹화 */}
                                  {(() => {
                                    const expenseGroups = expenseDetails[tour.tourId].expenses.reduce((groups: any, expense: any) => {
                                      const key = expense.paid_for || '기타 지출'
                                      if (!groups[key]) {
                                        groups[key] = 0
                                      }
                                      groups[key] += expense.amount || 0
                                      return groups
                                    }, {})
                                    
                                    return Object.entries(expenseGroups).map(([paidFor, amount]: [string, any]) => (
                                      <div key={paidFor} className="flex justify-between">
                                        <span className="text-gray-600">{paidFor}</span>
                                        <span className="font-medium text-red-600">-${amount.toLocaleString()}</span>
                                      </div>
                                    ))
                                  })()}
                                  
                                  {/* 입장권 소계 */}
                                  {expenseDetails[tour.tourId].ticketBookings.length > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">입장권 소계</span>
                                      <span className="font-medium text-red-600">
                                        -${expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + (booking.expense || 0), 0).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* 투어호텔 소계 */}
                                  {expenseDetails[tour.tourId].hotelBookings.length > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">투어호텔 소계</span>
                                      <span className="font-medium text-red-600">
                                        -${expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + (booking.total_price || 0), 0).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* 가이드비/어시스턴트비 */}
                                  {(expenseDetails[tour.tourId].tourFees.guide_fee > 0 || expenseDetails[tour.tourId].tourFees.assistant_fee > 0) && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">가이드비/어시스턴트비</span>
                                      <span className="font-medium text-red-600">
                                        -${(expenseDetails[tour.tourId].tourFees.guide_fee + expenseDetails[tour.tourId].tourFees.assistant_fee).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* 구분선 */}
                                  <div className="border-t border-gray-300 my-2"></div>
                                  
                                  {/* 순수익 */}
                                  <div className="flex justify-between font-semibold">
                                    <span className="text-gray-900">순수익</span>
                                    <span className={`${(() => {
                                      const totalRevenue = expenseDetails[tour.tourId].reservationPricing.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0)
                                      const totalExpenses = 
                                        expenseDetails[tour.tourId].expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0) +
                                        expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + (booking.expense || 0), 0) +
                                        expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + (booking.total_price || 0), 0) +
                                        expenseDetails[tour.tourId].tourFees.guide_fee +
                                        expenseDetails[tour.tourId].tourFees.assistant_fee
                                      const netProfit = totalRevenue - totalExpenses
                                      return netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                    })()}`}>
                                      ${(() => {
                                        const totalRevenue = expenseDetails[tour.tourId].reservationPricing.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0)
                                        const totalExpenses = 
                                          expenseDetails[tour.tourId].expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0) +
                                          expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + (booking.expense || 0), 0) +
                                          expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + (booking.total_price || 0), 0) +
                                          expenseDetails[tour.tourId].tourFees.guide_fee +
                                          expenseDetails[tour.tourId].tourFees.assistant_fee
                                        return (totalRevenue - totalExpenses).toLocaleString()
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 투어 지출 */}
                              {expenseDetails[tour.tourId].expenses.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">투어 지출</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].expenses.map((expense: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-gray-600">{expense.paid_for || '지출 항목'}</span>
                                          <span className={`px-2 py-1 text-xs rounded ${
                                            expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {expense.status === 'approved' ? '승인' :
                                             expense.status === 'pending' ? '대기' :
                                             expense.status === 'rejected' ? '거부' : expense.status}
                                          </span>
                                        </div>
                                        <span className="font-medium">${expense.amount?.toLocaleString() || 0}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 입장권 부킹 */}
                              {expenseDetails[tour.tourId].ticketBookings.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">입장권 부킹</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].ticketBookings.map((booking: any, idx: number) => {
                                      const totalPeople = expenseDetails[tour.tourId].reservations.reduce((sum: number, r: any) => sum + r.adults + r.child + r.infant, 0)
                                      const perPersonPrice = totalPeople > 0 ? (booking.expense || 0) / totalPeople : 0
                                      
                                      return (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <div className="flex flex-col">
                                            <span className="text-gray-600">{booking.ticket_name || '입장권'}</span>
                                            <span className="text-xs text-gray-500">총 {totalPeople}명</span>
                                          </div>
                                          <div className="flex flex-col text-right">
                                            <span className="font-medium">${booking.expense?.toLocaleString() || 0}</span>
                                            <span className="text-xs text-gray-500">1인당: ${perPersonPrice.toFixed(2)}</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* 호텔 부킹 */}
                              {expenseDetails[tour.tourId].hotelBookings.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">호텔 부킹</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].hotelBookings.map((booking: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{booking.hotel_name || '호텔'}</span>
                                        <span className="font-medium">${booking.total_price?.toLocaleString() || 0}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 가이드/어시스턴트 수수료 */}
                              {(expenseDetails[tour.tourId].tourFees.guide_fee > 0 || expenseDetails[tour.tourId].tourFees.assistant_fee > 0) && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">가이드/어시스턴트 수수료</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].tourFees.guide_fee > 0 && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                          가이드 수수료 {expenseDetails[tour.tourId].tourFees.guide_name ? `(${expenseDetails[tour.tourId].tourFees.guide_name})` : ''}
                                        </span>
                                        <span className="font-medium">${expenseDetails[tour.tourId].tourFees.guide_fee.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {expenseDetails[tour.tourId].tourFees.assistant_fee > 0 && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                          어시스턴트 수수료 {expenseDetails[tour.tourId].tourFees.assistant_name ? `(${expenseDetails[tour.tourId].tourFees.assistant_name})` : ''}
                                        </span>
                                        <span className="font-medium">${expenseDetails[tour.tourId].tourFees.assistant_fee.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 입금 내역 */}
                              {expenseDetails[tour.tourId].reservations.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">입금 내역</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].reservations.map((reservation: any, idx: number) => {
                                      const customer = expenseDetails[tour.tourId].customers.find((c: any) => c.id === reservation.customer_id)
                                      const pricing = expenseDetails[tour.tourId].reservationPricing.find((p: any) => p.reservation_id === reservation.id)
                                      const totalPeople = reservation.adults + reservation.child + reservation.infant
                                      const perPersonPrice = totalPeople > 0 ? (pricing?.total_price || 0) / totalPeople : 0
                                      
                                      return (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <div className="flex flex-col">
                                            <span className="text-gray-600 font-medium">{customer?.name || '고객'}</span>
                                            <span className="text-xs text-gray-500">
                                              성인 {reservation.adults}명, 아동 {reservation.child}명, 유아 {reservation.infant}명
                                            </span>
                                          </div>
                                          <div className="flex flex-col text-right">
                                            <span className="font-medium text-green-600">${pricing?.total_price?.toLocaleString() || 0}</span>
                                            <span className="text-xs text-gray-500">1인당: ${perPersonPrice.toFixed(2)}</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                              <p className="text-sm text-gray-500 mt-2">상세 내역을 불러오는 중...</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
