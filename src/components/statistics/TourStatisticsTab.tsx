'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLocale } from 'next-intl'
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
import {
  hotelAmountForSettlement,
  isHotelBookingIncludedInSettlement,
  isTicketBookingEaIncludedInNetCount,
  isTicketBookingIncludedInSettlement,
  ticketEaAsNumber,
  ticketExpenseForSettlement
} from '@/lib/bookingSettlement'
import TourExpenseManager from '../TourExpenseManager'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'

interface TourStatisticsData {
  totalTours: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  averageProfitPerTour: number
  totalAdditionalCostRounded: number
  tourStats: Array<{
    tourId: string
    tourDate: string
    productName: string
    totalPeople: number
    revenue: number
    expenses: number
    netProfit: number
    additionalCostRounded: number
    vehicleType?: string
    gasCost?: number
    ticketBookingsCost?: number
    ticketBookingsEa?: number
    hotelBookingsCost?: number
    guideFee?: number
    assistantFee?: number
    notIncludedPrice?: number
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

type TourStatsFiltersState = {
  selectedChart: 'profit' | 'expenses' | 'vehicles' | 'daily'
  dailyMetric: 'revenue' | 'expenses' | 'profit' | 'people'
  selectedProducts: string[]
  tourSearch: string
  perPersonMetric: 'none' | 'revenuePer' | 'expensesPer' | 'profitPer'
  selectedVehicle: string
  dateSortDir: 'asc' | 'desc'
}

const DEFAULT_TOUR_STATS_FILTERS: TourStatsFiltersState = {
  selectedChart: 'profit',
  dailyMetric: 'profit',
  selectedProducts: [],
  tourSearch: '',
  perPersonMetric: 'none',
  selectedVehicle: 'all',
  dateSortDir: 'asc',
}

/** 티켓 ea vs 인원 불일치 시 빨간 표시를 하지 않는 상품(상품명 부분 일치) */
const PRODUCT_SUBSTRINGS_EXEMPT_TICKET_EA_MISMATCH = [
  '라스베가스 야경',
  '데쓰밸리',
  '데스밸리',
  'Death Valley',
  '공항 샌딩',
  '공항샌딩',
  '공항 픽업',
  '공항픽업',
  '드라이버 서비스',
  '드라이버서비스',
] as const

function isProductExemptFromTicketEaMismatchCheck(productName: string): boolean {
  const n = (productName || '').trim()
  if (!n) return false
  return PRODUCT_SUBSTRINGS_EXEMPT_TICKET_EA_MISMATCH.some((k) => n.includes(k))
}

function TourStatisticsTourDetailModal({
  open,
  onOpenChange,
  tourId,
  productName,
  locale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tourId: string | null
  productName: string
  locale: string
}) {
  const href = tourId ? `/${locale}/admin/tours/${tourId}` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden z-[100] sm:rounded-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
          <DialogTitle className="text-base font-semibold leading-snug truncate flex-1 min-w-0" title={productName}>
            {productName}
          </DialogTitle>
          {tourId ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 shrink-0 ml-2"
            >
              새 탭에서 열기
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : null}
        </DialogHeader>
        {tourId ? (
          <iframe
            key={tourId}
            title={productName ? `${productName} 투어 상세` : '투어 상세'}
            src={href}
            className="w-full flex-1 min-h-0 border-0 bg-white"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
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

    // 먼저 투어가 존재하는지 확인 (reservation_ids와 수수료 함께 조회)
    const { data: tourRow, error: tourExistsError } = await supabase
      .from('tours')
      .select('id, reservation_ids, guide_fee, assistant_fee')
      .eq('id', tourId)
      .maybeSingle()

    if (tourExistsError) {
      console.error('투어 존재 확인 오류:', tourExistsError)
    }

    console.log(`투어 ${tourId} 존재 여부:`, !!tourRow)

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

    // 예약 데이터 가져오기: tour.reservation_ids 기준으로 합산 (취소 여부 무관, 모든 예약 포함)
    let reservations: any[] = []
    if (tourRow?.reservation_ids && Array.isArray(tourRow.reservation_ids) && tourRow.reservation_ids.length > 0) {
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, customer_id, total_people')
        .in('id', tourRow.reservation_ids)

      if (reservationsError) {
        console.error('예약 데이터 조회 오류:', reservationsError)
        throw reservationsError
      }
      reservations = reservationsData || []
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

    // 예약 가격 정보 및 실입금 정보 가져오기
    const reservationIds = reservations?.map(r => r.id) || []
    let reservationPricing: any[] = []
    let paymentRecords: Array<{ reservation_id: string; amount: number; payment_status?: string | null }> = []
    let reservationExpenses: Record<string, number> = {}
    let reservationChannels: Record<string, any> = {}
    
    if (reservationIds.length > 0) {
      // 예약 정보에서 channel_id 가져오기
      const { data: reservationsWithChannel } = await supabase
        .from('reservations')
        .select('id, channel_id')
        .in('id', reservationIds)
      
      if (reservationsWithChannel) {
        const channelIds = [...new Set(reservationsWithChannel.map(r => r.channel_id).filter(Boolean))]
        if (channelIds.length > 0) {
          const { data: channelsData } = await supabase
            .from('channels')
            .select('id, commission_base_price_only')
            .in('id', channelIds)
          
          if (channelsData) {
            const channelMap = new Map(channelsData.map(c => [c.id, c]))
            reservationsWithChannel.forEach(r => {
              if (r.channel_id) {
                reservationChannels[r.id] = channelMap.get(r.channel_id) || {}
              }
            })
          }
        }
      }
      
      // 배치 크기 제한: URL 길이 제한을 피하기 위해 작은 배치로 나눠서 조회
      const BATCH_SIZE = 20

      // reservation_pricing 배치 조회 (예약 많은 투어에서 URL/응답 제한 방지)
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
        const { data: batchPricing, error: batchPricingError } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price, product_price_total, option_total, choices_total, coupon_discount, additional_discount, additional_cost, not_included_price, card_fee, prepayment_tip, commission_amount, commission_percent')
          .in('reservation_id', batchIds)
        if (batchPricingError) {
          console.error(`예약 가격 정보 조회 오류 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, batchPricingError)
        } else if (batchPricing?.length) {
          reservationPricing.push(...batchPricing)
        }
      }

      // reservation_expenses 배치 조회
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
        const { data: batchExpenses, error: batchExpensesError } = await supabase
          .from('reservation_expenses')
          .select('reservation_id, amount')
          .in('reservation_id', batchIds)
        if (batchExpensesError) {
          console.error(`예약 지출 정보 조회 오류 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, batchExpensesError)
        } else if (batchExpenses?.length) {
          batchExpenses.forEach((expense: any) => {
            if (!reservationExpenses[expense.reservation_id]) {
              reservationExpenses[expense.reservation_id] = 0
            }
            reservationExpenses[expense.reservation_id] += expense.amount || 0
          })
        }
      }

      // payment_records는 배치로 나눠서 조회 (URL 길이 제한 방지)
      const allPaymentRecords: Array<{ reservation_id: string; amount: number; payment_status?: string | null }> = []
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
        try {
          const { data: batchPayments, error: batchPaymentsError } = await supabase
            .from('payment_records')
            .select('reservation_id, amount, payment_status')
            .in('reservation_id', batchIds)
          
          if (batchPaymentsError) {
            console.error(`실입금 정보 조회 오류 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, batchPaymentsError)
          } else if (batchPayments) {
            allPaymentRecords.push(...batchPayments)
          }
        } catch (error) {
          console.error(`실입금 정보 조회 예외 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, error)
        }
      }
      paymentRecords = allPaymentRecords
    }

    console.log('예약 가격 정보:', reservationPricing)
    console.log('실입금 레코드:', paymentRecords)
    console.log('예약 지출:', reservationExpenses)
    console.log('예약 채널:', reservationChannels)

    // Operating Profit 계산 함수들 (TourExpenseManager 로직 재사용)
    const calculateNetPrice = (pricing: any, reservationId: string): number => {
      if (!pricing || !pricing.total_price) return 0
      
      const grandTotal = pricing.total_price
      const channel = reservationChannels[reservationId]
      const commissionBasePriceOnly = channel?.commission_base_price_only || false
      
      let commissionAmount = 0
      if (pricing.commission_amount && pricing.commission_amount > 0) {
        commissionAmount = pricing.commission_amount
      } else if (pricing.commission_percent && pricing.commission_percent > 0) {
        if (commissionBasePriceOnly) {
          // 판매가격에만 커미션 적용
          const productPriceTotal = pricing.product_price_total || 0
          const couponDiscount = pricing.coupon_discount || 0
          const additionalDiscount = pricing.additional_discount || 0
          const additionalCost = pricing.additional_cost || 0
          const basePriceForCommission = productPriceTotal - couponDiscount - additionalDiscount + additionalCost
          commissionAmount = basePriceForCommission * (pricing.commission_percent / 100)
        } else {
          // 전체 가격에 커미션 적용
          commissionAmount = grandTotal * (pricing.commission_percent / 100)
        }
      }
      
      return grandTotal - commissionAmount
    }
    
    const calculateTotalCustomerPayment = (pricing: any): number => {
      const productPriceTotal = pricing.product_price_total || 0
      const couponDiscount = pricing.coupon_discount || 0
      const additionalDiscount = pricing.additional_discount || 0
      const additionalCost = pricing.additional_cost || 0
      const optionTotal = pricing.option_total || 0
      const choicesTotal = pricing.choices_total || 0
      const cardFee = pricing.card_fee || 0
      const prepaymentTip = pricing.prepayment_tip || 0
      
      return (
        (productPriceTotal - couponDiscount - additionalDiscount) +
        optionTotal +
        choicesTotal +
        additionalCost +
        cardFee +
        prepaymentTip
      )
    }
    
    const calculateAdditionalPayment = (pricing: any, reservationId: string): number => {
      const totalCustomerPayment = calculateTotalCustomerPayment(pricing)
      const commissionAmount = pricing.commission_amount || 0
      const netPrice = calculateNetPrice(pricing, reservationId)
      
      const additionalPayment = totalCustomerPayment - commissionAmount - netPrice
      return Math.max(0, additionalPayment)
    }
    
    const calculateOperatingProfit = (pricing: any, reservationId: string): number => {
      const netPrice = calculateNetPrice(pricing, reservationId)
      const reservationExpense = reservationExpenses[reservationId] || 0
      const additionalPayment = calculateAdditionalPayment(pricing, reservationId)
      
      return netPrice - reservationExpense + additionalPayment
    }

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

    const { data: ticketBookingsRaw, error: ticketError } = await supabase
      .from('ticket_bookings')
      .select('id, expense, ea, status')
      .eq('tour_id', tourId)
    const ticketBookings = (ticketBookingsRaw || []).filter((b) =>
      isTicketBookingIncludedInSettlement(b.status)
    )
    if (ticketError) console.error('입장권 부킹 조회 오류:', ticketError)
    if (ticketBookings.length > 0) console.log('입장권 부킹:', ticketBookings.length, '건')

    const { data: hotelBookingsRaw, error: hotelError } = await supabase
      .from('tour_hotel_bookings')
      .select('total_price, unit_price, rooms, status')
      .eq('tour_id', tourId)
    const hotelBookings = (hotelBookingsRaw || []).filter((b) =>
      isHotelBookingIncludedInSettlement(b.status)
    )

    if (hotelError) {
      console.error('호텔 부킹 조회 오류:', hotelError)
      // 부킹 정보가 없어도 계속 진행
    }

    console.log('호텔 부킹:', hotelBookings)

    // 투어 수수료: 위 조회에서 함께 가져옴
    const tour = tourRow
    console.log('투어 수수료:', { guide_fee: tour?.guide_fee, assistant_fee: tour?.assistant_fee })

    // reservation_ids에 있는 예약만 필터링 (추가 확인)
    const reservationIdsArray = tourRow?.reservation_ids && Array.isArray(tourRow.reservation_ids) ? tourRow.reservation_ids : []
    const filteredReservationPricing = reservationIdsArray.length > 0
      ? reservationPricing.filter(p => reservationIdsArray.includes(p.reservation_id))
      : reservationPricing

    // 총 Operating Profit 계산 (각 예약의 Operating Profit 합산) - reservation_ids에 있는 예약만
    const totalOperatingProfit = filteredReservationPricing.reduce((sum, pricing) => {
      return sum + calculateOperatingProfit(pricing, pricing.reservation_id)
    }, 0)
    
    // 추가비용 계산 ($100 단위로 내림한 후 합산) - reservation_ids에 있는 예약만
    const totalAdditionalCostRounded = filteredReservationPricing.reduce((sum, pricing) => {
      const additionalCost = pricing.additional_cost || 0
      const rounded = Math.floor(additionalCost / 100) * 100
      return sum + rounded
    }, 0)
    
    // 비거주자 옵션 비용: reservation_options 기준, status가 cancelled/refunded가 아닌 것만 합산
    const NON_RESIDENT_OPTION_ID = '6941b5d0'
    const excludeStatus = (s: string) => {
      const lower = (s || '').toLowerCase().trim()
      return lower === 'cancelled' || lower === 'refunded'
    }
    const OPTIONS_BATCH = 100
    let totalNotIncludedPriceFromOptions = 0
    if (reservationIdsArray.length > 0) {
      let optionsRows: any[] = []
      for (let i = 0; i < reservationIdsArray.length; i += OPTIONS_BATCH) {
        const batch = reservationIdsArray.slice(i, i + OPTIONS_BATCH)
        const { data: batchOpts } = await supabase
          .from('reservation_options')
          .select('reservation_id, option_id, total_price, ea, price, status')
          .in('reservation_id', batch)
        if (batchOpts?.length) optionsRows = optionsRows.concat(batchOpts)
      }
      const validRows = optionsRows.filter((r: any) => !excludeStatus(r?.status))
      const fromFixedId = validRows
        .filter((r: any) => String(r?.option_id || '').trim() === NON_RESIDENT_OPTION_ID)
        .reduce((sum, r) => sum + (Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))), 0)
      if (fromFixedId > 0) {
        totalNotIncludedPriceFromOptions = fromFixedId
      } else if (validRows.length > 0) {
        const uniqueOptionIds = [...new Set(validRows.map((r: any) => String(r.option_id || '').trim()).filter(Boolean))]
        if (uniqueOptionIds.length > 0) {
          let optRows: any[] = []
          for (let i = 0; i < uniqueOptionIds.length; i += OPTIONS_BATCH) {
            const batch = uniqueOptionIds.slice(i, i + OPTIONS_BATCH)
            const { data: opts } = await supabase.from('options').select('id, name, category').in('id', batch)
            if (opts?.length) optRows = optRows.concat(opts)
          }
          const nonResidentIds = new Set(
            optRows
              .filter((o: any) => {
                const name = (o.name || '').toLowerCase()
                const cat = (o.category || '').toLowerCase()
                return name.includes('entrance') || name.includes('비거주자') || name.includes('입장료') || cat.includes('entrance') || cat.includes('fee')
              })
              .map((o: any) => String(o.id).trim())
          )
          totalNotIncludedPriceFromOptions = validRows
            .filter((r: any) => nonResidentIds.has(String(r.option_id || '').trim()))
            .reduce((sum, r) => sum + (Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))), 0)
        }
      }
    }
    const reservationPeopleMap: Record<string, number> = {}
    reservations?.forEach((r: any) => { reservationPeopleMap[r.id] = r.total_people || 0 })
    const totalNotIncludedPriceFromPricing = filteredReservationPricing.reduce((sum, pricing) => {
      const people = reservationPeopleMap[pricing.reservation_id] || 0
      return sum + (pricing.not_included_price || 0) * people
    }, 0)
    const totalNotIncludedPrice = totalNotIncludedPriceFromOptions > 0 ? totalNotIncludedPriceFromOptions : totalNotIncludedPriceFromPricing
    
    const totalPayments = filteredReservationPricing?.reduce((sum, pricing) => sum + (pricing.total_price || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0
    const totalFees = (tour?.guide_fee || 0) + (tour?.assistant_fee || 0)
    const totalTicketCosts =
      ticketBookings?.reduce((sum, booking) => sum + ticketExpenseForSettlement(booking), 0) || 0
    const totalTicketEa =
      (ticketBookingsRaw || []).reduce((sum, booking) => {
        if (!isTicketBookingEaIncludedInNetCount(booking.status)) return sum
        return sum + ticketEaAsNumber(booking.ea)
      }, 0) || 0
    const totalHotelCosts =
      hotelBookings?.reduce((sum, booking) => sum + hotelAmountForSettlement(booking), 0) || 0
    const totalBookingCosts = totalTicketCosts + totalHotelCosts
    const totalExpensesWithFeesAndBookings = totalExpenses + totalFees + totalBookingCosts
    const profit = totalOperatingProfit - totalExpensesWithFeesAndBookings

    console.log(`투어 ${tourId} 계산 결과:`, {
      totalPayments,
      totalOperatingProfit,
      totalAdditionalCostRounded,
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

    // reservation_ids에 있는 예약들의 total_people만 합산 (다른 조건 없음)
    const totalPeopleFromReservations = reservations?.reduce((sum, r) => {
      return sum + (r.total_people || 0)
    }, 0) || 0

    const result = {
      tourId,
      totalPayments,
      totalOperatingProfit,
      totalAdditionalCostRounded,
      totalNotIncludedPrice,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalTicketEa,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      reservationCount: reservations?.length || 0,
      totalPeople: totalPeopleFromReservations
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
      totalOperatingProfit: 0,
      totalAdditionalCostRounded: 0,
      totalNotIncludedPrice: 0,
      totalExpenses: 0,
      totalFees: 0,
      totalTicketCosts: 0,
      totalTicketEa: 0,
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
  const locale = useLocale()
  const {
    reservations,
    products,
    loading
  } = useReservationData()

  const [tourDetailModal, setTourDetailModal] = useState<{ tourId: string; productName: string } | null>(null)
  const [filters, setFilters] = useRoutePersistedState<TourStatsFiltersState>(
    'tour-filters',
    DEFAULT_TOUR_STATS_FILTERS
  )
  const {
    selectedChart,
    dailyMetric,
    selectedProducts,
    tourSearch,
    perPersonMetric,
    selectedVehicle,
    dateSortDir,
  } = filters
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

      // 입장권 부킹 상세 (expense 합 — 정산 기준과 동일)
      const { data: ticketBookingsRaw, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)
      const ticketBookings = (ticketBookingsRaw || []).filter((b) =>
        isTicketBookingIncludedInSettlement(b.status)
      )

      const { data: hotelBookingsRaw, error: hotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
      const hotelBookings = (hotelBookingsRaw || []).filter((b) =>
        isHotelBookingIncludedInSettlement(b.status)
      )

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
          .select('name_ko, nick_name')
          .eq('email', tour.tour_guide_id)
          .maybeSingle()
        guideName = guideData?.nick_name || guideData?.name_ko || ''
      }
      
      if (tour?.assistant_id) {
        const { data: assistantData } = await supabase
          .from('team')
          .select('name_ko, nick_name')
          .eq('email', tour.assistant_id)
          .maybeSingle()
        assistantName = assistantData?.nick_name || assistantData?.name_ko || ''
      }

      // 입금 내역 조회 (예약별 입금/결제 정보) - 날짜 필터링 적용
      // tour.reservation_ids 기준으로 조회
      const { data: tourForReservations } = await supabase
        .from('tours')
        .select('reservation_ids')
        .eq('id', tourId)
        .maybeSingle()

      if (!tourForReservations?.reservation_ids || tourForReservations.reservation_ids.length === 0) {
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
          reservations: [],
          customers: [],
          reservationPricing: [],
          paymentRecords: [],
          reservationExpenses: [],
          reservationNonResidentOptions: [],
          reservationIds: []
        }
      }

      // 날짜 필터링이 있는 경우 적용
      if (tourDate) {
        const reservationDate = new Date(tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        if (reservationDate < startDate || reservationDate > endDate) {
          return {
            expenses: [],
            ticketBookings: [],
            hotelBookings: [],
            tourFees: { guide_fee: 0, assistant_fee: 0, guide_name: '', assistant_name: '' },
            reservations: [],
            customers: [],
            reservationPricing: [],
            reservationExpenses: [],
            reservationNonResidentOptions: [],
            reservationIds: []
          }
        }
      }

      // reservations 배치 조회 (예약 많은 투어 대응)
      const resIds = tourForReservations.reservation_ids || []
      let reservations: any[] = []
      const RES_BATCH = 100
      for (let i = 0; i < resIds.length; i += RES_BATCH) {
        const batch = resIds.slice(i, i + RES_BATCH)
        const { data: batchRes, error: reservationsError } = await supabase
          .from('reservations')
          .select('id, customer_id, total_people, adults, child, infant')
          .in('id', batch)
        if (reservationsError) {
          console.error('예약 조회 오류:', reservationsError)
          break
        }
        if (batchRes?.length) reservations = reservations.concat(batchRes)
      }

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

      // 예약 가격/실입금 정보 조회
      let reservationPricing: any[] = []
      let paymentRecords: any[] = []
      let reservationExpenses: any[] = []
      let reservationNonResidentOptions: any[] = []
      if (reservations && reservations.length > 0) {
        const reservationIds = reservations.map(r => r.id).filter(Boolean)
        
        if (reservationIds.length > 0) {
          const BATCH_SIZE = 20
          for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
            const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
            const [pricingRes, expensesRes] = await Promise.all([
              supabase.from('reservation_pricing').select('reservation_id, total_price, additional_cost').in('reservation_id', batchIds),
              supabase.from('reservation_expenses').select('reservation_id, amount, paid_for').in('reservation_id', batchIds)
            ])
            if (pricingRes.data?.length) reservationPricing.push(...pricingRes.data)
            if (!expensesRes.error && expensesRes.data?.length) reservationExpenses.push(...expensesRes.data)
          }

          // payment_records는 배치로 나눠서 조회 (URL 길이 제한 방지)
          const allPaymentRecords: any[] = []
          for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
            const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
            try {
              const { data: batchPayments, error: batchPaymentsError } = await supabase
                .from('payment_records')
                .select('id, reservation_id, amount, payment_status, submit_on, payment_method')
                .in('reservation_id', batchIds)
              
              if (batchPaymentsError) {
                console.error(`실입금 정보 조회 오류 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, batchPaymentsError)
              } else if (batchPayments) {
                allPaymentRecords.push(...batchPayments)
              }
            } catch (error) {
              console.error(`실입금 정보 조회 예외 (배치 ${Math.floor(i / BATCH_SIZE) + 1}):`, error)
            }
          }
          paymentRecords = allPaymentRecords

          // 옵션 (비거주자 비용): reservation_options에서 비거주자 옵션만, status가 cancelled/refunded 아닌 것
          const NON_RESIDENT_OPTION_ID = '6941b5d0'
          const excludeStatus = (s: string) => { const lower = (s || '').toLowerCase().trim(); return lower === 'cancelled' || lower === 'refunded' }
          for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
            const batchIds = reservationIds.slice(i, i + BATCH_SIZE)
            const { data: opts } = await supabase
              .from('reservation_options')
              .select('reservation_id, option_id, ea, price, total_price, status')
              .in('reservation_id', batchIds)
            if (opts?.length) {
              const valid = opts.filter((r: any) => !excludeStatus(r?.status))
              const fixedId = valid.filter((r: any) => String(r?.option_id || '').trim() === NON_RESIDENT_OPTION_ID)
              if (fixedId.length > 0) {
                reservationNonResidentOptions = reservationNonResidentOptions.concat(fixedId)
              } else {
                const uniqueIds = [...new Set(valid.map((r: any) => String(r.option_id || '').trim()).filter(Boolean))]
                if (uniqueIds.length > 0) {
                  const { data: optionRows } = await supabase.from('options').select('id, name, category').in('id', uniqueIds)
                  const nonResidentIds = new Set(
                    (optionRows || []).filter((o: any) => {
                      const n = (o.name || '').toLowerCase()
                      const c = (o.category || '').toLowerCase()
                      return n.includes('entrance') || n.includes('비거주자') || n.includes('입장료') || c.includes('entrance') || c.includes('fee')
                    }).map((o: any) => String(o.id).trim())
                  )
                  reservationNonResidentOptions = reservationNonResidentOptions.concat(valid.filter((r: any) => nonResidentIds.has(String(r.option_id || '').trim())))
                }
              }
            }
          }
        }
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
        reservationPricing: reservationPricing || [],
        paymentRecords: paymentRecords || [],
        reservationExpenses: reservationExpenses || [],
        reservationNonResidentOptions: reservationNonResidentOptions || [],
        reservationIds: tourForReservations?.reservation_ids || []
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
        reservationPricing: [],
        reservationExpenses: [],
        reservationNonResidentOptions: [],
        reservationIds: []
      }
    }
  }

  // 투어 통계: 서버 API로 일괄 조회 (DB VIEW/인덱스 활용, 클라이언트 N회 조회 제거)
  useEffect(() => {
    const fetchTourStatistics = async () => {
      setIsCalculating(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end
        })
        const res = await fetch(`/api/statistics/tour-stats?${params}`, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setTourStatisticsData({
          totalTours: data.totalTours ?? 0,
          totalRevenue: data.totalRevenue ?? 0,
          totalExpenses: data.totalExpenses ?? 0,
          netProfit: data.netProfit ?? 0,
          averageProfitPerTour: data.averageProfitPerTour ?? 0,
          totalAdditionalCostRounded: data.totalAdditionalCostRounded ?? 0,
          tourStats: data.tourStats ?? [],
          expenseBreakdown: data.expenseBreakdown ?? [],
          vehicleStats: data.vehicleStats ?? []
        })
      } catch (error) {
        console.error('투어 통계 계산 오류:', error)
        setTourStatisticsData({
          totalTours: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          averageProfitPerTour: 0,
          totalAdditionalCostRounded: 0,
          tourStats: [],
          expenseBreakdown: [],
          vehicleStats: []
        })
      } finally {
        setIsCalculating(false)
      }
    }
    fetchTourStatistics()
  }, [dateRange])

  // 차량별 가스비 비교 데이터
  const vehicleGasComparison = useMemo(() => {
    if (selectedVehicle === 'all') {
      return tourStatisticsData.vehicleStats
    }
    
    return tourStatisticsData.vehicleStats.filter(v => v.vehicleType === selectedVehicle)
  }, [tourStatisticsData.vehicleStats, selectedVehicle])

  const sortedTourStats = useMemo(() => {
    const cloned = [...tourStatisticsData.tourStats]
    cloned.sort((a, b) => {
      const aTime = new Date(a.tourDate + 'T00:00:00').getTime()
      const bTime = new Date(b.tourDate + 'T00:00:00').getTime()
      return dateSortDir === 'asc' ? aTime - bTime : bTime - aTime
    })
    return cloned
  }, [tourStatisticsData.tourStats, dateSortDir])

  const visibleTourStats = useMemo(() => {
    const byProduct = selectedProducts.length > 0
      ? sortedTourStats.filter(t => selectedProducts.includes(t.productName))
      : sortedTourStats
    const bySearch = tourSearch.trim()
      ? byProduct.filter(t => {
          const keyword = tourSearch.trim().toLowerCase()
          return (
            t.productName.toLowerCase().includes(keyword) ||
            formatDate(t.tourDate).toLowerCase().includes(keyword)
          )
        })
      : byProduct
    return bySearch
  }, [sortedTourStats, selectedProducts, tourSearch])

  // 1인당 지표 평균 계산 (표시/하이라이트 용도)
  const perPersonAverages = useMemo(() => {
    // 전체 가중 평균(인원 기준)
    const items = visibleTourStats.filter(t => (t.totalPeople || 0) > 0)
    const overall = (() => {
      const totals = items.reduce((acc, t) => {
        const people = t.totalPeople || 0
        acc.rev += t.revenue || 0
        acc.exp += t.expenses || 0
        acc.profit += t.netProfit || 0
        acc.people += people
        return acc
      }, { rev: 0, exp: 0, profit: 0, people: 0 })
      if (totals.people === 0) return { revenuePer: 0, expensesPer: 0, profitPer: 0 }
      return {
        revenuePer: totals.rev / totals.people,
        expensesPer: totals.exp / totals.people,
        profitPer: totals.profit / totals.people
      }
    })()

    // 상품별 가중 평균(인원 기준) - 하이라이트 기준
    const groups = visibleTourStats.reduce((map, t) => {
      const key = t.productName || 'UNKNOWN'
      if (!map[key]) map[key] = { rev: 0, exp: 0, profit: 0, people: 0 }
      const people = t.totalPeople || 0
      map[key].rev += t.revenue || 0
      map[key].exp += t.expenses || 0
      map[key].profit += t.netProfit || 0
      map[key].people += people
      return map
    }, {} as Record<string, { rev: number; exp: number; profit: number; people: number }>)

    const byProduct: Record<string, { revenuePer: number; expensesPer: number; profitPer: number }> = {}
    Object.entries(groups).forEach(([product, v]) => {
      byProduct[product] = v.people > 0
        ? { revenuePer: v.rev / v.people, expensesPer: v.exp / v.people, profitPer: v.profit / v.people }
        : { revenuePer: 0, expensesPer: 0, profitPer: 0 }
    })

    return { overall, byProduct }
  }, [visibleTourStats])

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
    <>
    <div className="space-y-4 sm:space-y-6">
      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 투어 수</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{tourStatisticsData.totalTours}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 수익</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 truncate">${tourStatisticsData.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg flex-shrink-0">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 지출</p>
              <p className="text-sm sm:text-base font-bold text-gray-900 truncate">${tourStatisticsData.totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">순수익</p>
              <p className={`text-sm sm:text-base font-bold truncate ${tourStatisticsData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${tourStatisticsData.netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">비거주자비용</p>
              <p className="text-sm sm:text-base font-bold text-orange-600 truncate">
                ${tourStatisticsData.totalAdditionalCostRounded.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 선택 탭 */}
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        {/* 투어 필터 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">상품(투어) 필터</label>
            <select
              multiple
              value={selectedProducts}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map(o => o.value)
                setFilters((f) => ({ ...f, selectedProducts: options }))
              }}
              className="w-full md:w-96 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md h-20 sm:h-28 text-sm"
            >
              {Array.from(new Set(tourStatisticsData.tourStats.map(t => t.productName))).sort().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">검색(상품명/날짜)</label>
            <input
              value={tourSearch}
              onChange={(e) => setFilters((f) => ({ ...f, tourSearch: e.target.value }))}
              placeholder="예: 그랜드, 2025. 01. 20"
              className="w-full md:w-80 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilters((f) => ({ ...f, selectedProducts: [], tourSearch: '' }))}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >필터 초기화</button>
            <div className="text-xs sm:text-sm text-gray-500">표시: {visibleTourStats.length}개</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { key: 'profit', label: '투어별 손익', icon: BarChart3 },
            { key: 'daily', label: '날짜별 집계', icon: LineChart },
            { key: 'expenses', label: '지출 상세', icon: PieChart },
            { key: 'vehicles', label: '차량별 가스비', icon: Car }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  selectedChart: key as TourStatsFiltersState['selectedChart'],
                }))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md sm:rounded-lg transition-colors text-sm ${
                selectedChart === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={16} className="sm:w-5 sm:h-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 투어별 손익 차트 */}
        {selectedChart === 'profit' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">투어별 손익 분석</h3>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center bg-gray-100 rounded-md overflow-hidden flex-wrap">
                  {[
                    { key: 'none', label: '전체' },
                    { key: 'revenuePer', label: '1인 수익' },
                    { key: 'expensesPer', label: '1인 지출' },
                    { key: 'profitPer', label: '1인 순수익' }
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          perPersonMetric: key as TourStatsFiltersState['perPersonMetric'],
                        }))
                      }
                      className={`px-2 py-1 text-xs ${perPersonMetric === key ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                    >{label}</button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => generateTourStatisticsPDF({ data: tourStatisticsData, dateRange })}
                    className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-sm"
                  >
                    <Download size={14} />
                    <span>리포트</span>
                  </button>
                  <button 
                    onClick={() => generateChartPDF('profit-chart', '투어별손익차트.pdf')}
                    className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs sm:text-sm"
                  >
                    <Download size={14} />
                    <span>차트</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* 고급 차트 */}
            <div id="profit-chart">
              {(() => {
                const data = visibleTourStats.map(tour => {
                  const denom = Math.max(tour.totalPeople || 0, 0)
                  const name = `${tour.productName} (${formatDate(tour.tourDate)})`
                  if (perPersonMetric === 'revenuePer') {
                    return {
                      name,
                      revenue: denom > 0 ? tour.revenue / denom : 0,
                      expenses: undefined,
                      profit: undefined,
                      people: tour.totalPeople
                    }
                  }
                  if (perPersonMetric === 'expensesPer') {
                    return {
                      name,
                      revenue: undefined,
                      expenses: denom > 0 ? tour.expenses / denom : 0,
                      profit: undefined,
                      people: tour.totalPeople
                    }
                  }
                  if (perPersonMetric === 'profitPer') {
                    return {
                      name,
                      revenue: undefined,
                      expenses: undefined,
                      profit: denom > 0 ? tour.netProfit / denom : 0,
                      people: tour.totalPeople
                    }
                  }
                  return {
                    name,
                    revenue: tour.revenue,
                    expenses: tour.expenses,
                    profit: tour.netProfit,
                    people: tour.totalPeople
                  }
                })

                const title = perPersonMetric === 'revenuePer'
                  ? '투어별 1인 수익'
                  : perPersonMetric === 'expensesPer'
                  ? '투어별 1인 지출'
                  : perPersonMetric === 'profitPer'
                  ? '투어별 1인 순수익'
                  : '투어별 손익 비교'

                return (
                  <AdvancedCharts
                    data={data}
                    type="bar"
                    title={title}
                    stacked={perPersonMetric === 'none'}
                    showProfitLine={perPersonMetric === 'none'}
                    xAxisSubLabelKey="people"
                    xAxisSubLabelFormatter={(v) => `${v}`}
                    xAxisShowMainLabel={false}
                    xAxisInterval={0}
                    xAxisHeight={70}
                    xAxisBottomMargin={70}
                    bottomLabelKey="people"
                    bottomLabelFormatter={(v) => `${v}`}
                    height={400}
                  />
                )
              })()}
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h4 className="font-semibold text-gray-700 text-sm sm:text-base">지출 상세 내역</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 min-w-[280px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">항목</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">비율</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">투어당 평균</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tourStatisticsData.expenseBreakdown.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.category}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
                          ${item.amount.toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.percentage.toFixed(1)}%
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
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
                  onChange={(e) => setFilters((f) => ({ ...f, selectedVehicle: e.target.value }))}
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

        {/* 날짜별 집계 */}
        {selectedChart === 'daily' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">날짜별 지출/입금/순수익/인원</h3>
              <div className="flex items-center space-x-2">
                {[
                  { key: 'revenue', label: '입금' },
                  { key: 'expenses', label: '지출' },
                  { key: 'profit', label: '순수익' },
                  { key: 'people', label: '인원' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        dailyMetric: key as TourStatsFiltersState['dailyMetric'],
                      }))
                    }
                    className={`px-3 py-1 text-sm rounded-md ${dailyMetric === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >{label}</button>
                ))}
                <button 
                  onClick={() => generateChartPDF('daily-chart', '날짜별집계.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트 다운로드</span>
                </button>
              </div>
            </div>

            <div id="daily-chart">
              {(() => {
                // 날짜별 합계 계산 (항상 오름차순)
                const byDate: Record<string, { revenue: number; expenses: number; profit: number; people: number }> = {}
                visibleTourStats.forEach(t => {
                  const d = formatDate(t.tourDate)
                  if (!byDate[d]) byDate[d] = { revenue: 0, expenses: 0, profit: 0, people: 0 }
                  byDate[d].revenue += t.revenue || 0
                  byDate[d].expenses += t.expenses || 0
                  byDate[d].profit += t.netProfit || 0
                  byDate[d].people += t.totalPeople || 0
                })
                const sortedDates = Object.keys(byDate)
                  .map(d => ({ d, time: new Date(d).getTime() }))
                  .sort((a, b) => a.time - b.time)
                const chartData = sortedDates.map(({ d }) => {
                  const row = byDate[d]
                  if (dailyMetric === 'people') return { name: d, value: row.people }
                  return { name: d, revenue: row.revenue, expenses: row.expenses, profit: row.profit }
                })

                return (
                  <AdvancedCharts
                    data={chartData}
                    type={dailyMetric === 'people' ? 'bar' : 'bar'}
                    title={`날짜별 ${dailyMetric === 'revenue' ? '입금' : dailyMetric === 'expenses' ? '지출' : dailyMetric === 'profit' ? '순수익' : '인원'}`}
                    height={400}
                    stacked={dailyMetric !== 'people'}
                    showProfitLine={dailyMetric !== 'people' && dailyMetric !== 'expenses' && dailyMetric !== 'revenue'}
                    xAxisShowMainLabel={true}
                    xAxisHeight={30}
                    xAxisBottomMargin={30}
                  />
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 투어 통계 테이블 - 컴팩트 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-3 sm:px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">투어 상세 통계</h3>
        </div>
        <div className="overflow-x-auto -mx-0">
          <table className="w-full divide-y divide-gray-200 min-w-[760px] text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">
                  <button
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        dateSortDir: f.dateSortDir === 'asc' ? 'desc' : 'asc',
                      }))
                    }
                    className="inline-flex items-center gap-0.5 text-gray-700 hover:text-gray-900"
                    title="투어 날짜로 정렬"
                  >
                    <span>날짜</span>
                    <span className={`transition-transform ${dateSortDir === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                      <ChevronDown size={12} />
                    </span>
                  </button>
                </th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">상품명</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight w-12">인원</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">수익</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">지출</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">순수익</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight w-12">수익률</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">
                  1인 수익
                  <div className="text-[9px] text-gray-400 mt-0.5 font-normal">avg ${perPersonAverages.overall.revenuePer.toFixed(2)}</div>
                </th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">
                  1인 지출
                  <div className="text-[9px] text-gray-400 mt-0.5 font-normal">avg ${perPersonAverages.overall.expensesPer.toFixed(2)}</div>
                </th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">
                  1인 순수익
                  <div className="text-[9px] text-gray-400 mt-0.5 font-normal">avg ${perPersonAverages.overall.profitPer.toFixed(2)}</div>
                </th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">가이드비</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">투어 지출</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">티켓</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight">비거주자</th>
                <th className="px-2 sm:px-3 py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-tight w-14">상세</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {visibleTourStats.map((tour, index) => (
                <React.Fragment key={index}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-900">
                      {formatDate(tour.tourDate)}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-900 max-w-[120px] truncate" title={tour.productName}>
                      {tour.hasValidTourId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setTourDetailModal({ tourId: tour.tourId, productName: tour.productName })
                          }
                          className="flex items-center gap-0.5 text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors max-w-full"
                          title="투어 상세 보기"
                        >
                          <span className="truncate">{tour.productName}</span>
                          <ExternalLink size={11} className="flex-shrink-0" aria-hidden />
                        </button>
                      ) : (
                        <span className="text-gray-500 truncate block">{tour.productName}</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">
                      {tour.totalPeople}명
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-green-600">
                      ${tour.revenue.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600">
                      ${tour.expenses.toLocaleString()}
                    </td>
                    <td className={`px-2 sm:px-3 py-1.5 whitespace-nowrap font-semibold ${
                      tour.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${tour.netProfit.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">
                      {tour.revenue > 0 ? ((tour.netProfit / tour.revenue) * 100).toFixed(1) : 0}%
                    </td>
                    {(() => {
                      const people = tour.totalPeople || 0
                      const revenuePer = people > 0 ? tour.revenue / people : 0
                      const expPer = people > 0 ? tour.expenses / people : 0
                      const profitPer = people > 0 ? tour.netProfit / people : 0
                      const devBadge = (value: number, avg: number) => {
                        if (avg <= 0) return ''
                        const diffPct = Math.abs((value - avg) / avg)
                        if (diffPct >= 0.4) return 'bg-red-100 text-red-800'
                        if (diffPct >= 0.2) return 'bg-yellow-100 text-yellow-800'
                        return ''
                      }
                      const productAvg = perPersonAverages.byProduct[tour.productName] || { revenuePer: 0, expensesPer: 0, profitPer: 0 }
                      return (
                        <>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                            <span className={`font-medium text-green-600 ${devBadge(revenuePer, productAvg.revenuePer)} rounded px-0.5`} title={`상품 평균: $${productAvg.revenuePer.toFixed(2)}`}>
                              ${revenuePer.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                            <span className={`font-medium text-red-600 ${devBadge(expPer, productAvg.expensesPer)} rounded px-0.5`} title={`상품 평균: $${productAvg.expensesPer.toFixed(2)}`}>
                              ${expPer.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                            <span className={`font-medium ${profitPer >= 0 ? 'text-green-600' : 'text-red-600'} ${devBadge(profitPer, productAvg.profitPer)} rounded px-0.5`} title={`상품 평균: $${productAvg.profitPer.toFixed(2)}`}>
                              ${profitPer.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600 font-medium">
                            ${(tour.guideFee || 0).toLocaleString()}
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600 font-medium">
                            ${(tour.gasCost || 0).toLocaleString()}
                          </td>
                          <td
                            className={`px-2 sm:px-3 py-1.5 whitespace-nowrap font-medium ${
                              !isProductExemptFromTicketEaMismatchCheck(tour.productName) &&
                              (tour.ticketBookingsEa ?? 0) !== (tour.totalPeople ?? 0)
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }`}
                          >
                            ${(tour.ticketBookingsCost || 0).toLocaleString()} ({(tour.ticketBookingsEa ?? 0)}ea)
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-purple-600 font-medium">
                            ${(tour.notIncludedPrice || 0).toLocaleString()}
                          </td>
                        </>
                      )
                    })()}
                    <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleExpenseDetails(tour.tourId, tour.tourDate)}
                        className="flex items-center justify-center gap-0.5 hover:text-blue-700 transition-colors text-blue-600 mx-auto"
                        title="상세 내역 보기"
                      >
                        <Eye size={12} />
                        {expandedExpenses[tour.tourId] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* 지출 상세 내역 */}
                  {expandedExpenses[tour.tourId] && (
                    <tr>
                      <td colSpan={15} className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-50">
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900">상세 내역</h4>
                          
                          {expenseDetails[tour.tourId] ? (
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                              {/* 요약 컬럼 */}
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium text-gray-900 mb-2">요약</h5>
                                <div className="space-y-2 text-sm">
                                  {/* 입금액 */}
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">입금액</span>
                                    <span className="font-medium text-green-600">
                                      ${(expenseDetails[tour.tourId].reservationPricing?.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0) || 0).toLocaleString()}
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
                                        -${expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + ticketExpenseForSettlement(booking), 0).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* 투어호텔 소계 */}
                                  {expenseDetails[tour.tourId].hotelBookings.length > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">투어호텔 소계</span>
                                      <span className="font-medium text-red-600">
                                        -${expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + hotelAmountForSettlement(booking), 0).toLocaleString()}
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
                                      // 입금 내역 총합 사용
                                      const totalRevenue = expenseDetails[tour.tourId].reservationPricing?.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0) || 0
                                      const totalExpenses = 
                                        expenseDetails[tour.tourId].expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0) +
                                        expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + ticketExpenseForSettlement(booking), 0) +
                                        expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + hotelAmountForSettlement(booking), 0) +
                                        expenseDetails[tour.tourId].tourFees.guide_fee +
                                        expenseDetails[tour.tourId].tourFees.assistant_fee
                                      const netProfit = totalRevenue - totalExpenses
                                      return netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                    })()}`}>
                                      ${(() => {
                                        // 입금 내역 총합 사용
                                        const totalRevenue = expenseDetails[tour.tourId].reservationPricing?.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0) || 0
                                        const totalExpenses = 
                                          expenseDetails[tour.tourId].expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0) +
                                          expenseDetails[tour.tourId].ticketBookings.reduce((sum: number, booking: any) => sum + ticketExpenseForSettlement(booking), 0) +
                                          expenseDetails[tour.tourId].hotelBookings.reduce((sum: number, booking: any) => sum + hotelAmountForSettlement(booking), 0) +
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
                              
                              {/* 호텔 부킹 */}
                              {expenseDetails[tour.tourId].hotelBookings.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">호텔 부킹</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].hotelBookings.map((booking: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{booking.hotel_name || '호텔'}</span>
                                        <span className="font-medium">${hotelAmountForSettlement(booking).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 입장권 부킹 및 가이드/어시스턴트 수수료 (통합) */}
                              {(expenseDetails[tour.tourId].ticketBookings.length > 0 || expenseDetails[tour.tourId].tourFees.guide_fee > 0 || expenseDetails[tour.tourId].tourFees.assistant_fee > 0) && (
                                <div className="bg-white p-3 rounded border">
                                  {/* 입장권 부킹 */}
                                  {expenseDetails[tour.tourId].ticketBookings.length > 0 && (
                                    <>
                                      <h5 className="font-medium text-gray-900 mb-2">입장권 부킹</h5>
                                      <div className="space-y-1 mb-3">
                                        {expenseDetails[tour.tourId].ticketBookings.map((booking: any, idx: number) => {
                                          const totalPeople = expenseDetails[tour.tourId].reservations.reduce((sum: number, r: any) => sum + r.adults + r.child + r.infant, 0)
                                          const perPersonPrice = totalPeople > 0 ? (booking.expense || 0) / totalPeople : 0
                                          
                                          return (
                                            <div key={idx} className="flex justify-between text-sm">
                                              <div className="flex flex-col">
                                                <span className="text-gray-600">{booking.ticket_name || '입장권'}</span>
                                                <span className="text-xs text-gray-500">
                                                  {booking.company && `${booking.company}`}
                                                  {booking.company && booking.ea && ' · '}
                                                  {booking.ea && `${booking.ea}매`}
                                                  {(!booking.company && !booking.ea) && `총 ${totalPeople}명`}
                                                </span>
                                              </div>
                                              <div className="flex flex-col text-right">
                                                <span className="font-medium">${booking.expense?.toLocaleString() || 0}</span>
                                                <span className="text-xs text-gray-500">1인당: ${perPersonPrice.toFixed(2)}</span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* 가이드/어시스턴트 수수료 */}
                                  {(expenseDetails[tour.tourId].tourFees.guide_fee > 0 || expenseDetails[tour.tourId].tourFees.assistant_fee > 0) && (
                                    <>
                                      {expenseDetails[tour.tourId].ticketBookings.length > 0 && (
                                        <div className="border-t border-gray-200 my-2"></div>
                                      )}
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
                                    </>
                                  )}
                                </div>
                              )}

                              {/* 입금 내역 - reservation_ids로 필터링 */}
                              {expenseDetails[tour.tourId].reservations.length > 0 && expenseDetails[tour.tourId].reservationIds && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">입금 내역</h5>
                                  <div className="space-y-1">
                                    {expenseDetails[tour.tourId].reservations
                                      .filter((reservation: any) => expenseDetails[tour.tourId].reservationIds?.includes(reservation.id))
                                      .map((reservation: any, idx: number) => {
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
                              
                              {/* 옵션 (비거주자 비용) - reservation_options 비거주자 옵션만 표시 */}
                              {expenseDetails[tour.tourId].reservationNonResidentOptions?.length > 0 && (() => {
                                const opts = expenseDetails[tour.tourId].reservationNonResidentOptions || []
                                const byRes = opts.reduce((acc: Record<string, { ea: number; total: number }>, r: any) => {
                                  const rid = r.reservation_id
                                  if (!acc[rid]) acc[rid] = { ea: 0, total: 0 }
                                  acc[rid].ea += Number(r.ea ?? 1)
                                  acc[rid].total += Number(r.total_price) || (Number(r.ea ?? 1) * Number(r.price ?? 0))
                                  return acc
                                }, {})
                                const reservationIdsWithOpt = Object.keys(byRes).filter(rid => expenseDetails[tour.tourId].reservationIds?.includes(rid))
                                if (reservationIdsWithOpt.length === 0) return null
                                return (
                                  <div className="bg-white p-3 rounded border">
                                    <h5 className="font-medium text-gray-900 mb-2">옵션 (비거주자 비용)</h5>
                                    <div className="space-y-1">
                                      {reservationIdsWithOpt.map((reservationId: string) => {
                                        const reservation = expenseDetails[tour.tourId].reservations.find((r: any) => r.id === reservationId)
                                        const customer = expenseDetails[tour.tourId].customers.find((c: any) => c.id === reservation?.customer_id)
                                        const { ea, total } = byRes[reservationId]
                                        const totalPeople = reservation ? (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0) : 0
                                        const perPerson = totalPeople > 0 ? total / totalPeople : 0
                                        return (
                                          <div key={reservationId} className="flex justify-between text-sm">
                                            <div className="flex flex-col">
                                              <span className="text-gray-600 font-medium">{customer?.name || '고객'}</span>
                                              <span className="text-xs text-gray-500">
                                                {reservation ? `성인 ${reservation.adults || 0}명, 아동 ${reservation.child || 0}명, 유아 ${reservation.infant || 0}명` : ''} · {ea}개
                                              </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                              <span className="font-medium text-purple-600">${total.toLocaleString()}</span>
                                              {totalPeople > 0 && <span className="text-xs text-gray-500">1인당: ${perPerson.toFixed(2)}</span>}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()}
                              
                              {/* 추가 지출 통계 */}
                              {expenseDetails[tour.tourId].reservationExpenses && expenseDetails[tour.tourId].reservationExpenses.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="font-medium text-gray-900 mb-2">추가 지출</h5>
                                  <div className="space-y-1">
                                    {(() => {
                                      // reservation_ids로 필터링하고 예약별로 그룹화
                                      const filteredExpenses = expenseDetails[tour.tourId].reservationExpenses.filter((exp: any) => 
                                        expenseDetails[tour.tourId].reservationIds?.includes(exp.reservation_id)
                                      )
                                      
                                      // 예약별로 그룹화
                                      const expensesByReservation = filteredExpenses.reduce((groups: any, exp: any) => {
                                        if (!groups[exp.reservation_id]) {
                                          groups[exp.reservation_id] = []
                                        }
                                        groups[exp.reservation_id].push(exp)
                                        return groups
                                      }, {})
                                      
                                      return Object.entries(expensesByReservation).map(([reservationId, expenses]: [string, any]) => {
                                        const reservation = expenseDetails[tour.tourId].reservations.find((r: any) => r.id === reservationId)
                                        const customer = expenseDetails[tour.tourId].customers.find((c: any) => c.id === reservation?.customer_id)
                                        const totalExpense = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)
                                        
                                        return (
                                          <div key={reservationId} className="flex justify-between text-sm">
                                            <div className="flex flex-col">
                                              <span className="text-gray-600 font-medium">{customer?.name || '고객'}</span>
                                              <span className="text-xs text-gray-500">
                                                {expenses.map((exp: any, idx: number) => (
                                                  <span key={idx}>
                                                    {exp.paid_for || '추가 지출'}
                                                    {idx < expenses.length - 1 && ', '}
                                                  </span>
                                                ))}
                                              </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                              <span className="font-medium text-red-600">${totalExpense.toLocaleString()}</span>
                                              <span className="text-xs text-gray-500">{expenses.length}건</span>
                                            </div>
                                          </div>
                                        )
                                      })
                                    })()}
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
              {/* 총합 행 */}
              {visibleTourStats.length > 0 && (
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-900">총합</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-900">-</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-900">
                    {visibleTourStats.reduce((sum, t) => sum + (t.totalPeople || 0), 0)}명
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-green-600">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.revenue || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.expenses || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap font-semibold text-gray-900">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.netProfit || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">-</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">-</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">-</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">-</td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.guideFee || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-red-600">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.gasCost || 0), 0).toLocaleString()}
                  </td>
                  {(() => {
                    const totalTicketCost = visibleTourStats.reduce(
                      (sum, t) => sum + (t.ticketBookingsCost || 0),
                      0
                    )
                    const totalTicketEa = visibleTourStats.reduce(
                      (sum, t) => sum + (t.ticketBookingsEa ?? 0),
                      0
                    )
                    const forTicketCheck = visibleTourStats.filter(
                      (t) => !isProductExemptFromTicketEaMismatchCheck(t.productName)
                    )
                    const ticketEaForCheck = forTicketCheck.reduce(
                      (sum, t) => sum + (t.ticketBookingsEa ?? 0),
                      0
                    )
                    const peopleForCheck = forTicketCheck.reduce(
                      (sum, t) => sum + (t.totalPeople || 0),
                      0
                    )
                    const eaMismatch = ticketEaForCheck !== peopleForCheck
                    return (
                      <td
                        className={`px-2 sm:px-3 py-1.5 whitespace-nowrap ${
                          eaMismatch ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        ${totalTicketCost.toLocaleString()} ({totalTicketEa}ea)
                      </td>
                    )
                  })()}
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-purple-600">
                    ${visibleTourStats.reduce((sum, t) => sum + (t.notIncludedPrice || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-gray-500">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>

      <TourStatisticsTourDetailModal
        open={tourDetailModal !== null}
        onOpenChange={(o) => {
          if (!o) setTourDetailModal(null)
        }}
        tourId={tourDetailModal?.tourId ?? null}
        productName={tourDetailModal?.productName ?? ''}
        locale={locale}
      />
    </>
  )
}
