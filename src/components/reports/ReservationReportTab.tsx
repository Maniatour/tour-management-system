'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Users, Package, Link, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ReservationReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
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

  useEffect(() => {
    loadReservationStats()
  }, [dateRange, period, reservations])

  const loadReservationStats = async () => {
    setLoading(true)
    try {
      const filteredReservations = reservations.filter(r => {
        const date = new Date(r.addedTime)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
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

      // 예약별 정산 (수익 - 지출)
      const reservationSettlements = await Promise.all(
        filteredReservations.map(async (r) => {
          const pricing = reservationPricing.find(p => p.reservation_id === r.id)
          const revenue = pricing?.total_price || 0

          const { data: expenses } = await supabase
            .from('reservation_expenses')
            .select('amount')
            .eq('reservation_id', r.id)

          const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
          const netProfit = revenue - totalExpenses

          return {
            reservationId: r.id,
            customerName: customers.find(c => c.id === r.customerId)?.name || 'Unknown',
            productName: products.find(p => p.id === r.productId)?.name || 'Unknown',
            channelName: channels.find(c => c.id === r.channelId)?.name || 'Unknown',
            totalPeople: r.totalPeople || 0,
            revenue,
            expenses: totalExpenses,
            netProfit
          }
        })
      )

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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">인원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수익</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순이익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.settlements.slice(0, 50).map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm">{item.customerName}</td>
                  <td className="px-4 py-3 text-sm">{item.productName}</td>
                  <td className="px-4 py-3 text-sm">{item.channelName}</td>
                  <td className="px-4 py-3 text-sm">{item.totalPeople}</td>
                  <td className="px-4 py-3 text-sm">${item.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-red-600">${item.expenses.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">${item.netProfit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
