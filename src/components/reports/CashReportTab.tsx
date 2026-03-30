'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, Calendar, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getDefaultLedgerBaseDate, getFiscalReportingSettings } from '@/lib/fiscal-settings'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import CashLedgerReportEditModals, { type CashLedgerEditTarget } from '@/components/reports/CashLedgerReportEditModals'

interface CashReportTabProps {
  dateRange: { start: string; end: string }
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
}

type CashDetailRow = {
  source: 'cash_transactions' | 'payment_records' | 'company_expenses' | 'reservation_expenses'
  rowId: string
  occurred_at: string
  transaction_type: 'deposit' | 'withdrawal'
  amount: number
  category: string
  description: string
  payment_status?: string | null
  reservation_id?: string | null
  payment_method?: string | null
  balance: number
}

export default function CashReportTab({ dateRange, period }: CashReportTabProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<CashLedgerEditTarget | null>(null)
  const [addCashOpen, setAddCashOpen] = useState(false)
  const [ledgerBaseDate, setLedgerBaseDate] = useState<string>(getDefaultLedgerBaseDate())

  const dismissEdit = useCallback(() => setEditTarget(null), [])

  useEffect(() => {
    getFiscalReportingSettings().then((s) => setLedgerBaseDate(s.ledgerBaseDate))
  }, [])

  const loadCashStats = useCallback(async (options?: { soft?: boolean }) => {
    if (!options?.soft) setLoading(true)
    try {
      const toNumber = (v: unknown) => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') {
          const n = parseFloat(v)
          return Number.isFinite(n) ? n : 0
        }
        return 0
      }

      const baseDate = ledgerBaseDate
      
      // 날짜 유효성 검사
      if (!dateRange.start || !dateRange.end) {
        setLoading(false)
        return
      }

      // 날짜 범위를 ISO 형식으로 변환
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

      // 모든 쿼리를 병렬로 실행
      const [
        periodTransactionsResult,
        allTransactionsResult,
        cashPaymentsResult,
        allCashPaymentsResult,
        periodCompanyExpensesResult,
        allCompanyExpensesResult,
        periodReservationExpensesResult,
        allReservationExpensesResult
      ] = await Promise.all([
        // 기간 내 현금 거래 조회
        supabase
          .from('cash_transactions')
          .select('id, transaction_type, amount, transaction_date, category, description')
          .gte('transaction_date', startISO)
          .lte('transaction_date', endISO)
          .order('transaction_date', { ascending: false }),
        // 원장 기준일부터의 모든 거래 조회 (잔액 계산용)
        supabase
          .from('cash_transactions')
          .select('id, transaction_type, amount, transaction_date')
          .gte('transaction_date', baseDate + 'T00:00:00')
          .order('transaction_date', { ascending: true }),
        // payment_records에서 현금 입금 조회 (PAYM032 + PAYM001)
        supabase
          .from('payment_records')
          .select('id, amount, submit_on, payment_status, reservation_id, payment_method, note')
          .in('payment_method', ['PAYM032', 'PAYM001'])
          .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        // 원장 기준일부터의 현금 입금 (잔액 계산용)
        supabase
          .from('payment_records')
          .select('id, amount, submit_on')
          .in('payment_method', ['PAYM032', 'PAYM001'])
          .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])
          .gte('submit_on', baseDate + 'T00:00:00')
          .order('submit_on', { ascending: true }),
        // 기간 내 company_expenses 현금 지출 (Cash, cash 모두 포함)
        supabase
          .from('company_expenses')
          .select('id, amount, submit_on, description, notes, paid_for, paid_to')
          .in('payment_method', ['Cash', 'cash'])
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
          .order('submit_on', { ascending: false }),
        // 원장 기준일부터 company_expenses 현금 지출 (잔액 계산용)
        supabase
          .from('company_expenses')
          .select('id, amount, submit_on')
          .in('payment_method', ['Cash', 'cash'])
          .gte('submit_on', baseDate + 'T00:00:00')
          .order('submit_on', { ascending: true }),
        // 기간 내 reservation_expenses 현금 지출
        supabase
          .from('reservation_expenses')
          .select('id, amount, submit_on, note, paid_for, paid_to, reservation_id')
          .ilike('payment_method', 'Cash')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
          .order('submit_on', { ascending: false }),
        // 원장 기준일부터 reservation_expenses 현금 지출 (잔액 계산용)
        supabase
          .from('reservation_expenses')
          .select('id, amount, submit_on')
          .ilike('payment_method', 'Cash')
          .gte('submit_on', baseDate + 'T00:00:00')
          .order('submit_on', { ascending: true })
      ])

      const periodTransactions = periodTransactionsResult.data
      const allTransactions = allTransactionsResult.data
      const cashPayments = cashPaymentsResult.data
      const allCashPayments = allCashPaymentsResult.data
      const periodCompanyExpenses = periodCompanyExpensesResult.data
      const allCompanyExpenses = allCompanyExpensesResult.data
      const periodReservationExpenses = periodReservationExpensesResult.data
      const allReservationExpenses = allReservationExpensesResult.data

      if (periodTransactionsResult.error) console.error('기간 내 현금 거래 조회 오류:', periodTransactionsResult.error)
      if (allTransactionsResult.error) console.error('전체 현금 거래 조회 오류:', allTransactionsResult.error)
      if (cashPaymentsResult.error) console.error('현금 입금 조회 오류:', cashPaymentsResult.error)
      if (periodCompanyExpensesResult.error) console.error('기간 내 회사 지출(현금) 조회 오류:', periodCompanyExpensesResult.error)
      if (periodReservationExpensesResult.error) console.error('기간 내 예약 지출(현금) 조회 오류:', periodReservationExpensesResult.error)

      // 기간 내 통계 계산
      const periodDeposits = (periodTransactions || [])
        .filter(t => t.transaction_type === 'deposit')
        .reduce((sum, t) => sum + toNumber((t as any).amount), 0)

      const periodWithdrawalsFromCash = (periodTransactions || [])
        .filter(t => t.transaction_type === 'withdrawal')
        .reduce((sum, t) => sum + toNumber((t as any).amount), 0)
      const periodCompanyWithdrawals = (periodCompanyExpenses || []).reduce((sum, p) => sum + toNumber((p as any).amount), 0)
      const periodReservationWithdrawals = (periodReservationExpenses || []).reduce((sum, p) => sum + toNumber((p as any).amount), 0)
      const periodWithdrawals = periodWithdrawalsFromCash + periodCompanyWithdrawals + periodReservationWithdrawals

      // payment_records에서의 현금 입금도 포함
      const cashPaymentsTotal = (cashPayments || [])
        .reduce((sum, p) => sum + toNumber((p as any).amount), 0)

      const totalDeposits = periodDeposits + cashPaymentsTotal
      const netCashFlow = totalDeposits - periodWithdrawals

      // 원장 기준일부터의 총 잔액 계산
      const totalBalance = (allTransactions || []).reduce((balance, t) => {
        if (t.transaction_type === 'deposit') {
          return balance + toNumber((t as any).amount)
        } else {
          return balance - toNumber((t as any).amount)
        }
      }, 0)

      // payment_records에서 원장 기준일부터의 현금 입금도 포함 (이미 병렬 쿼리로 조회됨)
      const allCashPaymentsTotal = (allCashPayments || [])
        .reduce((sum, p) => sum + toNumber((p as any).amount), 0)
      // company_expenses, reservation_expenses 현금 지출은 잔액에서 차감
      const allCompanyExpensesTotal = (allCompanyExpenses || []).reduce((sum, p) => sum + toNumber((p as any).amount), 0)
      const allReservationExpensesTotal = (allReservationExpenses || []).reduce((sum, p) => sum + toNumber((p as any).amount), 0)

      const finalBalance = totalBalance + allCashPaymentsTotal - allCompanyExpensesTotal - allReservationExpensesTotal

      const sourceOrder: Record<string, number> = {
        cash_transactions: 0,
        payment_records: 1,
        company_expenses: 2,
        reservation_expenses: 3
      }

      type LedgerLine = {
        source: CashDetailRow['source']
        sourceId: string
        occurred_at: string
        transaction_type: 'deposit' | 'withdrawal'
        amount: number
      }

      const ledgerLines: LedgerLine[] = [
        ...(allTransactions || []).map((t: any) => ({
          source: 'cash_transactions' as const,
          sourceId: String(t.id),
          occurred_at: t.transaction_date,
          transaction_type: t.transaction_type as 'deposit' | 'withdrawal',
          amount: toNumber(t.amount)
        })),
        ...(allCashPayments || []).map((p: any) => ({
          source: 'payment_records' as const,
          sourceId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'deposit' as const,
          amount: toNumber(p.amount)
        })),
        ...(allCompanyExpenses || []).map((p: any) => ({
          source: 'company_expenses' as const,
          sourceId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'withdrawal' as const,
          amount: toNumber(p.amount)
        })),
        ...(allReservationExpenses || []).map((p: any) => ({
          source: 'reservation_expenses' as const,
          sourceId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'withdrawal' as const,
          amount: toNumber(p.amount)
        }))
      ]

      ledgerLines.sort((a, b) => {
        const cmp = String(a.occurred_at).localeCompare(String(b.occurred_at))
        if (cmp !== 0) return cmp
        const oa = sourceOrder[a.source] ?? 99
        const ob = sourceOrder[b.source] ?? 99
        if (oa !== ob) return oa - ob
        return a.sourceId.localeCompare(b.sourceId)
      })

      const balanceAfterByKey = new Map<string, number>()
      let runningLedger = 0
      for (const line of ledgerLines) {
        if (line.transaction_type === 'deposit') runningLedger += line.amount
        else runningLedger -= line.amount
        balanceAfterByKey.set(`${line.source}:${line.sourceId}`, runningLedger)
      }

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
      ;(periodCompanyExpenses || []).forEach((p: any) => {
        const category = p.paid_for || '회사 지출'
        if (!categoryMap.has(category)) categoryMap.set(category, { deposits: 0, withdrawals: 0 })
        categoryMap.get(category)!.withdrawals += toNumber(p.amount)
      })
      ;(periodReservationExpenses || []).forEach((p: any) => {
        const category = p.paid_for || '예약 지출'
        if (!categoryMap.has(category)) categoryMap.set(category, { deposits: 0, withdrawals: 0 })
        categoryMap.get(category)!.withdrawals += toNumber(p.amount)
      })

      const details: CashDetailRow[] = [
        ...(periodTransactions || []).map((t: any) => ({
          source: 'cash_transactions' as const,
          rowId: String(t.id),
          occurred_at: t.transaction_date,
          transaction_type: t.transaction_type,
          amount: toNumber(t.amount),
          category: t.category || '기타',
          description: t.description || '',
          payment_status: null,
          reservation_id: null,
          payment_method: null,
          balance: balanceAfterByKey.get(`cash_transactions:${t.id}`) ?? Number.NaN
        })),
        ...(cashPayments || []).map((p: any) => ({
          source: 'payment_records' as const,
          rowId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'deposit' as const,
          amount: toNumber(p.amount),
          category: '예약 현금 입금',
          description: p.note || '',
          payment_status: p.payment_status || null,
          reservation_id: p.reservation_id || null,
          payment_method: p.payment_method || null,
          balance: balanceAfterByKey.get(`payment_records:${p.id}`) ?? Number.NaN
        })),
        ...(periodCompanyExpenses || []).map((p: any) => ({
          source: 'company_expenses' as const,
          rowId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'withdrawal' as const,
          amount: toNumber(p.amount),
          category: p.paid_for || '회사 지출',
          description: [p.paid_to, p.description].filter(Boolean).join(' - ') || '',
          payment_status: null,
          reservation_id: null,
          payment_method: null,
          balance: balanceAfterByKey.get(`company_expenses:${p.id}`) ?? Number.NaN
        })),
        ...(periodReservationExpenses || []).map((p: any) => ({
          source: 'reservation_expenses' as const,
          rowId: String(p.id),
          occurred_at: p.submit_on,
          transaction_type: 'withdrawal' as const,
          amount: toNumber(p.amount),
          category: p.paid_for || '예약 지출',
          description: p.note || `${p.paid_to || ''} - ${p.paid_for || ''}`.trim() || '',
          payment_status: null,
          reservation_id: p.reservation_id || null,
          payment_method: null,
          balance: balanceAfterByKey.get(`reservation_expenses:${p.id}`) ?? Number.NaN
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
        details
      })
    } catch (error) {
      console.error('현금 통계 로드 오류:', error)
    } finally {
      if (!options?.soft) setLoading(false)
    }
  }, [dateRange, period, ledgerBaseDate])

  useEffect(() => {
    loadCashStats()
  }, [loadCashStats])

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
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-green-50 p-4 sm:p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">기간 내 입금</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">${stats.period.deposits.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                현금 거래: ${stats.period.transactions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-4 sm:p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">
                기간 내 <AccountingTerm termKey="출금">출금</AccountingTerm>
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">${stats.period.withdrawals.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-4 sm:p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">순 현금 흐름</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">
                ${stats.period.netFlow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-4 sm:p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <Wallet className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">현재 잔액</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">${stats.balance.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                ({stats.balance.baseDate} 기준)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 잔액 정보 */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 sm:p-6 rounded-lg text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold mb-2 flex flex-wrap items-center gap-x-1">
              <AccountingTerm termKey="현금관리">현금</AccountingTerm> <AccountingTerm termKey="잔액">잔액</AccountingTerm>
            </h3>
            <p className="text-3xl sm:text-4xl font-bold break-all">${stats.balance.total.toLocaleString()}</p>
            <p className="text-purple-100 text-xs sm:text-sm mt-2">
              {stats.balance.baseDate}부터의 모든 거래 기준
            </p>
          </div>
          <Calendar className="h-12 w-12 sm:h-16 sm:w-16 text-purple-200 shrink-0 opacity-90" aria-hidden />
        </div>
        <div className="mt-4 pt-4 border-t border-purple-400 grid grid-cols-2 gap-4">
          <div>
            <p className="text-purple-100 text-sm">
              기간 내 <AccountingTerm termKey="입금">입금</AccountingTerm>
            </p>
            <p className="text-2xl font-bold">${stats.period.deposits.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">
              기간 내 <AccountingTerm termKey="출금">출금</AccountingTerm>
            </p>
            <p className="text-2xl font-bold">${stats.period.withdrawals.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 카테고리별 통계 */}
      {stats.byCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">카테고리별 현금 흐름</h3>
          <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
            <table className="w-full min-w-[360px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <AccountingTerm termKey="입금">입금</AccountingTerm>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <AccountingTerm termKey="출금">출금</AccountingTerm>
                  </th>
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

      {/* 상세 거래 내역 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">상세 거래 내역</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 w-full sm:w-fit min-h-[44px] sm:min-h-0"
            onClick={() => {
              setEditTarget(null)
              setAddCashOpen(true)
            }}
            title="현금 거래 추가"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>현금 거래 추가</span>
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 leading-relaxed">
          선택한 기간 내 현금 거래(cash_transactions), 현금 <AccountingTerm termKey="입금">입금</AccountingTerm>(payment_records), 회사 지출(company_expenses), 예약 지출(reservation_expenses)의 현금 내역을 함께 표시합니다.{' '}
          <AccountingTerm termKey="잔액">잔액</AccountingTerm> 열은 {stats.balance.baseDate} 이후 동일{' '}
          <AccountingTerm termKey="원장">원장</AccountingTerm>을 일시·출처 순으로 합산한 누적{' '}
          <AccountingTerm termKey="잔액">잔액</AccountingTerm>(해당 거래 반영 후)입니다. 행을 클릭하면 해당 건을 수정할 수 있습니다. + 버튼으로{' '}
          <AccountingTerm termKey="현금관리">현금 관리</AccountingTerm>(cash_transactions) 거래를 바로 추가할 수 있습니다.
        </p>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
          <table className="w-full min-w-[800px] text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '11rem' }}>일시</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '4.5rem' }}>구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  <AccountingTerm termKey="잔액">잔액</AccountingTerm>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '7rem' }}>카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명/메모</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">출처</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '10rem' }}>상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats.details || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={9}>
                    해당 기간에 거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                (stats.details as CashDetailRow[]).map((row) => (
                  <tr
                    key={`${row.source}-${row.rowId}`}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    role="button"
                    tabIndex={0}
                    title="클릭하여 수정"
                    onClick={() => {
                      setAddCashOpen(false)
                      setEditTarget({ source: row.source, id: row.rowId })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setAddCashOpen(false)
                        setEditTarget({ source: row.source, id: row.rowId })
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
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
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                        row.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      ${Number(row.amount || 0).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                        Number.isFinite(row.balance)
                          ? row.balance >= 0
                            ? 'text-gray-900'
                            : 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {Number.isFinite(row.balance) ? `$${row.balance.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{row.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-0">{row.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {row.source === 'payment_records' ? '예약 결제' : row.source === 'company_expenses' ? '회사 지출' : row.source === 'reservation_expenses' ? '예약 지출' : '현금 관리'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.payment_status || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 min-w-0">{row.reservation_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CashLedgerReportEditModals
        target={editTarget}
        onDismiss={dismissEdit}
        onSaved={() => loadCashStats({ soft: true })}
        addCashOpen={addCashOpen}
        onAddCashDismiss={() => setAddCashOpen(false)}
      />
    </div>
  )
}
