'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PAYMENT_METHOD_REF_TABLES } from '@/lib/paymentMethodRefTables'

const TABLE_LABELS: Record<string, string> = {
  payment_records: '결제 기록',
  company_expenses: '회사 지출',
  reservation_expenses: '예약 지출',
  tour_expenses: '투어 지출',
  ticket_bookings: '티켓 부킹',
  tour_hotel_bookings: '투어 호텔 부킹',
}

const PAYMENT_STATUS_OPTIONS = [
  'Partner Received',
  'Deposit Requested',
  'Deposit Received',
  'Balance Received',
  'Refunded',
  "Customer's CC Charged",
  'Deleted',
  'Refund Requested',
  'Returned',
  'Balance Requested',
  'Commission Received !',
] as const

type RefTable = (typeof PAYMENT_METHOD_REF_TABLES)[number]

export type PaymentMethodOptionLite = { id: string; method: string }

type ReferenceGroup = {
  table: string
  count: number
  capped: boolean
  error: string | null
  rows: Record<string, unknown>[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  methodId: string
  methodLabel: string
  paymentMethodOptions: PaymentMethodOptionLite[]
  onSaved?: () => void
}

function formatMoney(n: unknown): string {
  if (n == null || n === '') return '—'
  const v = typeof n === 'number' ? n : parseFloat(String(n))
  if (Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(v)
}

function formatDate(d: unknown): string {
  if (d == null || d === '') return '—'
  const s = String(d)
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s.slice(0, 16)
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(t))
}

function rowSummary(table: string, row: Record<string, unknown>): string {
  switch (table) {
    case 'company_expenses':
      return `${row.paid_to ?? ''} · ${row.paid_for ?? ''}`.trim() || '—'
    case 'reservation_expenses':
      return `${row.paid_to ?? ''} · ${row.paid_for ?? ''}`.trim() || '—'
    case 'tour_expenses':
      return `${row.paid_to ?? ''} · ${row.paid_for ?? ''}`.trim() || '—'
    case 'payment_records':
      return `${row.payment_status ?? ''} · 예약 ${row.reservation_id ?? '—'}`
    case 'ticket_bookings':
      return `${row.category ?? ''} / ${row.company ?? ''}`.trim() || '—'
    case 'tour_hotel_bookings':
      return `${row.hotel ?? ''} · ${row.reservation_name ?? ''}`.trim() || '—'
    default:
      return String(row.id ?? '')
  }
}

function rowAmount(table: string, row: Record<string, unknown>): unknown {
  switch (table) {
    case 'ticket_bookings':
      return row.expense
    case 'tour_hotel_bookings':
      return row.total_price
    default:
      return row.amount
  }
}

function rowDate(table: string, row: Record<string, unknown>): unknown {
  return row.submit_on ?? row.event_date ?? row.check_in_date ?? row.created_at
}

export default function PaymentMethodUsageModal({
  open,
  onOpenChange,
  locale,
  methodId,
  methodLabel,
  paymentMethodOptions,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ReferenceGroup[]>([])
  const [total, setTotal] = useState(0)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!methodId) return
    setLoading(true)
    setLoadError(null)
    setExpanded(null)
    setDraft({})
    try {
      const res = await fetch(`/api/admin/payment-methods/${encodeURIComponent(methodId)}/references`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || '내역을 불러오지 못했습니다.')
      }
      setGroups((json.groups || []) as ReferenceGroup[])
      setTotal(typeof json.total === 'number' ? json.total : 0)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.')
      setGroups([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [methodId])

  useEffect(() => {
    if (open && methodId) void load()
  }, [open, methodId, load])

  const beginEdit = (table: string, row: Record<string, unknown>) => {
    const id = String(row.id ?? '')
    const key = `${table}:${id}`
    setSaveError(null)
    setExpanded(key)
    const d: Record<string, string> = {}
    const set = (k: string, v: unknown) => {
      d[k] = v == null ? '' : String(v)
    }

    switch (table) {
      case 'company_expenses':
        set('paid_to', row.paid_to)
        set('paid_for', row.paid_for)
        set('description', row.description)
        set('amount', row.amount)
        set('payment_method', row.payment_method)
        set('notes', row.notes)
        set('submit_by', row.submit_by)
        set('submit_on', row.submit_on ? String(row.submit_on).slice(0, 16) : '')
        break
      case 'reservation_expenses':
        set('paid_to', row.paid_to)
        set('paid_for', row.paid_for)
        set('amount', row.amount)
        set('payment_method', row.payment_method)
        set('note', row.note)
        set('reservation_id', row.reservation_id)
        set('status', row.status)
        break
      case 'tour_expenses':
        set('paid_to', row.paid_to)
        set('paid_for', row.paid_for)
        set('amount', row.amount)
        set('payment_method', row.payment_method)
        set('note', row.note)
        set('status', row.status)
        break
      case 'payment_records':
        set('amount', row.amount)
        set('payment_method', row.payment_method)
        set('payment_status', row.payment_status)
        set('note', row.note)
        set('amount_krw', row.amount_krw)
        break
      case 'ticket_bookings':
        set('payment_method', row.payment_method)
        set('expense', row.expense)
        set('income', row.income)
        set('note', row.note)
        set('company', row.company)
        set('category', row.category)
        set('status', row.status)
        break
      case 'tour_hotel_bookings':
        set('payment_method', row.payment_method)
        set('total_price', row.total_price)
        set('unit_price', row.unit_price)
        set('note', row.note)
        set('hotel', row.hotel)
        set('reservation_name', row.reservation_name)
        set('status', row.status)
        break
      default:
        break
    }
    setDraft(d)
  }

  const save = async (table: RefTable, rowId: string) => {
    setSaveError(null)
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {}
      if (table === 'company_expenses') {
        patch.paid_to = draft.paid_to
        patch.paid_for = draft.paid_for
        patch.description = draft.description || null
        patch.amount = draft.amount
        patch.payment_method = draft.payment_method
        patch.notes = draft.notes || null
        patch.submit_by = draft.submit_by
        if (draft.submit_on) patch.submit_on = new Date(draft.submit_on).toISOString()
      } else if (table === 'reservation_expenses') {
        patch.paid_to = draft.paid_to
        patch.paid_for = draft.paid_for
        patch.amount = draft.amount
        patch.payment_method = draft.payment_method
        patch.note = draft.note || null
        patch.reservation_id = draft.reservation_id || null
        patch.status = draft.status || null
      } else if (table === 'tour_expenses') {
        patch.paid_to = draft.paid_to
        patch.paid_for = draft.paid_for
        patch.amount = draft.amount
        patch.payment_method = draft.payment_method
        patch.note = draft.note || null
        patch.status = draft.status || null
      } else if (table === 'payment_records') {
        patch.amount = draft.amount
        patch.payment_method = draft.payment_method
        patch.payment_status = draft.payment_status
        patch.note = draft.note || null
        patch.amount_krw = draft.amount_krw ? draft.amount_krw : null
      } else if (table === 'ticket_bookings') {
        patch.payment_method = draft.payment_method
        patch.expense = draft.expense
        patch.income = draft.income
        patch.note = draft.note || null
        patch.company = draft.company
        patch.category = draft.category
        patch.status = draft.status || null
      } else if (table === 'tour_hotel_bookings') {
        patch.payment_method = draft.payment_method
        patch.total_price = draft.total_price
        patch.unit_price = draft.unit_price
        patch.note = draft.note || null
        patch.hotel = draft.hotel
        patch.reservation_name = draft.reservation_name
        patch.status = draft.status || null
      }

      const res = await fetch('/api/admin/payment-method-references', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id: rowId, patch }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || '저장에 실패했습니다.')
      }
      setExpanded(null)
      await load()
      onSaved?.()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const reservationHref = (row: Record<string, unknown>) => {
    const cid = row.customer_id
    const rid = row.reservation_id
    if (!cid || !rid) return null
    return `/${locale}/dashboard/reservations/${cid}/${rid}`
  }

  const tourHref = (tourId: unknown) => {
    if (!tourId || !String(tourId).trim()) return null
    return `/${locale}/admin/tours/${String(tourId).trim()}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>결제 방법 사용 내역</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-gray-600 space-y-1">
              <div>
                <span className="font-medium text-gray-900">{methodLabel}</span>{' '}
                <span className="font-mono text-xs text-gray-500">({methodId})</span>
              </div>
              <div>이 결제 방법 ID를 참조하는 모든 행입니다. 행을 펼쳐 수정한 뒤 저장할 수 있습니다.</div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-gray-600 py-6">불러오는 중…</p>}
        {loadError && (
          <div className="text-sm text-red-600 py-2 border border-red-100 bg-red-50 rounded-md px-3">
            {loadError}
          </div>
        )}
        {!loading && !loadError && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              총 <strong>{total}</strong>건
            </p>

            {groups.map((g) => {
              if (g.error && g.count === 0) {
                return (
                  <div key={g.table} className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md p-2">
                    {TABLE_LABELS[g.table] || g.table}: 조회 오류 — {g.error}
                  </div>
                )
              }
              if (g.count === 0) return null

              return (
                <div key={g.table} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 border-b border-gray-200 flex justify-between gap-2">
                    <span>{TABLE_LABELS[g.table] || g.table}</span>
                    <span className="text-gray-500 font-normal">
                      {g.count}건{g.capped ? ' (상한 도달, 일부만 표시)' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {g.rows.map((row) => {
                      const id = String(row.id ?? '')
                      const key = `${g.table}:${id}`
                      const isOpen = expanded === key
                      const hrefRes = reservationHref(row)
                      const hrefTour = tourHref(row.tour_id)

                      return (
                        <div key={key} className="bg-white">
                          <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-gray-900 line-clamp-2">{rowSummary(g.table, row)}</div>
                              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>금액 {formatMoney(rowAmount(g.table, row))}</span>
                                <span>{formatDate(rowDate(g.table, row))}</span>
                                <span className="font-mono truncate max-w-[14rem]" title={id}>
                                  id {id}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {hrefRes && (
                                <Link
                                  href={hrefRes}
                                  className="text-xs text-blue-600 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  예약 화면
                                </Link>
                              )}
                              {hrefTour && (
                                <Link
                                  href={hrefTour}
                                  className="text-xs text-blue-600 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  투어 화면
                                </Link>
                              )}
                              {g.table === 'company_expenses' && (
                                <Link
                                  href={`/${locale}/admin/company-expenses`}
                                  className="text-xs text-blue-600 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  회사 지출
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => (isOpen ? setExpanded(null) : beginEdit(g.table, row))}
                                className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                              >
                                {isOpen ? '접기' : '수정'}
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="px-3 pb-3 pt-0 border-t border-gray-100 bg-gray-50/50 space-y-2">
                              {saveError && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                                  {saveError}
                                </div>
                              )}

                              {g.table === 'company_expenses' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">지급 대상 (paid_to)</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_to ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_to: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">내용 (paid_for)</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_for ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_for: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">설명</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.description ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">금액</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.amount ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">제출자 이메일 (submit_by)</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.submit_by ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, submit_by: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">제출일시 (로컬 입력)</span>
                                    <input
                                      type="datetime-local"
                                      className="border rounded px-2 py-1"
                                      value={draft.submit_on ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, submit_on: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 방법</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_method ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_method: e.target.value }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {paymentMethodOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.method} ({o.id})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">메모</span>
                                    <textarea
                                      className="border rounded px-2 py-1 min-h-[4rem]"
                                      value={draft.notes ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                                    />
                                  </label>
                                </div>
                              )}

                              {g.table === 'reservation_expenses' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">예약 ID</span>
                                    <input
                                      className="border rounded px-2 py-1 font-mono text-xs"
                                      value={draft.reservation_id ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, reservation_id: e.target.value }))
                                      }
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">상태</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.status ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">지급 대상</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_to ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_to: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">내용</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_for ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_for: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">금액</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.amount ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 방법</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_method ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_method: e.target.value }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {paymentMethodOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.method} ({o.id})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">메모</span>
                                    <textarea
                                      className="border rounded px-2 py-1 min-h-[4rem]"
                                      value={draft.note ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                                    />
                                  </label>
                                </div>
                              )}

                              {g.table === 'tour_expenses' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">상태</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.status ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">지급 대상</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_to ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_to: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">내용</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.paid_for ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, paid_for: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">금액</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.amount ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 방법</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_method ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_method: e.target.value }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {paymentMethodOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.method} ({o.id})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">메모</span>
                                    <textarea
                                      className="border rounded px-2 py-1 min-h-[4rem]"
                                      value={draft.note ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                                    />
                                  </label>
                                </div>
                              )}

                              {g.table === 'payment_records' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">금액</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.amount ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">원화 금액 (선택)</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.amount_krw ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, amount_krw: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 상태</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_status ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_status: e.target.value }))
                                      }
                                    >
                                      {PAYMENT_STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 방법 (등록된 ID 권장)</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_method ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_method: e.target.value }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {paymentMethodOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.method} ({o.id})
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-[11px] text-gray-500">
                                      목록에 없으면 결제 방법 관리에서 ID를 확인한 뒤 직접 DB를 조정해 주세요.
                                    </span>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">메모</span>
                                    <textarea
                                      className="border rounded px-2 py-1 min-h-[4rem]"
                                      value={draft.note ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                                    />
                                  </label>
                                </div>
                              )}

                              {(g.table === 'ticket_bookings' || g.table === 'tour_hotel_bookings') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  {g.table === 'ticket_bookings' && (
                                    <>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">분류</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.category ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, category: e.target.value }))
                                          }
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">업체</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.company ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, company: e.target.value }))
                                          }
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">비용 (expense)</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.expense ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, expense: e.target.value }))
                                          }
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">수입 (income)</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.income ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, income: e.target.value }))
                                          }
                                        />
                                      </label>
                                    </>
                                  )}
                                  {g.table === 'tour_hotel_bookings' && (
                                    <>
                                      <label className="flex flex-col gap-0.5 sm:col-span-2">
                                        <span className="text-gray-600">호텔</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.hotel ?? ''}
                                          onChange={(e) => setDraft((d) => ({ ...d, hotel: e.target.value }))}
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5 sm:col-span-2">
                                        <span className="text-gray-600">예약명</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.reservation_name ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, reservation_name: e.target.value }))
                                          }
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">총액</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.total_price ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, total_price: e.target.value }))
                                          }
                                        />
                                      </label>
                                      <label className="flex flex-col gap-0.5">
                                        <span className="text-gray-600">단가</span>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={draft.unit_price ?? ''}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, unit_price: e.target.value }))
                                          }
                                        />
                                      </label>
                                    </>
                                  )}
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-gray-600">상태</span>
                                    <input
                                      className="border rounded px-2 py-1"
                                      value={draft.status ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">결제 방법</span>
                                    <select
                                      className="border rounded px-2 py-1"
                                      value={draft.payment_method ?? ''}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, payment_method: e.target.value }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {paymentMethodOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.method} ({o.id})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                                    <span className="text-gray-600">메모</span>
                                    <textarea
                                      className="border rounded px-2 py-1 min-h-[4rem]"
                                      value={draft.note ?? ''}
                                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                                    />
                                  </label>
                                </div>
                              )}

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white"
                                  onClick={() => setExpanded(null)}
                                  disabled={saving}
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  className="text-xs px-3 py-1.5 rounded bg-gray-900 text-white disabled:opacity-50"
                                  disabled={saving}
                                  onClick={() => save(g.table as RefTable, id)}
                                >
                                  {saving ? '저장 중…' : '저장'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {total === 0 && (
              <p className="text-sm text-gray-500 py-4">이 결제 방법 ID를 참조하는 행이 없습니다.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
