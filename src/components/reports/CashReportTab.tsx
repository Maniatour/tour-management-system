'use client'

import React, { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CashReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

type CashDetailRow = {
  source: 'cash_transactions' | 'payment_records'
  occurred_at: string
  transaction_type: 'deposit' | 'withdrawal'
  amount: number
  category: string
  description: string
  payment_status?: string | null
  reservation_id?: string | null
  payment_method?: string | null
}

export default function CashReportTab({ dateRange, period }: CashReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCashStats()
  }, [dateRange, period])

  const loadCashStats = async () => {
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

      // 기준일: 2026년 1월 1일
      const baseDate = '2026-01-01'
      
      // 날짜 범위를 ISO 형식으로 변환
      const startDate = new Date(dateRange.start + 'T00:00:00')
      const endDate = new Date(dateRange.end + 'T23:59:59.999')
      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      // 기간 내 현금 거래 조회
      const { data: periodTransactions, error: periodError } = await supabase
        .from('cash_transactions')
        .select('transaction_type, amount, transaction_date, category, description')
        .gte('transaction_date', startISO)
        .lte('transaction_date', endISO)
        .order('transaction_date', { ascending: false })

      if (periodError) {
        console.error('기간 내 현금 거래 조회 오류:', periodError)
      }

      // 2026년 1월 1일부터의 모든 거래 조회 (잔액 계산용)
      const { data: allTransactions, error: allError } = await supabase
        .from('cash_transactions')
        .select('transaction_type, amount, transaction_date')
        .gte('transaction_date', baseDate + 'T00:00:00')
        .order('transaction_date', { ascending: true })

      if (allError) {
        console.error('전체 현금 거래 조회 오류:', allError)
      }

      // payment_records에서 현금 입금 조회 (PAYM032 + PAYM001)
      const { data: cashPayments, error: paymentsError } = await supabase
        .from('payment_records')
        .select('id, amount, submit_on, payment_status, reservation_id, payment_method, note')
        .in('payment_method', ['PAYM032', 'PAYM001'])
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
        .gte('submit_on', startISO)
        .lte('submit_on', endISO)

      if (paymentsError) {
        console.error('현금 입금 조회 오류:', paymentsError)
      }

      // 기간 내 통계 계산
      const periodDeposits = (periodTransactions || [])
        .filter(t => t.transaction_type === 'deposit')
        .reduce((sum, t) => sum + toNumber((t as any).amount), 0)

      const periodWithdrawals = (periodTransactions || [])
        .filter(t => t.transaction_type === 'withdrawal')
        .reduce((sum, t) => sum + toNumber((t as any).amount), 0)

      // payment_records에서의 현금 입금도 포함
      const cashPaymentsTotal = (cashPayments || [])
        .reduce((sum, p) => sum + toNumber((p as any).amount), 0)

      const totalDeposits = periodDeposits + cashPaymentsTotal
      const netCashFlow = totalDeposits - periodWithdrawals

      // 2026년 1월 1일부터의 총 잔액 계산
      const totalBalance = (allTransactions || []).reduce((balance, t) => {
        if (t.transaction_type === 'deposit') {
          return balance + toNumber((t as any).amount)
        } else {
          return balance - toNumber((t as any).amount)
        }
      }, 0)

      // payment_records에서 2026년 1월 1일부터의 현금 입금도 포함
      const { data: allCashPayments } = await supabase
        .from('payment_records')
        .select('amount')
        .in('payment_method', ['PAYM032', 'PAYM001'])
        .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
        .gte('submit_on', baseDate + 'T00:00:00')

      const allCashPaymentsTotal = (allCashPayments || [])
        .reduce((sum, p) => sum + toNumber((p as any).amount), 0)

      const finalBalance = totalBalance + allCashPaymentsTotal

      // 카테고리별 집계
      const categoryMap = new Map<string, { deposits: number; withdrawals: number }>()
      ;(periodTransactions || []).forEach(t => {
        const category = t.category || '기타'
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { deposits: 0, withdrawals: 0 })
        }
        const cat = categoryMap.get(category)!
        if (t.transaction_type === 'deposit') {
          cat.deposits += toNumber((t as any).amount)
        } else {
          cat.withdrawals += toNumber((t as any).amount)
        }
      })

      // 일별/주별/월별 추이
      const trendMap = new Map<string, { deposits: number; withdrawals: number }>()
      ;(periodTransactions || []).forEach(t => {
        const date = new Date(t.transaction_date)
        let periodKey: string

        if (period === 'daily') {
          periodKey = date.toISOString().split('T')[0]
        } else if (period === 'weekly') {
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          periodKey = weekStart.toISOString().split('T')[0]
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        } else {
          periodKey = String(date.getFullYear())
        }

        if (!trendMap.has(periodKey)) {
          trendMap.set(periodKey, { deposits: 0, withdrawals: 0 })
        }
        const trend = trendMap.get(periodKey)!
        if (t.transaction_type === 'deposit') {
          trend.deposits += toNumber((t as any).amount)
        } else {
          trend.withdrawals += toNumber((t as any).amount)
        }
      })

      const details: CashDetailRow[] = [
        ...(periodTransactions || []).map((t: any) => ({
          source: 'cash_transactions' as const,
          occurred_at: t.transaction_date,
          transaction_type: t.transaction_type,
          amount: toNumber(t.amount),
          category: t.category || '기타',
          description: t.description || '',
          payment_status: null,
          reservation_id: null,
          payment_method: null
        })),
        ...(cashPayments || []).map((p: any) => ({
          source: 'payment_records' as const,
          occurred_at: p.submit_on,
          transaction_type: 'deposit' as const,
          amount: toNumber(p.amount),
          category: '예약 현금 입금',
          description: p.note || '',
          payment_status: p.payment_status || null,
          reservation_id: p.reservation_id || null,
          payment_method: p.payment_method || null
        }))
      ].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))

      setStats({
        period: {
          deposits: totalDeposits,
          withdrawals: periodWithdrawals,
          netFlow: netCashFlow,
          cashPayments: cashPaymentsTotal,
          transactions: periodDeposits
        },
        balance: {
          total: finalBalance,
          baseDate: baseDate
        },
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          deposits: data.deposits,
          withdrawals: data.withdrawals,
          net: data.deposits - data.withdrawals
        })),
        trend: Array.from(trendMap.entries())
          .map(([period, data]) => ({
            period,
            deposits: data.deposits,
            withdrawals: data.withdrawals,
            net: data.deposits - data.withdrawals
          }))
          .sort((a, b) => a.period.localeCompare(b.period))
        ,
        details
      })
    } catch (error) {
      console.error('현금 통계 로드 오류:', error)
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
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">기간 내 입금</p>
              <p className="text-3xl font-bold text-gray-900">${stats.period.deposits.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                현금 거래: ${stats.period.transactions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">기간 내 출금</p>
              <p className="text-3xl font-bold text-gray-900">${stats.period.withdrawals.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">순 현금 흐름</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.period.netFlow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Wallet className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">현재 잔액</p>
              <p className="text-3xl font-bold text-gray-900">${stats.balance.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                ({stats.balance.baseDate} 기준)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 잔액 정보 */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">현금 잔액</h3>
            <p className="text-4xl font-bold">${stats.balance.total.toLocaleString()}</p>
            <p className="text-purple-100 text-sm mt-2">
              {stats.balance.baseDate}부터의 모든 거래 기준
            </p>
          </div>
          <Calendar className="h-16 w-16 text-purple-200" />
        </div>
        <div className="mt-4 pt-4 border-t border-purple-400 grid grid-cols-2 gap-4">
          <div>
            <p className="text-purple-100 text-sm">기간 내 입금</p>
            <p className="text-2xl font-bold">${stats.period.deposits.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">기간 내 출금</p>
            <p className="text-2xl font-bold">${stats.period.withdrawals.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 카테고리별 통계 */}
      {stats.byCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 현금 흐름</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">입금</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">출금</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.byCategory
                  .sort((a: any, b: any) => Math.abs(b.net) - Math.abs(a.net))
                  .map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm font-medium">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-green-600">
                        ${item.deposits.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        ${item.withdrawals.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        item.net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${item.net.toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 추이 그래프 */}
      {stats.trend.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">현금 흐름 추이</h3>
          <div className="space-y-4">
            {stats.trend.map((item: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{item.period}</span>
                  <span className={`text-sm font-medium ${
                    item.net >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${item.net.toLocaleString()}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                    <div
                      className="bg-green-500 h-4 rounded-full"
                      style={{ width: `${stats.period.deposits > 0 ? (item.deposits / stats.period.deposits) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                    <div
                      className="bg-red-500 h-4 rounded-full"
                      style={{ width: `${stats.period.withdrawals > 0 ? (item.withdrawals / stats.period.withdrawals) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>입금: ${item.deposits.toLocaleString()}</span>
                  <span>출금: ${item.withdrawals.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세 거래 내역 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">상세 거래 내역</h3>
        <p className="text-sm text-gray-500 mb-4">
          선택한 기간 내 현금 거래(`cash_transactions`)와 현금 입금(`payment_records`: PAYM032/PAYM001)을 함께 표시합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명/메모</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">출처</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats.details || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={8}>
                    해당 기간에 거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                (stats.details as CashDetailRow[]).map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm">
                      {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          row.transaction_type === 'deposit'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.transaction_type === 'deposit' ? '입금' : '출금'}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium ${
                        row.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      ${Number(row.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">{row.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.payment_status || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.reservation_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
