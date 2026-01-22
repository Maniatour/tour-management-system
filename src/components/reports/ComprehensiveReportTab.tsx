'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { BarChart3, TrendingUp, DollarSign, Users, Package, Receipt, CreditCard, Calendar, Wallet, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CategoryManagerModal from '@/components/expenses/CategoryManagerModal'
import ExpenseDetailModal from '@/components/expenses/ExpenseDetailModal'

interface ComprehensiveReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
  reservations: any[]
  products: any[]
  channels: any[]
  customers: any[]
}

interface ComprehensiveStats {
  reservations: {
    total: number
    totalPeople: number
    totalRevenue: number
    byChannel: Array<{ channel: string; count: number; revenue: number }>
    byProduct: Array<{ product: string; count: number; revenue: number }>
  }
  tours: {
    total: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
  }
  expenses: {
    total: number
    byCategory: Array<{ category: string; amount: number }>
  }
  deposits: {
    total: number
    byMethod: Array<{ method: string; amount: number }>
  }
  settlement: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    profitMargin: number
  }
}

export default function ComprehensiveReportTab({
  dateRange,
  period,
  reservations,
  products,
  channels,
  customers
}: ComprehensiveReportTabProps) {
  const [stats, setStats] = useState<ComprehensiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 모달 상태
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isExpenseDetailOpen, setIsExpenseDetailOpen] = useState(false)

  useEffect(() => {
    loadComprehensiveStats()
  }, [dateRange, period])

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category)
    setIsExpenseDetailOpen(true)
  }

  const handleExpenseUpdate = () => {
    // 지출 데이터가 업데이트되면 통계 다시 로드
    loadComprehensiveStats()
  }

  const loadComprehensiveStats = async () => {
    setLoading(true)
    try {
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      // 예약 통계
      const filteredReservations = reservations.filter(r => {
        const date = new Date(r.addedTime)
        const start = new Date(dateRange.start + 'T00:00:00')
        const end = new Date(dateRange.end + 'T23:59:59.999')
        return date >= start && date <= end
      })

      // 예약 가격 정보 조회
      const reservationIds = filteredReservations.map(r => r.id)
      let reservationPricing: any[] = []
      if (reservationIds.length > 0) {
        const { data: pricing } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price')
          .in('reservation_id', reservationIds)
        reservationPricing = pricing || []
      }

      const reservationStats = {
        total: filteredReservations.length,
        totalPeople: filteredReservations.reduce((sum, r) => sum + (r.totalPeople || 0), 0),
        totalRevenue: reservationPricing.reduce((sum, p) => sum + (p.total_price || 0), 0),
        byChannel: [] as Array<{ channel: string; count: number; revenue: number }>,
        byProduct: [] as Array<{ product: string; count: number; revenue: number }>
      }

      // 채널별 통계
      const channelMap = new Map<string, { count: number; revenue: number }>()
      filteredReservations.forEach(r => {
        const channelName = channels.find(c => c.id === r.channelId)?.name || 'Unknown'
        const pricing = reservationPricing.find(p => p.reservation_id === r.id)
        const revenue = pricing?.total_price || 0
        
        if (!channelMap.has(channelName)) {
          channelMap.set(channelName, { count: 0, revenue: 0 })
        }
        const stats = channelMap.get(channelName)!
        stats.count++
        stats.revenue += revenue
      })
      reservationStats.byChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
        channel,
        ...data
      }))

      // 상품별 통계
      const productMap = new Map<string, { count: number; revenue: number }>()
      filteredReservations.forEach(r => {
        const productName = products.find(p => p.id === r.productId)?.name || 'Unknown'
        const pricing = reservationPricing.find(p => p.reservation_id === r.id)
        const revenue = pricing?.total_price || 0
        
        if (!productMap.has(productName)) {
          productMap.set(productName, { count: 0, revenue: 0 })
        }
        const stats = productMap.get(productName)!
        stats.count++
        stats.revenue += revenue
      })
      reservationStats.byProduct = Array.from(productMap.entries()).map(([product, data]) => ({
        product,
        ...data
      }))

      // 투어 통계 - 최적화: 모든 예약 ID를 한 번에 수집하여 단일 쿼리로 처리
      const { data: tours } = await supabase
        .from('tours')
        .select('id, reservation_ids')
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)

      let tourRevenue = 0
      let tourExpenses = 0

      if (tours && tours.length > 0) {
        const tourIds = tours.map(t => t.id)
        
        // 모든 투어의 예약 ID를 한 번에 수집
        const allTourReservationIds = [...new Set(
          tours
            .flatMap(t => (Array.isArray(t.reservation_ids) ? t.reservation_ids : []))
            .filter(Boolean)
        )]
        
        // 단일 쿼리로 모든 예약 가격 조회
        if (allTourReservationIds.length > 0) {
          const { data: allPricing } = await supabase
            .from('reservation_pricing')
            .select('total_price')
            .in('reservation_id', allTourReservationIds)
          
          if (allPricing) {
            tourRevenue = allPricing.reduce((sum, p) => sum + (p.total_price || 0), 0)
          }
        }

        // 투어 지출 합산 (이미 단일 쿼리)
        const { data: expenses } = await supabase
          .from('tour_expenses')
          .select('amount')
          .in('tour_id', tourIds)
        
        if (expenses) {
          tourExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        }
      }

      const tourStats = {
        total: tours?.length || 0,
        totalRevenue: tourRevenue,
        totalExpenses: tourExpenses,
        netProfit: tourRevenue - tourExpenses
      }

      // 날짜 범위를 ISO 형식으로 변환 (시간 포함, 로컬 시간대 유지)
      const startDate = new Date(dateRange.start + 'T00:00:00')
      const endDate = new Date(dateRange.end + 'T23:59:59.999')

      // 날짜 유효성 검사
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('유효하지 않은 날짜 범위:', dateRange)
        setLoading(false)
        return
      }

      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      // 모든 지출 관련 쿼리를 병렬로 실행
      const [
        tourExpensesResult,
        reservationExpensesResult,
        companyExpensesResult,
        ticketBookingsResult,
        toursForFeesResult
      ] = await Promise.all([
        // 지출 통계 - tour_expenses는 submit_on 기준으로 필터링
        supabase
          .from('tour_expenses')
          .select('amount, paid_for')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        // reservation_expenses는 submit_on 기준
        supabase
          .from('reservation_expenses')
          .select('amount, paid_for')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        // company_expenses는 submit_on 기준
        supabase
          .from('company_expenses')
          .select('amount, category')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        // ticket_bookings - submit_on 기준
        supabase
          .from('ticket_bookings')
          .select('expense, category')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
          .in('status', ['confirmed', 'paid']),
        // tours 테이블의 guide_fee, assistant_fee
        supabase
          .from('tours')
          .select('guide_fee, assistant_fee')
          .gte('tour_date', dateRange.start)
          .lte('tour_date', dateRange.end)
      ])

      const allExpenses = tourExpensesResult.data
      const reservationExpenses = reservationExpensesResult.data
      const companyExpenses = companyExpensesResult.data
      const ticketBookings = ticketBookingsResult.data
      const toursForFees = toursForFeesResult.data

      if (tourExpensesResult.error) console.error('투어 지출 조회 오류:', tourExpensesResult.error)
      if (reservationExpensesResult.error) console.error('예약 지출 조회 오류:', reservationExpensesResult.error)
      if (companyExpensesResult.error) console.error('회사 지출 조회 오류:', companyExpensesResult.error)
      if (ticketBookingsResult.error) console.error('입장권 부킹 조회 오류:', ticketBookingsResult.error)
      if (toursForFeesResult.error) console.error('투어 수수료 조회 오류:', toursForFeesResult.error)

      const expenseMap = new Map<string, number>()
      
      // tour_expenses
      if (allExpenses) {
        allExpenses.forEach((e: any) => {
          const category = e.paid_for || '기타'
          expenseMap.set(category, (expenseMap.get(category) || 0) + (e.amount || 0))
        })
      }
      
      // reservation_expenses
      if (reservationExpenses) {
        reservationExpenses.forEach((e: any) => {
          const category = e.paid_for || '기타'
          expenseMap.set(category, (expenseMap.get(category) || 0) + (e.amount || 0))
        })
      }
      
      // company_expenses
      if (companyExpenses) {
        companyExpenses.forEach((e: any) => {
          const category = e.category || '기타'
          expenseMap.set(category, (expenseMap.get(category) || 0) + (e.amount || 0))
        })
      }

      // ticket_bookings
      if (ticketBookings) {
        ticketBookings.forEach((e: any) => {
          const category = e.category || '입장권'
          expenseMap.set(category, (expenseMap.get(category) || 0) + (e.expense || 0))
        })
      }

      // tours guide_fee, assistant_fee
      if (toursForFees) {
        const totalGuideFees = toursForFees.reduce((sum, t) => sum + (t.guide_fee || 0), 0)
        const totalAssistantFees = toursForFees.reduce((sum, t) => sum + (t.assistant_fee || 0), 0)
        
        if (totalGuideFees > 0) {
          expenseMap.set('가이드 수수료', (expenseMap.get('가이드 수수료') || 0) + totalGuideFees)
        }
        if (totalAssistantFees > 0) {
          expenseMap.set('어시스턴트 수수료', (expenseMap.get('어시스턴트 수수료') || 0) + totalAssistantFees)
        }
      }

      // 총 지출 계산 (모든 소스 포함)
      const tourExpensesTotal = (allExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
      const reservationExpensesTotal = (reservationExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
      const companyExpensesTotal = (companyExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
      const ticketBookingsTotal = (ticketBookings || []).reduce((sum, e) => sum + (e.expense || 0), 0)
      const guideFeesTotal = (toursForFees || []).reduce((sum, t) => sum + (t.guide_fee || 0), 0)
      const assistantFeesTotal = (toursForFees || []).reduce((sum, t) => sum + (t.assistant_fee || 0), 0)

      const expenseStats = {
        total: tourExpensesTotal + reservationExpensesTotal + companyExpensesTotal + ticketBookingsTotal + guideFeesTotal + assistantFeesTotal,
        byCategory: Array.from(expenseMap.entries()).map(([category, amount]) => ({
          category,
          amount
        })),
        breakdown: {
          tourExpenses: tourExpensesTotal,
          reservationExpenses: reservationExpensesTotal,
          companyExpenses: companyExpensesTotal,
          ticketBookings: ticketBookingsTotal,
          guideFees: guideFeesTotal,
          assistantFees: assistantFeesTotal
        }
      }

      // 입금 통계
      const { data: deposits } = await supabase
        .from('payment_records')
        .select('amount, payment_method')
        .gte('submit_on', dateRange.start)
        .lte('submit_on', dateRange.end)
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])

      // 결제 방법 정보 조회
      const paymentMethodIds = [...new Set((deposits || []).map(d => d.payment_method).filter(Boolean))]
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, method, display_name')
        .in('id', paymentMethodIds)

      // 결제 방법 ID -> 방법명 매핑 생성 (method 컬럼 우선 사용)
      const methodNameMap = new Map<string, string>()
      if (paymentMethods) {
        paymentMethods.forEach(pm => {
          // payment_methods 테이블의 method 컬럼 값을 사용
          const methodName = pm.method || pm.display_name || pm.id
          methodNameMap.set(pm.id, methodName)
        })
      }

      const depositMap = new Map<string, number>()
      if (deposits) {
        deposits.forEach(d => {
          const methodId = d.payment_method || 'Unknown'
          // payment_methods 테이블에서 조회한 method 값을 사용
          const methodName = methodNameMap.get(methodId) || methodId
          depositMap.set(methodName, (depositMap.get(methodName) || 0) + (d.amount || 0))
        })
      }

      const depositStats = {
        total: deposits?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0,
        byMethod: Array.from(depositMap.entries()).map(([method, amount]) => ({
          method,
          amount
        }))
      }

      // 정산 통계
      const totalRevenue = reservationStats.totalRevenue + tourStats.totalRevenue
      const totalExpenses = expenseStats.total + tourStats.totalExpenses
      const netProfit = totalRevenue - totalExpenses
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

      const settlementStats = {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin
      }

      // 현금 통계 (2026년 1월 1일부터) - 병렬 처리
      const baseDate = '2026-01-01'
      const [
        allCashTransactionsResult,
        allCashPaymentsResult,
        periodCashTransactionsResult,
        periodCashPaymentsResult
      ] = await Promise.all([
        supabase
          .from('cash_transactions')
          .select('transaction_type, amount')
          .gte('transaction_date', baseDate + 'T00:00:00'),
        supabase
          .from('payment_records')
          .select('amount')
          .in('payment_method', ['PAYM032', 'PAYM001'])
          .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
          .gte('submit_on', baseDate + 'T00:00:00'),
        // 기간 내 현금 거래
        supabase
          .from('cash_transactions')
          .select('transaction_type, amount')
          .gte('transaction_date', startISO)
          .lte('transaction_date', endISO),
        // 기간 내 payment_records에서 현금 입금 조회
        supabase
          .from('payment_records')
          .select('amount')
          .in('payment_method', ['PAYM032', 'PAYM001'])
          .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
      ])

      const allCashTransactions = allCashTransactionsResult.data
      const allCashPayments = allCashPaymentsResult.data
      const periodCashTransactions = periodCashTransactionsResult.data
      const periodCashPayments = periodCashPaymentsResult.data

      const cashBalance = (allCashTransactions || []).reduce((balance, t) => {
        if (t.transaction_type === 'deposit') {
          return balance + (t.amount || 0)
        } else {
          return balance - (t.amount || 0)
        }
      }, 0) + (allCashPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

      const periodCashDeposits = (periodCashTransactions || [])
        .filter(t => t.transaction_type === 'deposit')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const periodCashWithdrawals = (periodCashTransactions || [])
        .filter(t => t.transaction_type === 'withdrawal')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const periodCashPaymentsTotal = (periodCashPayments || [])
        .reduce((sum, p) => sum + (p.amount || 0), 0)

      const cashStats = {
        balance: cashBalance,
        periodDeposits: periodCashDeposits + periodCashPaymentsTotal,
        periodWithdrawals: periodCashWithdrawals,
        netFlow: (periodCashDeposits + periodCashPaymentsTotal) - periodCashWithdrawals
      }

      setStats({
        reservations: reservationStats,
        tours: tourStats,
        expenses: expenseStats,
        deposits: depositStats,
        settlement: settlementStats,
        cash: cashStats
      })
    } catch (error) {
      console.error('종합 통계 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        데이터를 불러올 수 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">총 예약</p>
              <p className="text-3xl font-bold mt-2">{stats.reservations.total.toLocaleString()}</p>
              <p className="text-blue-100 text-sm mt-1">{stats.reservations.totalPeople.toLocaleString()}명</p>
            </div>
            <Users className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">총 수익</p>
              <p className="text-3xl font-bold mt-2">${stats.settlement.totalRevenue.toLocaleString()}</p>
              <p className="text-green-100 text-sm mt-1">순이익: ${stats.settlement.netProfit.toLocaleString()}</p>
            </div>
            <DollarSign className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">총 지출</p>
              <p className="text-3xl font-bold mt-2">${stats.settlement.totalExpenses.toLocaleString()}</p>
              <p className="text-red-100 text-sm mt-1">투어: ${stats.tours.totalExpenses.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">순이익률</p>
              <p className="text-3xl font-bold mt-2">{stats.settlement.profitMargin.toFixed(1)}%</p>
              <p className="text-purple-100 text-sm mt-1">입금: ${stats.deposits.total.toLocaleString()}</p>
            </div>
            <Receipt className="h-12 w-12 text-purple-200" />
          </div>
        </div>
      </div>

      {/* 상세 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 예약 통계 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Users size={20} />
            <span>예약 통계</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 예약 수</span>
              <span className="font-semibold">{stats.reservations.total}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 인원</span>
              <span className="font-semibold">{stats.reservations.totalPeople}명</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 수익</span>
              <span className="font-semibold text-green-600">${stats.reservations.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">채널별 (상위 5개)</p>
              <div className="space-y-2">
                {stats.reservations.byChannel.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{item.channel}</span>
                    <span>{item.count}건 / ${item.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 투어 통계 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Calendar size={20} />
            <span>투어 통계</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 투어 수</span>
              <span className="font-semibold">{stats.tours.total}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 수익</span>
              <span className="font-semibold text-green-600">${stats.tours.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 지출</span>
              <span className="font-semibold text-red-600">${stats.tours.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">순이익</span>
              <span className="font-semibold text-blue-600">${stats.tours.netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 지출 통계 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <TrendingUp size={20} />
              <span>지출 통계</span>
            </h3>
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            >
              <Settings size={14} />
              카테고리 매니저
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 지출</span>
              <span className="font-semibold text-red-600">${stats.expenses.total.toLocaleString()}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">유형별 지출</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">투어 지출</span>
                  <span>${(stats.expenses.breakdown?.tourExpenses || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">예약 지출</span>
                  <span>${(stats.expenses.breakdown?.reservationExpenses || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">회사 지출</span>
                  <span>${(stats.expenses.breakdown?.companyExpenses || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">입장권 부킹</span>
                  <span>${(stats.expenses.breakdown?.ticketBookings || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">가이드 수수료</span>
                  <span>${(stats.expenses.breakdown?.guideFees || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">어시스턴트 수수료</span>
                  <span>${(stats.expenses.breakdown?.assistantFees || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">카테고리별 (클릭하여 상세 보기)</p>
              <div className="space-y-2">
                {stats.expenses.byCategory.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCategoryClick(item.category)}
                    className="w-full flex justify-between items-center text-sm p-2 rounded hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="text-gray-600 hover:text-blue-600">{item.category}</span>
                    <span className="font-medium">${item.amount.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 입금 통계 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <CreditCard size={20} />
            <span>입금 통계</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 입금액</span>
              <span className="font-semibold text-green-600">${stats.deposits.total.toLocaleString()}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">결제 방법별</p>
              <div className="space-y-2">
                {stats.deposits.byMethod.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{item.method}</span>
                    <span>${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 현금 관리 통계 */}
        {stats.cash && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Wallet size={20} />
              <span>현금 관리</span>
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">현재 잔액</span>
                <span className="font-semibold text-purple-600">${(stats.cash.balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">기간 내 입금</span>
                <span className="font-semibold text-green-600">${(stats.cash.periodDeposits || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">기간 내 출금</span>
                <span className="font-semibold text-red-600">${(stats.cash.periodWithdrawals || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-gray-900 font-semibold">순 현금 흐름</span>
                <span className={`font-bold text-lg ${
                  (stats.cash.netFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${(stats.cash.netFlow || 0).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * 잔액은 2026년 1월 1일부터 계산
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 모달들 */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        onSave={handleExpenseUpdate}
      />

      {selectedCategory && (
        <ExpenseDetailModal
          isOpen={isExpenseDetailOpen}
          onClose={() => {
            setIsExpenseDetailOpen(false)
            setSelectedCategory(null)
          }}
          category={selectedCategory}
          dateRange={dateRange}
          onUpdate={handleExpenseUpdate}
        />
      )}
    </div>
  )
}
