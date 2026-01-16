'use client'

import React, { useState, useEffect } from 'react'
import { Receipt, DollarSign, TrendingUp, PieChart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SettlementReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
}

export default function SettlementReportTab({ dateRange, period }: SettlementReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettlementStats()
  }, [dateRange, period])

  const loadSettlementStats = async () => {
    setLoading(true)
    try {
      const toNumber = (v: unknown) => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') {
          const n = parseFloat(v)
          return Number.isFinite(n) ? n : 0
        }
        return 0
      }

      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      // 날짜 범위를 ISO 형식으로 변환 (시간 포함)
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

      // 1단계: 기본 데이터 병렬 조회
      const [reservationsResult, toursResult, companyExpensesResult, depositsResult] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, created_at')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('tours')
          .select('id, reservation_ids')
          .gte('tour_date', dateRange.start)
          .lte('tour_date', dateRange.end),
        supabase
          .from('company_expenses')
          .select('amount')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('payment_records')
          .select('amount')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
          .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
      ])

      const reservations = reservationsResult.data || []
      const tours = toursResult.data || []
      const companyExpenses = companyExpensesResult.data || []
      const deposits = depositsResult.data || []

      const reservationIds = reservations.map(r => r.id)
      const tourIds = tours.map(t => t.id)
      const allTourReservationIds = [...new Set(
        tours
          .flatMap(t => (Array.isArray(t.reservation_ids) ? t.reservation_ids : []))
          .filter(Boolean)
      )]

      // 2단계: 관련 데이터 병렬 조회
      const [reservationPricingResult, reservationExpensesResult, tourPricingResult, tourExpensesResult] = await Promise.all([
        reservationIds.length > 0
          ? supabase.from('reservation_pricing').select('total_price').in('reservation_id', reservationIds)
          : Promise.resolve({ data: [] }),
        reservationIds.length > 0
          ? supabase.from('reservation_expenses').select('amount').in('reservation_id', reservationIds)
          : Promise.resolve({ data: [] }),
        allTourReservationIds.length > 0
          ? supabase.from('reservation_pricing').select('total_price').in('reservation_id', allTourReservationIds)
          : Promise.resolve({ data: [] }),
        tourIds.length > 0
          ? supabase.from('tour_expenses').select('amount').in('tour_id', tourIds)
          : Promise.resolve({ data: [] })
      ])

      const reservationRevenue = (reservationPricingResult.data || [])
        .reduce((sum, p) => sum + toNumber((p as any).total_price), 0)
      const reservationExpenses = (reservationExpensesResult.data || [])
        .reduce((sum, e) => sum + toNumber((e as any).amount), 0)
      const tourRevenue = (tourPricingResult.data || [])
        .reduce((sum, p) => sum + toNumber((p as any).total_price), 0)
      const tourExpenses = (tourExpensesResult.data || [])
        .reduce((sum, e) => sum + toNumber((e as any).amount), 0)

      const totalCompanyExpenses = companyExpenses.reduce((sum, e) => sum + toNumber((e as any).amount), 0)
      const totalDeposits = deposits.reduce((sum, d) => sum + toNumber((d as any).amount), 0)

      // 총계
      const totalRevenue = reservationRevenue + tourRevenue
      const totalExpenses = reservationExpenses + tourExpenses + totalCompanyExpenses
      const netProfit = totalRevenue - totalExpenses
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

      setStats({
        revenue: {
          reservations: reservationRevenue,
          tours: tourRevenue,
          total: totalRevenue
        },
        expenses: {
          reservations: reservationExpenses,
          tours: tourExpenses,
          company: totalCompanyExpenses,
          total: totalExpenses
        },
        deposits: totalDeposits,
        profit: {
          net: netProfit,
          margin: profitMargin
        }
      })
    } catch (error) {
      console.error('정산 통계 로드 오류:', error)
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
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">총 수익</p>
              <p className="text-3xl font-bold text-gray-900">${stats.revenue.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">총 지출</p>
              <p className="text-3xl font-bold text-gray-900">${stats.expenses.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Receipt className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">순이익</p>
              <p className="text-3xl font-bold text-gray-900">${stats.profit.net.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <PieChart className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">순이익률</p>
              <p className="text-3xl font-bold text-gray-900">{stats.profit.margin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* 수익 상세 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">수익 상세</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">예약 수익</span>
            <span className="font-semibold text-green-600">${stats.revenue.reservations.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">투어 수익</span>
            <span className="font-semibold text-green-600">${stats.revenue.tours.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <span className="text-gray-900 font-semibold">총 수익</span>
            <span className="font-bold text-green-600 text-lg">${stats.revenue.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 지출 상세 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">지출 상세</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">예약 지출</span>
            <span className="font-semibold text-red-600">${stats.expenses.reservations.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">투어 지출</span>
            <span className="font-semibold text-red-600">${stats.expenses.tours.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">회사 지출</span>
            <span className="font-semibold text-red-600">${stats.expenses.company.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <span className="text-gray-900 font-semibold">총 지출</span>
            <span className="font-bold text-red-600 text-lg">${stats.expenses.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 정산 요약 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">정산 요약</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-100 text-sm">총 수익</p>
            <p className="text-2xl font-bold">${stats.revenue.total.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">총 지출</p>
            <p className="text-2xl font-bold">${stats.expenses.total.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">순이익</p>
            <p className="text-2xl font-bold">${stats.profit.net.toLocaleString()}</p>
            <p className="text-blue-100 text-sm mt-1">({stats.profit.margin.toFixed(1)}%)</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-400">
          <p className="text-blue-100 text-sm">총 입금액</p>
          <p className="text-2xl font-bold">${stats.deposits.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
