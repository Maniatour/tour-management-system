'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { BarChart3, TrendingUp, DollarSign, Users, Package, Receipt, CreditCard, Calendar, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ComprehensiveReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
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

  useEffect(() => {
    loadComprehensiveStats()
  }, [dateRange, period])

  const loadComprehensiveStats = async () => {
    setLoading(true)
    try {
      // 예약 통계
      const filteredReservations = reservations.filter(r => {
        const date = new Date(r.addedTime)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
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

      // 투어 통계
      const { data: tours } = await supabase
        .from('tours')
        .select('id, reservation_ids')
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)

      let tourRevenue = 0
      let tourExpenses = 0

      if (tours && tours.length > 0) {
        const tourIds = tours.map(t => t.id)
        
        // 투어별 예약 가격 합산
        for (const tour of tours) {
          if (tour.reservation_ids && Array.isArray(tour.reservation_ids)) {
            const { data: pricing } = await supabase
              .from('reservation_pricing')
              .select('total_price')
              .in('reservation_id', tour.reservation_ids)
            
            if (pricing) {
              tourRevenue += pricing.reduce((sum, p) => sum + (p.total_price || 0), 0)
            }
          }
        }

        // 투어 지출 합산
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

      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      // 지출 통계 - tour_expenses는 submit_on 기준으로 필터링
      const { data: allExpenses, error: tourExpensesError } = await supabase
        .from('tour_expenses')
        .select('amount, paid_for')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)

      if (tourExpensesError) {
        console.error('투어 지출 조회 오류:', tourExpensesError)
      }

      // reservation_expenses는 submit_on 기준
      const { data: reservationExpenses, error: reservationError } = await supabase
        .from('reservation_expenses')
        .select('amount, paid_for')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)

      if (reservationError) {
        console.error('예약 지출 조회 오류:', reservationError)
      }

      // company_expenses는 submit_on 기준
      const { data: companyExpenses, error: companyError } = await supabase
        .from('company_expenses')
        .select('amount, category')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)

      if (companyError) {
        console.error('회사 지출 조회 오류:', companyError)
      }

      // ticket_bookings - submit_on 기준
      const { data: ticketBookings, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('expense, category')
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)
        .in('status', ['confirmed', 'paid'])

      if (ticketError) {
        console.error('입장권 부킹 조회 오류:', ticketError)
      }

      // tours 테이블의 guide_fee, assistant_fee (tour_date는 DATE 타입이므로 'YYYY-MM-DD' 형식 사용)
      const { data: toursForFees, error: toursFeesError } = await supabase
        .from('tours')
        .select('guide_fee, assistant_fee')
        .gte('tour_date', dateRange.start)
        .lte('tour_date', dateRange.end)

      if (toursFeesError) {
        console.error('투어 수수료 조회 오류:', toursFeesError)
      }

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

      const depositMap = new Map<string, number>()
      if (deposits) {
        deposits.forEach(d => {
          const method = d.payment_method || 'Unknown'
          depositMap.set(method, (depositMap.get(method) || 0) + (d.amount || 0))
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

      // 현금 통계 (2026년 1월 1일부터)
      const baseDate = '2026-01-01'
      const { data: allCashTransactions } = await supabase
        .from('cash_transactions')
        .select('transaction_type, amount')
        .gte('transaction_date', baseDate + 'T00:00:00')

      const { data: allCashPayments } = await supabase
        .from('payment_records')
        .select('amount')
        .eq('payment_method', 'PAYM032')
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
        .gte('submit_on', baseDate + 'T00:00:00')

      const cashBalance = (allCashTransactions || []).reduce((balance, t) => {
        if (t.transaction_type === 'deposit') {
          return balance + (t.amount || 0)
        } else {
          return balance - (t.amount || 0)
        }
      }, 0) + (allCashPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

      // 기간 내 현금 거래
      const { data: periodCashTransactions } = await supabase
        .from('cash_transactions')
        .select('transaction_type, amount')
        .gte('transaction_date', startISO)
        .lte('transaction_date', endISO)

      // 기간 내 payment_records에서 현금 입금 조회
      const { data: periodCashPayments } = await supabase
        .from('payment_records')
        .select('amount')
        .eq('payment_method', 'PAYM032')
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)

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
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <TrendingUp size={20} />
            <span>지출 통계</span>
          </h3>
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
              <p className="text-sm font-medium text-gray-700 mb-2">카테고리별</p>
              <div className="space-y-2">
                {stats.expenses.byCategory.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{item.category}</span>
                    <span>${item.amount.toLocaleString()}</span>
                  </div>
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
    </div>
  )
}
