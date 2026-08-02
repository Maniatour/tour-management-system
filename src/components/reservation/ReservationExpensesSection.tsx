'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, RefreshCw } from 'lucide-react'
import { useLocale } from 'next-intl'
import { supabase, isAbortLikeError } from '@/lib/supabase'

type ExpenseRow = {
  id: string
  paid_for: string | null
  amount: number
  status: string
  note?: string | null
}

interface ReservationExpensesSectionProps {
  reservationId: string
  hideTitle?: boolean
  title?: string
  itemVariant?: 'card' | 'line'
  onTotalChange?: (total: number) => void
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-yellow-100 text-yellow-800'
  }
}

export default function ReservationExpensesSection({
  reservationId,
  hideTitle,
  title,
  itemVariant = 'card',
  onTotalChange,
}: ReservationExpensesSectionProps) {
  const locale = useLocale()
  const isKorean = locale === 'ko'
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const getStatusText = useCallback(
    (status: string) => {
      switch (status) {
        case 'approved':
          return isKorean ? '승인' : 'Approved'
        case 'rejected':
          return isKorean ? '거절' : 'Rejected'
        default:
          return isKorean ? '대기' : 'Pending'
      }
    },
    [isKorean]
  )

  const fetchExpenses = useCallback(async () => {
    if (!reservationId) {
      setExpenses([])
      onTotalChange?.(0)
      return
    }

    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('reservation_expenses')
        .select('id, paid_for, amount, status, note')
        .eq('reservation_id', reservationId)
        .not('status', 'eq', 'rejected')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const rows: ExpenseRow[] = (data ?? []).map((r) => ({
        id: String(r.id),
        paid_for: r.paid_for ?? null,
        amount: Number(r.amount) || 0,
        status: String(r.status ?? 'pending'),
        note: r.note ?? null,
      }))
      setExpenses(rows)
      onTotalChange?.(roundUsd2(rows.reduce((sum, row) => sum + row.amount, 0)))
    } catch (e) {
      if (!isAbortLikeError(e)) {
        setError(isKorean ? '예약 지출을 불러오지 못했습니다.' : 'Failed to load reservation expenses.')
        setExpenses([])
        onTotalChange?.(0)
      }
    } finally {
      setLoading(false)
    }
  }, [reservationId, isKorean, onTotalChange])

  useEffect(() => {
    void fetchExpenses()
  }, [fetchExpenses])

  const isLine = itemVariant === 'line'
  const wrapperClass = isLine ? 'space-y-2' : 'bg-white rounded-lg shadow-sm border border-gray-200 p-3'
  const showTitle = !hideTitle || title
  const titleText = title
    ? `${title} (${expenses.length})`
    : isKorean
      ? `예약 지출 (${expenses.length})`
      : `Reservation expenses (${expenses.length})`
  const total = roundUsd2(expenses.reduce((sum, row) => sum + row.amount, 0))

  if (loading) {
    return (
      <div className={wrapperClass || 'p-3'}>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          <span className="ml-2 text-xs text-gray-600">
            {isKorean ? '예약 지출 조회 중...' : 'Loading expenses...'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-2 mb-2">
        {showTitle && (
          <h3 className="text-xs font-semibold text-gray-900 flex items-center">
            <Receipt size={14} className="mr-1" />
            {titleText}
          </h3>
        )}
        <button
          type="button"
          onClick={() => void fetchExpenses()}
          disabled={loading}
          className="p-1 text-primary hover:text-primary/80 disabled:opacity-50 ml-auto"
          title={isKorean ? '예약 지출 새로고침' : 'Refresh expenses'}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-3 text-gray-500 text-xs">
          <Receipt size={20} className="mx-auto mb-1 text-gray-300" />
          <p>{isKorean ? '등록된 예약 지출이 없습니다.' : 'No reservation expenses.'}</p>
        </div>
      ) : (
        <>
          <div className={isLine ? 'divide-y divide-gray-200' : 'space-y-1.5'}>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className={isLine ? 'py-2 first:pt-0' : 'bg-gray-50 border border-gray-200 rounded p-2'}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getStatusColor(expense.status)}`}
                      >
                        {getStatusText(expense.status)}
                      </span>
                      <span className="text-xs font-medium text-gray-900 truncate">
                        {expense.paid_for?.trim() || (isKorean ? '지출' : 'Expense')}
                      </span>
                    </div>
                    {expense.note?.trim() ? (
                      <p className="text-[10px] text-gray-500 truncate">{expense.note}</p>
                    ) : null}
                  </div>
                  <span
                    className={`text-xs font-semibold tabular-nums flex-shrink-0 ${
                      expense.amount >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {expense.amount >= 0 ? '-' : '+'}${Math.abs(expense.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{isKorean ? '합계' : 'Total'}</span>
            <span className={`font-bold tabular-nums ${total >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {total >= 0 ? '-' : '+'}${Math.abs(total).toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
