'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

export type TicketBookingPaymentCompletePayload = {
  ea: number
  expense: number
  paid_amount: number
  /** 비어 있으면 RPC에서 기존 payment_method 유지 */
  payment_method?: string
}

export type TicketBookingPaymentCompleteModalProps = {
  open: boolean
  initialEa: number
  initialExpense: number
  /** 부킹에 이미 있는 결제 방법(method 문자열) */
  initialPaymentMethod?: string
  onClose: () => void
  onSubmit: (payload: TicketBookingPaymentCompletePayload) => void | Promise<void>
  saving?: boolean
}

export default function TicketBookingPaymentCompleteModal({
  open,
  initialEa,
  initialExpense,
  initialPaymentMethod = '',
  onClose,
  onSubmit,
  saving,
}: TicketBookingPaymentCompleteModalProps) {
  const [ea, setEa] = useState(String(initialEa))
  const [expense, setExpense] = useState(String(initialExpense))
  const [paidAmount, setPaidAmount] = useState(String(initialExpense))
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod)
  const [paymentMethodManual, setPaymentMethodManual] = useState('')
  const [paymentMethodsList, setPaymentMethodsList] = useState<
    Array<{ id: string; method: string; display_name: string }>
  >([])
  const [methodsLoading, setMethodsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadPaymentMethods = useCallback(async () => {
    setMethodsLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('payment_methods')
        .select('id, method, display_name, card_holder_name, user_email')
        .eq('status', 'active')
        .order('display_name')
      if (error) throw error
      const rows = data || []
      const emails = [
        ...new Set(rows.map((r: any) => String(r.user_email || '').toLowerCase()).filter(Boolean)),
      ]
      let teamMap = new Map<
        string,
        { nick_name?: string | null; name_en?: string | null; name_ko?: string | null }
      >()
      if (emails.length > 0) {
        const { data: teams } = await (supabase as any)
          .from('team')
          .select('email, nick_name, name_en, name_ko')
          .in('email', emails)
        teamMap = new Map((teams || []).map((t: any) => [String(t.email).toLowerCase(), t]))
      }
      setPaymentMethodsList(
        rows.map((r: any) => {
          const em = r.user_email ? String(r.user_email).toLowerCase() : ''
          const team = em ? teamMap.get(em) : undefined
          const label = formatPaymentMethodDisplay(
            {
              id: r.id,
              method: r.method,
              display_name: r.display_name,
              user_email: r.user_email,
              card_holder_name: r.card_holder_name,
            },
            team
              ? {
                  nick_name: team.nick_name ?? null,
                  name_en: team.name_en ?? null,
                  name_ko: team.name_ko ?? null,
                }
              : undefined
          )
          return {
            id: r.id,
            method: r.method,
            display_name: label,
          }
        })
      )
    } catch (e) {
      console.error('결제 방법 목록 조회 오류:', e)
      setPaymentMethodsList([])
    } finally {
      setMethodsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setEa(String(initialEa))
    setExpense(String(initialExpense))
    setPaidAmount(String(initialExpense))
    setPaymentMethod(String(initialPaymentMethod ?? '').trim())
    setPaymentMethodManual('')
    setFormError(null)
    void loadPaymentMethods()
  }, [open, initialEa, initialExpense, initialPaymentMethod, loadPaymentMethods])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const eaN = parseInt(ea, 10)
    const expN = parseFloat(expense)
    const paidN = parseFloat(paidAmount)
    if (Number.isNaN(eaN) || eaN < 0) return
    if (Number.isNaN(expN) || Number.isNaN(paidN)) return

    const fromSelect = paymentMethod.trim()
    const fromManual = paymentMethodManual.trim()
    const resolvedPm = fromSelect || fromManual

    if (paymentMethodsList.length > 0 && !fromSelect) {
      setFormError('결제 방법을 선택해 주세요.')
      return
    }
    if (paymentMethodsList.length === 0 && !resolvedPm) {
      setFormError('결제 방법을 입력하거나 등록된 결제 수단을 사용해 주세요.')
      return
    }

    const payload: TicketBookingPaymentCompletePayload = {
      ea: eaN,
      expense: expN,
      paid_amount: paidN,
    }
    if (resolvedPm) payload.payment_method = resolvedPm

    await onSubmit(payload)
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">결제 완료 처리</h3>
        <p className="mt-1 text-xs text-gray-500">수량·비용·결제 방법을 확인한 뒤 결제 완료로 표시합니다.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">결제 방법</label>
            {methodsLoading ? (
              <p className="mt-1 text-xs text-gray-500">결제 수단 불러오는 중…</p>
            ) : paymentMethodsList.length > 0 ? (
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={paymentMethod}
                onChange={(ev) => setPaymentMethod(ev.target.value)}
                disabled={!!saving}
                required
              >
                <option value="">선택</option>
                {initialPaymentMethod.trim() &&
                !paymentMethodsList.some((pm) => pm.method === initialPaymentMethod.trim()) ? (
                  <option value={initialPaymentMethod.trim()}>
                    {initialPaymentMethod.trim()} (부킹에 저장된 값)
                  </option>
                ) : null}
                {paymentMethodsList.map((pm) => (
                  <option key={pm.id} value={pm.method}>
                    {pm.display_name || pm.method}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1 space-y-1">
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={paymentMethodManual}
                  onChange={(ev) => setPaymentMethodManual(ev.target.value)}
                  disabled={!!saving}
                  placeholder="결제 방법 이름 (예: Zelle, 카드)"
                  autoComplete="off"
                />
                <p className="text-[11px] text-amber-800">
                  등록된 결제 수단이 없습니다. 직접 입력하거나 관리 화면에서 결제 수단을 등록하세요.
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">수량</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={ea}
              onChange={(e) => setEa(e.target.value)}
              disabled={!!saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">비용 (USD)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              disabled={!!saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">결제 금액 (USD)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              disabled={!!saving}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={!!saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={!!saving || methodsLoading}
            >
              {saving ? '처리 중…' : '결제 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
