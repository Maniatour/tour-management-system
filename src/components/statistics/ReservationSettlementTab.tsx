'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calendar,
  PieChart,
  LineChart,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Receipt
} from 'lucide-react'
import { useReservationData } from '@/hooks/useReservationData'
import AdvancedCharts from './AdvancedCharts'
import { generateTourStatisticsPDF, generateChartPDF } from '@/utils/pdfExport'
import { supabase } from '@/lib/supabase'

interface ReservationSettlementData {
  totalReservations: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  averageProfitPerReservation: number
  reservationStats: Array<{
    reservationId: string
    reservationDate: string
    productName: string
    subCategory: string
    totalPeople: number
    revenue: number
    expenses: number
    netProfit: number
    customerName?: string
    channelName?: string
  }>
  expenseBreakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
  subCategoryStats: Array<{
    subCategory: string
    totalReservations: number
    totalPeople: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
  }>
}

interface ReservationSettlementTabProps {
  dateRange: { start: string; end: string }
}

// 날짜 포맷팅 함수
function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 예약별 정산 통계를 가져오는 함수
async function getReservationFinancialStats(reservationId: string) {
  try {
    console.log('예약 정산 통계 조회 시작:', reservationId)

    // 예약 정보 조회
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, customer_id, adults, child, infant, product_id, channel_id, tour_date')
      .eq('id', reservationId)
      .single()

    if (reservationError) {
      console.error('예약 정보 조회 오류:', reservationError)
      throw reservationError
    }

    // 고객 정보 조회
    let customerName = ''
    if (reservation.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('name')
        .eq('id', reservation.customer_id)
        .maybeSingle()

      if (!customerError && customer) {
        customerName = customer.name
      }
    }

    // 채널 정보 조회
    let channelName = ''
    if (reservation.channel_id) {
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('name')
        .eq('id', reservation.channel_id)
        .maybeSingle()

      if (!channelError && channel) {
        channelName = channel.name
      }
    }

    // 예약 가격 정보 조회
    const { data: pricing, error: pricingError } = await supabase
      .from('reservation_pricing')
      .select('total_price')
      .eq('reservation_id', reservationId)
      .maybeSingle()

    // 예약 지출 조회
    const { data: expenses, error: expensesError } = await supabase
      .from('reservation_expenses')
      .select('amount, status')
      .eq('reservation_id', reservationId)

    if (expensesError) {
      console.error('예약 지출 조회 오류:', expensesError)
    }

    // 계산
    const totalRevenue = pricing?.total_price || 0
    const totalExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0
    const netProfit = totalRevenue - totalExpenses
    const totalPeople = reservation.adults + reservation.child + reservation.infant

    const result = {
      reservationId,
      totalRevenue,
      totalExpenses,
      netProfit,
      totalPeople,
      customerName,
      channelName
    }

    console.log('예약 정산 통계 결과:', result)
    return result
  } catch (error) {
    console.error('예약 정산 통계 조회 오류:', error)
    return {
      reservationId,
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      totalPeople: 0,
      customerName: '',
      channelName: ''
    }
  }
}

export default function ReservationSettlementTab({ dateRange }: ReservationSettlementTabProps) {
  const {
    reservations,
    products,
    customers,
    channels,
    loading
  } = useReservationData()

  const [selectedChart, setSelectedChart] = useState<'profit' | 'expenses' | 'subcategories'>('profit')
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({})
  const [expenseDetails, setExpenseDetails] = useState<Record<string, any>>({})
  const [settlementData, setSettlementData] = useState<ReservationSettlementData>({
    totalReservations: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    averageProfitPerReservation: 0,
    reservationStats: [],
    expenseBreakdown: [],
    subCategoryStats: []
  })
  const [isCalculating, setIsCalculating] = useState(false)

  // 지출 상세 내역 토글
  const toggleExpenseDetails = async (reservationId: string) => {
    const isExpanded = expandedExpenses[reservationId]
    setExpandedExpenses(prev => ({
      ...prev,
      [reservationId]: !isExpanded
    }))

    // 지출 상세 내역이 아직 로드되지 않은 경우 로드
    if (!isExpanded && !expenseDetails[reservationId]) {
      try {
        const details = await getReservationExpenseDetails(reservationId)
        setExpenseDetails(prev => ({
          ...prev,
          [reservationId]: details
        }))
      } catch (error) {
        console.error('지출 상세 내역 로드 오류:', error)
      }
    }
  }

  // 예약별 상세 내역 가져오기
  const getReservationExpenseDetails = async (reservationId: string) => {
    try {
      // 예약 정보 조회
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single()

      if (reservationError) {
        console.error('예약 정보 조회 오류:', reservationError)
        throw reservationError
      }

      // 고객 정보 조회
      let customer = null
      if (reservation.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', reservation.customer_id)
          .maybeSingle()

        if (!customerError) {
          customer = customerData
        }
      }

      // 채널 정보 조회
      let channel = null
      if (reservation.channel_id) {
        const { data: channelData, error: channelError } = await supabase
          .from('channels')
          .select('*')
          .eq('id', reservation.channel_id)
          .maybeSingle()

        if (!channelError) {
          channel = channelData
        }
      }

      // 예약 가격 정보 조회
      const { data: pricing, error: pricingError } = await supabase
        .from('reservation_pricing')
        .select('*')
        .eq('reservation_id', reservationId)
        .maybeSingle()

      // 예약 지출 상세 조회
      const { data: expenses, error: expensesError } = await supabase
        .from('reservation_expenses')
        .select('*')
        .eq('reservation_id', reservationId)

      return {
        reservation,
        customer,
        channel,
        pricing,
        expenses: expenses || []
      }
    } catch (error) {
      console.error('상세 내역 조회 오류:', error)
      return {
        reservation: null,
        customer: null,
        channel: null,
        pricing: null,
        expenses: []
      }
    }
  }

  // 예약 정산 통계 데이터 계산
  useEffect(() => {
    const calculateReservationStatistics = async () => {
      if (!reservations.length) {
        setSettlementData({
          totalReservations: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          averageProfitPerReservation: 0,
          reservationStats: [],
          expenseBreakdown: [],
          subCategoryStats: []
        })
        return
      }

      setIsCalculating(true)

      try {
         // 날짜 필터링된 예약들 (Mania Tour가 아닌 것만)
         const filteredReservations = reservations.filter(reservation => {
           const reservationDate = new Date(reservation.tourDate)
           const startDate = new Date(dateRange.start)
           const endDate = new Date(dateRange.end)
           
           // 날짜 필터링
           const isInDateRange = reservationDate >= startDate && reservationDate <= endDate
           
           // Mania Tour가 아닌 것만 필터링
           const product = products.find(p => p.id === reservation.productId)
           const isNotManiaTour = product?.sub_category !== 'Mania Tour'
           
           return isInDateRange && isNotManiaTour
         })

        console.log('필터링된 예약들:', filteredReservations.length)

        // 각 예약별로 정산 통계 계산
        const reservationStatsPromises = filteredReservations.map(async (reservation) => {
          const financialStats = await getReservationFinancialStats(reservation.id)
          const product = products.find(p => p.id === reservation.productId)
          
           return {
             reservationId: reservation.id,
             reservationDate: reservation.tourDate,
             productName: product?.name_ko || 'Unknown',
             subCategory: product?.sub_category || 'Unknown',
             totalPeople: financialStats.totalPeople,
             revenue: financialStats.totalRevenue,
             expenses: financialStats.totalExpenses,
             netProfit: financialStats.netProfit,
             customerName: financialStats.customerName,
             channelName: financialStats.channelName
           }
        })

        // Promise.all로 비동기 처리
        const resolvedReservationStats = await Promise.all(reservationStatsPromises)

        // 전체 통계 계산
        const totalReservations = resolvedReservationStats.length
        const totalRevenue = resolvedReservationStats.reduce((sum, reservation) => sum + reservation.revenue, 0)
        const totalExpenses = resolvedReservationStats.reduce((sum, reservation) => sum + reservation.expenses, 0)
        const netProfit = totalRevenue - totalExpenses
        const averageProfitPerReservation = totalReservations > 0 ? netProfit / totalReservations : 0

        // 지출 분석 (실제 데이터 기반)
        const expenseCategories = resolvedReservationStats.reduce((categories, reservation) => {
          // 예약별 지출을 카테고리별로 분류
          if (reservation.expenses > 0) {
            if (!categories['예약 지출']) {
              categories['예약 지출'] = 0
            }
            categories['예약 지출'] += reservation.expenses
          }
          return categories
        }, {} as Record<string, number>)

        const expenseBreakdown = Object.entries(expenseCategories).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
        }))

        // 서브카테고리별 통계
        const subCategoryGroups = resolvedReservationStats.reduce((groups, reservation) => {
          const subCategory = reservation.subCategory
          
          if (!groups[subCategory]) {
            groups[subCategory] = {
              subCategory,
              totalReservations: 0,
              totalPeople: 0,
              totalRevenue: 0,
              totalExpenses: 0,
              netProfit: 0
            }
          }
          
          groups[subCategory].totalReservations++
          groups[subCategory].totalPeople += reservation.totalPeople
          groups[subCategory].totalRevenue += reservation.revenue
          groups[subCategory].totalExpenses += reservation.expenses
          groups[subCategory].netProfit += reservation.netProfit
          
          return groups
        }, {} as Record<string, any>)

        const subCategoryStats = Object.values(subCategoryGroups)

        setSettlementData({
          totalReservations,
          totalRevenue,
          totalExpenses,
          netProfit,
          averageProfitPerReservation,
          reservationStats: resolvedReservationStats,
          expenseBreakdown,
          subCategoryStats
        })
      } catch (error) {
        console.error('예약 정산 통계 계산 오류:', error)
      } finally {
        setIsCalculating(false)
      }
    }

    calculateReservationStatistics()
  }, [reservations, products, dateRange])

  if (loading || isCalculating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isCalculating ? '예약 정산 통계를 계산 중입니다...' : '데이터를 불러오는 중입니다...'}
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
              <p className="text-sm font-medium text-gray-600">총 예약 수</p>
              <p className="text-2xl font-bold text-gray-900">{settlementData.totalReservations}</p>
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
              <p className="text-2xl font-bold text-gray-900">${settlementData.totalRevenue.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-gray-900">${settlementData.totalExpenses.toLocaleString()}</p>
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
              <p className={`text-2xl font-bold ${settlementData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${settlementData.netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 선택 탭 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex space-x-4 mb-6">
          {[
            { key: 'profit', label: '예약별 손익', icon: BarChart3 },
            { key: 'expenses', label: '지출 상세', icon: PieChart },
            { key: 'subcategories', label: '서브카테고리별 분석', icon: Receipt }
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

        {/* 예약별 손익 차트 */}
        {selectedChart === 'profit' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">예약별 손익 분석</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => generateChartPDF('profit-chart', '예약별손익차트.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트 다운로드</span>
                </button>
              </div>
            </div>
            
            {/* 고급 차트 */}
            <div id="profit-chart">
              <AdvancedCharts
                data={settlementData.reservationStats.map(reservation => ({
                  name: `${reservation.productName} (${formatDate(reservation.reservationDate)})`,
                  revenue: reservation.revenue,
                  expenses: reservation.expenses,
                  profit: reservation.netProfit,
                  people: reservation.totalPeople
                }))}
                type="bar"
                title="예약별 손익 비교"
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
                data={settlementData.expenseBreakdown.map(item => ({
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
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">항목</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">비율</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약당 평균</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {settlementData.expenseBreakdown.map((item, index) => (
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
                          ${settlementData.totalReservations > 0 ? (item.amount / settlementData.totalReservations).toFixed(0) : 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 서브카테고리별 분석 */}
        {selectedChart === 'subcategories' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">서브카테고리별 분석</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => generateChartPDF('subcategory-chart', '서브카테고리분석차트.pdf')}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Download size={16} />
                  <span>차트 다운로드</span>
                </button>
              </div>
            </div>
            
            {/* 서브카테고리별 차트 */}
            <div id="subcategory-chart">
              <AdvancedCharts
                data={settlementData.subCategoryStats.map(subCategory => ({
                  name: subCategory.subCategory,
                  revenue: subCategory.totalRevenue,
                  expenses: subCategory.totalExpenses,
                  profit: subCategory.netProfit,
                  reservations: subCategory.totalReservations
                }))}
                type="bar"
                title="서브카테고리별 손익 비교"
                height={400}
              />
            </div>

            {/* 서브카테고리별 상세 정보 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {settlementData.subCategoryStats.map((subCategory, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center space-x-3">
                      <Receipt className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">{subCategory.subCategory}</h4>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${subCategory.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${subCategory.netProfit.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">순수익</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">예약 수</p>
                      <p className="font-semibold">{subCategory.totalReservations}건</p>
                    </div>
                    <div>
                      <p className="text-gray-600">총 인원</p>
                      <p className="font-semibold">{subCategory.totalPeople}명</p>
                    </div>
                    <div>
                      <p className="text-gray-600">총 수익</p>
                      <p className="font-semibold text-green-600">${subCategory.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">총 지출</p>
                      <p className="font-semibold text-red-600">${subCategory.totalExpenses.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* 수익률 표시 */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>수익률</span>
                      <span>{subCategory.totalRevenue > 0 ? ((subCategory.netProfit / subCategory.totalRevenue) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${subCategory.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ 
                          width: `${Math.min(Math.abs(subCategory.netProfit / Math.max(...settlementData.subCategoryStats.map(s => Math.abs(s.netProfit)))) * 100, 100)}%` 
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

      {/* 예약 정산 상세 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">예약 정산 상세 통계</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약 날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">서브카테고리</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">순수익</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익률</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상세</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {settlementData.reservationStats.map((reservation, index) => (
                <React.Fragment key={index}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(reservation.reservationDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <Link 
                        href={`/ko/admin/reservations/${reservation.reservationId}`}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        <span>{reservation.productName}</span>
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.subCategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.customerName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.channelName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.totalPeople}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      ${reservation.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      ${reservation.expenses.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      reservation.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${reservation.netProfit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.revenue > 0 ? ((reservation.netProfit / reservation.revenue) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => toggleExpenseDetails(reservation.reservationId)}
                        className="flex items-center justify-center space-x-1 hover:text-blue-700 transition-colors text-blue-600"
                        title="상세 내역 보기"
                      >
                        <Eye size={16} />
                        {expandedExpenses[reservation.reservationId] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* 지출 상세 내역 */}
                  {expandedExpenses[reservation.reservationId] && (
                    <tr>
                      <td colSpan={11} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900">상세 내역</h4>
                          
                          {expenseDetails[reservation.reservationId] ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* 예약 정보 */}
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium text-gray-900 mb-2">예약 정보</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">고객명</span>
                                    <span className="font-medium">{expenseDetails[reservation.reservationId].customer?.name || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">채널</span>
                                    <span className="font-medium">{expenseDetails[reservation.reservationId].channel?.name || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">인원</span>
                                    <span className="font-medium">
                                      성인 {expenseDetails[reservation.reservationId].reservation?.adults || 0}명, 
                                      아동 {expenseDetails[reservation.reservationId].reservation?.child || 0}명, 
                                      유아 {expenseDetails[reservation.reservationId].reservation?.infant || 0}명
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 수익 정보 */}
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium text-gray-900 mb-2">수익 정보</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">총 가격</span>
                                    <span className="font-medium text-green-600">
                                      ${expenseDetails[reservation.reservationId].pricing?.total_price?.toLocaleString() || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 지출 정보 */}
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium text-gray-900 mb-2">지출 정보</h5>
                                <div className="space-y-1">
                                  {expenseDetails[reservation.reservationId].expenses.length > 0 ? (
                                    expenseDetails[reservation.reservationId].expenses.map((expense: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <div className="flex flex-col">
                                          <span className="text-gray-600">{expense.paid_for || '지출 항목'}</span>
                                          <span className="text-xs text-gray-500">{expense.paid_to || '결제처'}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                          <span className="font-medium text-red-600">${expense.amount?.toLocaleString() || 0}</span>
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
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-500">지출 내역이 없습니다.</div>
                                  )}
                                </div>
                              </div>
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
