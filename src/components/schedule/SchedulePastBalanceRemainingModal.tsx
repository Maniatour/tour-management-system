'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Wallet, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchSchedulePastTourBalanceDetails,
  fetchSchedulePastTourFollowUp,
  type SchedulePastBalanceReservationItem,
  type SchedulePastFollowUpTour,
} from '@/lib/schedulePastTourFollowUp'

export type SchedulePastBalanceRemainingModalProps = {
  isOpen: boolean
  onClose: () => void
  locale: string
  onOpenTour: (tourId: string, title: string) => void
  onOpenReservation?: (reservationId: string) => void
  onCountsChange?: (count: number) => void
}

function formatUsd(v: number) {
  return `$${v.toFixed(2)}`
}

export default function SchedulePastBalanceRemainingModal({
  isOpen,
  onClose,
  locale,
  onOpenTour,
  onOpenReservation,
  onCountsChange,
}: SchedulePastBalanceRemainingModalProps) {
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SchedulePastFollowUpTour[]>([])
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [detailsByTourId, setDetailsByTourId] = useState<Record<string, SchedulePastBalanceReservationItem[]>>({})
  const [detailsLoadingTourId, setDetailsLoadingTourId] = useState<string | null>(null)
  const [collectingKey, setCollectingKey] = useState<string | null>(null)
  const onCountsChangeRef = useRef(onCountsChange)
  onCountsChangeRef.current = onCountsChange

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedulePastTourFollowUp(supabase)
      setRows(data.balanceRemaining)
      onCountsChangeRef.current?.(data.balanceRemaining.length)
    } catch (err) {
      console.error('SchedulePastBalanceRemainingModal load', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  const loadDetails = useCallback(async (tourId: string) => {
    const tid = String(tourId).trim()
    if (!tid) return
    setDetailsLoadingTourId(tid)
    try {
      const details = await fetchSchedulePastTourBalanceDetails(supabase, tid)
      setDetailsByTourId((prev) => ({ ...prev, [tid]: details }))
    } finally {
      setDetailsLoadingTourId((curr) => (curr === tid ? null : curr))
    }
  }, [])

  const handleToggle = async (tourId: string) => {
    const tid = String(tourId).trim()
    if (!tid) return
    if (expandedTourId === tid) {
      setExpandedTourId(null)
      return
    }
    setExpandedTourId(tid)
    if (!detailsByTourId[tid]) await loadDetails(tid)
  }

  const handleCollect = async (tourId: string, reservationId: string) => {
    const confirmMsg = isKo ? '해당 예약의 잔액을 수령 처리할까요?' : 'Mark this reservation balance as received?'
    if (!window.confirm(confirmMsg)) return
    const key = `${tourId}:${reservationId}`
    setCollectingKey(key)
    try {
      const { error } = await supabase
        .from('reservation_pricing')
        .update({ balance_amount: 0 })
        .eq('reservation_id', reservationId)
      if (error) {
        alert(isKo ? `수령 처리 오류: ${error.message}` : error.message)
        return
      }
      await loadDetails(tourId)
      await load()
    } finally {
      setCollectingKey((curr) => (curr === key ? null : curr))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 shrink-0">
              <Wallet className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {isKo ? '잔금 남은 투어' : 'Tours with remaining balance'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isKo
                  ? '오늘 이전 투어 중 예약 잔금이 남아 있는 목록입니다. 행을 펼쳐 예약별 잔액을 확인하고 수령 처리할 수 있습니다.'
                  : 'Past tours (before today) that still have a reservation balance. Expand a row to collect.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isKo ? '잔금이 남은 지난 투어가 없습니다.' : 'No past tours have a remaining balance.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2 w-8" />
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                  <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                  <th className="py-2 pr-2 text-right">{isKo ? '잔금' : 'Balance'}</th>
                  <th className="py-2 pr-2 w-24">{isKo ? '작업' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const isOpenRow = expandedTourId === t.id
                  const detailRows = detailsByTourId[t.id] || []
                  const loadingDetail = detailsLoadingTourId === t.id
                  const title = `${t.tour_date || ''} ${t.product_name || t.product_id || ''}`.trim()
                  return (
                    <Fragment key={t.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => void handleToggle(t.id)}
                            className="w-6 h-6 inline-flex items-center justify-center rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100"
                            aria-label={isOpenRow ? 'collapse' : 'expand'}
                          >
                            {isOpenRow ? '−' : '+'}
                          </button>
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                        <td className="py-2 pr-2 truncate max-w-[220px]" title={t.product_name || t.product_id || ''}>
                          {t.product_name || t.product_id || '—'}
                        </td>
                        <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                        <td className="py-2 pr-2 text-right tabular-nums font-medium text-teal-800">
                          {formatUsd(t.balance_total)}
                        </td>
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => onOpenTour(t.id, title || (isKo ? '투어 상세' : 'Tour detail'))}
                            className="text-xs font-medium text-primary hover:text-primary/80"
                          >
                            {isKo ? '상세' : 'Open'}
                          </button>
                        </td>
                      </tr>
                      {isOpenRow ? (
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          <td colSpan={6} className="py-2 px-3">
                            {loadingDetail ? (
                              <p className="text-xs text-gray-500">{isKo ? '예약 목록 조회 중…' : 'Loading reservations…'}</p>
                            ) : detailRows.length === 0 ? (
                              <p className="text-xs text-gray-500">
                                {isKo ? '잔액이 남은 예약이 없습니다.' : 'No reservations with remaining balance.'}
                              </p>
                            ) : (
                              <table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden bg-white">
                                <thead>
                                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                    <th className="py-1.5 px-2 text-left font-medium">{isKo ? '예약' : 'Reservation'}</th>
                                    <th className="py-1.5 px-2 text-right font-medium w-28">{isKo ? '잔금' : 'Balance'}</th>
                                    <th className="py-1.5 px-2 text-left font-medium w-44">{isKo ? '작업' : 'Action'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRows.map((r) => {
                                    const busy = collectingKey === `${t.id}:${r.reservationId}`
                                    return (
                                      <tr key={r.reservationId} className="border-b border-gray-100 last:border-b-0">
                                        <td className="py-1.5 px-2">
                                          <div className="font-medium text-gray-900">{r.displayLabel || '—'}</div>
                                          <div className="text-[10px] text-gray-600 mt-0.5">
                                            {isKo ? `총 ${r.totalPeople}명` : `${r.totalPeople} pax`}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-right tabular-nums text-gray-900">
                                          {formatUsd(r.balanceAmount)}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <button
                                              type="button"
                                              disabled={collectingKey !== null}
                                              onClick={() => void handleCollect(t.id, r.reservationId)}
                                              className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 text-[11px] font-medium hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                              {busy ? '…' : isKo ? '수령' : 'Collect'}
                                            </button>
                                            {onOpenReservation ? (
                                              <button
                                                type="button"
                                                onClick={() => onOpenReservation(r.reservationId)}
                                                className="text-[11px] font-medium text-primary hover:text-primary/80"
                                              >
                                                {isKo ? '예약 상세' : 'Reservation detail'}
                                              </button>
                                            ) : null}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
