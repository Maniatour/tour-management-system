'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, PieChart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ExpenseReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
}

export default function ExpenseReportTab({ dateRange, period }: ExpenseReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExpenseStats()
  }, [dateRange, period])

  const loadExpenseStats = async () => {
    setLoading(true)
    try {
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
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

      // ISO 형식으로 변환 (타임존 정보 포함)
      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      // 모든 지출 관련 쿼리를 병렬로 실행
      const [
        tourExpensesResult,
        reservationExpensesResult,
        companyExpensesResult,
        ticketBookingsResult,
        toursResult
      ] = await Promise.all([
        supabase
          .from('tour_expenses')
          .select('amount, paid_for, payment_method')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('reservation_expenses')
          .select('amount, paid_for, payment_method')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('company_expenses')
          .select('amount, category, payment_method')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('ticket_bookings')
          .select('expense, category, payment_method, tour_id')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
          .in('status', ['confirmed', 'paid']),
        supabase
          .from('tours')
          .select('guide_fee, assistant_fee')
          .gte('tour_date', dateRange.start)
          .lte('tour_date', dateRange.end)
      ])

      const tourExpenses = tourExpensesResult.data
      const reservationExpenses = reservationExpensesResult.data
      const companyExpenses = companyExpensesResult.data
      const ticketBookings = ticketBookingsResult.data
      const tours = toursResult.data

      if (tourExpensesResult.error) console.error('투어 지출 조회 오류:', tourExpensesResult.error)
      if (reservationExpensesResult.error) console.error('예약 지출 조회 오류:', reservationExpensesResult.error)
      if (companyExpensesResult.error) console.error('회사 지출 조회 오류:', companyExpensesResult.error)
      if (ticketBookingsResult.error) console.error('입장권 부킹 조회 오류:', ticketBookingsResult.error)
      if (toursResult.error) console.error('투어 조회 오류:', toursResult.error)

      const allExpenses = [
        ...(tourExpenses || []).map(e => ({ 
          ...e, 
          type: '투어 지출',
          category: e.paid_for || '기타',
          source: 'tour_expenses'
        })),
        ...(reservationExpenses || []).map(e => ({ 
          ...e, 
          type: '예약 지출',
          category: e.paid_for || '기타',
          source: 'reservation_expenses'
        })),
        ...(companyExpenses || []).map(e => ({ 
          ...e, 
          type: '회사 지출',
          category: e.category || '기타',
          source: 'company_expenses'
        })),
        ...(ticketBookings || []).map(e => ({ 
          amount: e.expense || 0,
          type: '입장권 부킹',
          category: e.category || '입장권',
          payment_method: e.payment_method || null,
          source: 'ticket_bookings'
        })),
        ...(tours || []).map(t => ({ 
          amount: t.guide_fee || 0,
          type: '가이드 수수료',
          category: '가이드 수수료',
          payment_method: null,
          source: 'tours_guide_fee'
        })),
        ...(tours || []).map(t => ({ 
          amount: t.assistant_fee || 0,
          type: '어시스턴트 수수료',
          category: '어시스턴트 수수료',
          payment_method: null,
          source: 'tours_assistant_fee'
        }))
      ]

      // 카테고리별 집계
      const categoryMap = new Map<string, number>()
      allExpenses.forEach(e => {
        const category = e.category || '기타'
        categoryMap.set(category, (categoryMap.get(category) || 0) + (e.amount || 0))
      })

      // 유형별 집계
      const typeMap = new Map<string, number>()
      allExpenses.forEach(e => {
        typeMap.set(e.type, (typeMap.get(e.type) || 0) + (e.amount || 0))
      })

      // 결제 방법별 집계
      const methodMap = new Map<string, number>()
      allExpenses.forEach(e => {
        const method = e.payment_method || 'Unknown'
        methodMap.set(method, (methodMap.get(method) || 0) + (e.amount || 0))
      })

      const total = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

      setStats({
        total,
        byCategory: Array.from(categoryMap.entries()).map(([category, amount]) => ({
          category,
          amount,
          percentage: (amount / total) * 100
        })),
        byType: Array.from(typeMap.entries()).map(([type, amount]) => ({
          type,
          amount,
          percentage: (amount / total) * 100
        })),
        byMethod: Array.from(methodMap.entries()).map(([method, amount]) => ({
          method,
          amount,
          percentage: (amount / total) * 100
        })),
        expenses: allExpenses
      })
    } catch (error) {
      console.error('지출 통계 로드 오류:', error)
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
      <div className="bg-red-50 p-6 rounded-lg">
        <div className="flex items-center space-x-3">
          <TrendingUp className="h-8 w-8 text-red-600" />
          <div>
            <p className="text-sm text-gray-600">총 지출</p>
            <p className="text-3xl font-bold text-gray-900">${stats.total.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 카테고리별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <PieChart size={20} />
          <span>카테고리별 지출</span>
        </h3>
        <div className="space-y-3">
          {stats.byCategory
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.category}</span>
                    <span className="text-sm text-gray-500">{item.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="ml-4 text-sm font-semibold text-gray-900">
                  ${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* 유형별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">유형별 지출</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.byType.map((item: any, idx: number) => (
            <div key={idx} className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{item.type}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${item.amount.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{item.percentage.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 방법별 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 방법별 지출</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제 방법</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.byMethod
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm">{item.method}</td>
                    <td className="px-4 py-3 text-sm font-medium">${item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
