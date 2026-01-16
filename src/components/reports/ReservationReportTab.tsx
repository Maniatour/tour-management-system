'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Users, Package, Link, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ReservationReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
  reservations: any[]
  products: any[]
  channels: any[]
  customers: any[]
}

export default function ReservationReportTab({
  dateRange,
  period,
  reservations,
  products,
  channels,
  customers
}: ReservationReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const displayedSettlements = useMemo(() => {
    if (!stats?.settlements) return []
    return stats.settlements.slice(0, 50)
  }, [stats])

  const displayedTotals = useMemo(() => {
    return displayedSettlements.reduce(
      (acc: { revenue: number; expenses: number; netProfit: number }, cur: any) => ({
        revenue: acc.revenue + (cur?.revenue || 0),
        expenses: acc.expenses + (cur?.expenses || 0),
        netProfit: acc.netProfit + (cur?.netProfit || 0)
      }),
      { revenue: 0, expenses: 0, netProfit: 0 }
    )
  }, [displayedSettlements])

  const overallTotals = useMemo(() => {
    if (!stats?.settlements) return { revenue: 0, expenses: 0, netProfit: 0 }
    return stats.settlements.reduce(
      (acc: { revenue: number; expenses: number; netProfit: number }, cur: any) => ({
        revenue: acc.revenue + (cur?.revenue || 0),
        expenses: acc.expenses + (cur?.expenses || 0),
        netProfit: acc.netProfit + (cur?.netProfit || 0)
      }),
      { revenue: 0, expenses: 0, netProfit: 0 }
    )
  }, [stats])

  useEffect(() => {
    loadReservationStats()
  }, [dateRange, period, reservations])

  const loadReservationStats = async () => {
    setLoading(true)
    try {
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      const filteredReservations = reservations.filter(r => {
        const date = new Date(r.addedTime)
        // dateRange는 'YYYY-MM-DD' 이므로 로컬 하루 범위로 비교
        const start = new Date(dateRange.start + 'T00:00:00')
        const end = new Date(dateRange.end + 'T23:59:59.999')
        return date >= start && date <= end
      })

      const reservationIds = filteredReservations.map(r => r.id)
      let reservationPricing: any[] = []
      if (reservationIds.length > 0) {
        const { data: pricing } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, total_price, commission_amount, additional_cost')
          .in('reservation_id', reservationIds)
        reservationPricing = pricing || []
      }

      // 채널별 통계
      const channelMap = new Map<string, { count: number; people: number; revenue: number; commission: number }>()
      filteredReservations.forEach(r => {
        const channelName = channels.find(c => c.id === r.channelId)?.name || 'Unknown'
        const pricing = reservationPricing.find(p => p.reservation_id === r.id)
        
        if (!channelMap.has(channelName)) {
          channelMap.set(channelName, { count: 0, people: 0, revenue: 0, commission: 0 })
        }
        const stats = channelMap.get(channelName)!
        stats.count++
        stats.people += r.totalPeople || 0
        stats.revenue += pricing?.total_price || 0
        stats.commission += pricing?.commission_amount || 0
      })

      // 상품별 통계
      const productMap = new Map<string, { count: number; people: number; revenue: number }>()
      filteredReservations.forEach(r => {
        const productName = products.find(p => p.id === r.productId)?.name || 'Unknown'
        const pricing = reservationPricing.find(p => p.reservation_id === r.id)
        
        if (!productMap.has(productName)) {
          productMap.set(productName, { count: 0, people: 0, revenue: 0 })
        }
        const stats = productMap.get(productName)!
        stats.count++
        stats.people += r.totalPeople || 0
        stats.revenue += pricing?.total_price || 0
      })

      // 예약별 정산 (수익 - 지출) - 최적화: 단일 쿼리로 모든 지출 조회
      let allExpenses: { reservation_id: string; amount: number }[] = []
      if (reservationIds.length > 0) {
        const { data: expensesData } = await supabase
          .from('reservation_expenses')
          .select('reservation_id, amount')
          .in('reservation_id', reservationIds)
        allExpenses = expensesData || []
      }

      // 예약별 지출 합계를 Map으로 미리 계산
      const expensesByReservation = new Map<string, number>()
      allExpenses.forEach(e => {
        const current = expensesByReservation.get(e.reservation_id) || 0
        expensesByReservation.set(e.reservation_id, current + (e.amount || 0))
      })

      // 채널/상품/고객 조회를 Map으로 최적화
      const channelNameMap = new Map(channels.map(c => [c.id, c.name]))
      const productNameMap = new Map(products.map(p => [p.id, p.name]))
      const customerNameMap = new Map(customers.map(c => [c.id, c.name]))
      const pricingMap = new Map(reservationPricing.map(p => [p.reservation_id, p.total_price || 0]))

      const reservationSettlements = filteredReservations.map(r => {
        const revenue = pricingMap.get(r.id) || 0
        const totalExpenses = expensesByReservation.get(r.id) || 0
        const netProfit = revenue - totalExpenses

        return {
          reservationId: r.id,
          status: r.status || 'Unknown',
          customerName: customerNameMap.get(r.customerId) || 'Unknown',
          productName: productNameMap.get(r.productId) || 'Unknown',
          channelName: channelNameMap.get(r.channelId) || 'Unknown',
          totalPeople: r.totalPeople || 0,
          revenue,
          expenses: totalExpenses,
          netProfit
        }
      })

      setStats({
        total: filteredReservations.length,
        totalPeople: filteredReservations.reduce((sum, r) => sum + (r.totalPeople || 0), 0),
        totalRevenue: reservationPricing.reduce((sum, p) => sum + (p.total_price || 0), 0),
        byChannel: Array.from(channelMap.entries()).map(([channel, data]) => ({
          channel,
          ...data
        })),
        byProduct: Array.from(productMap.entries()).map(([product, data]) => ({
          product,
          ...data
        })),
        settlements: reservationSettlements
      })
    } catch (error) {
      console.error('예약 통계 로드 오류:', error)
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
    return <div className="text-center py-12 text-gray-500">데이터를 불러올 수 없습니다.</div>
  }

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">총 예약</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">{stats.totalPeople}명</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">총 수익</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Package className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">평균 예약금액</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.total > 0 ? (stats.totalRevenue / stats.total).toFixed(0) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 채널별 통계 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Link size={20} />
          <span>채널별 통계</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약 수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.byChannel.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{item.channel}</td>
                  <td className="px-4 py-3 text-sm">{item.count}</td>
                  <td className="px-4 py-3 text-sm">{item.people}</td>
                  <td className="px-4 py-3 text-sm font-medium">${item.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">${item.commission.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상품별 통계 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Package size={20} />
          <span>상품별 통계</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약 수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.byProduct.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{item.product}</td>
                  <td className="px-4 py-3 text-sm">{item.count}</td>
                  <td className="px-4 py-3 text-sm">{item.people}</td>
                  <td className="px-4 py-3 text-sm font-medium">${item.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 예약별 정산 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">예약별 정산</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순이익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedSettlements.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{item.customerName}</td>
                  <td className="px-4 py-3 text-sm">{item.productName}</td>
                  <td className="px-4 py-3 text-sm">{item.channelName}</td>
                  <td className="px-4 py-3 text-sm">{item.status}</td>
                  <td className="px-4 py-3 text-sm">{item.totalPeople}</td>
                  <td className="px-4 py-3 text-sm">${item.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-red-600">${item.expenses.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">${item.netProfit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr className="font-semibold">
                <td className="px-4 py-3 text-sm text-gray-700" colSpan={5}>
                  소계 (표시된 {displayedSettlements.length}건)
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  ${displayedTotals.revenue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-red-700">
                  ${displayedTotals.expenses.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-green-700">
                  ${displayedTotals.netProfit.toLocaleString()}
                </td>
              </tr>
              <tr className="font-bold">
                <td className="px-4 py-3 text-sm text-gray-900" colSpan={5}>
                  총합 (전체 {stats.settlements.length}건)
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  ${overallTotals.revenue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-red-700">
                  ${overallTotals.expenses.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-green-700">
                  ${overallTotals.netProfit.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
