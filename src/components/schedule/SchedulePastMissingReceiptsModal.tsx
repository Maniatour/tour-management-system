'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Receipt, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchSchedulePastTourFollowUp,
  markTourReceiptNotRequired,
  type SchedulePastFollowUpTour,
} from '@/lib/schedulePastTourFollowUp'

export type SchedulePastMissingReceiptsModalProps = {
  isOpen: boolean
  onClose: () => void
  locale: string
  actorEmail?: string | null
  onOpenTour: (tourId: string, title: string) => void
  onCountsChange?: (count: number) => void
}

export default function SchedulePastMissingReceiptsModal({
  isOpen,
  onClose,
  locale,
  actorEmail,
  onOpenTour,
  onCountsChange,
}: SchedulePastMissingReceiptsModalProps) {
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SchedulePastFollowUpTour[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const onCountsChangeRef = useRef(onCountsChange)
  onCountsChangeRef.current = onCountsChange

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedulePastTourFollowUp(supabase)
      setRows(data.missingReceipts)
      onCountsChangeRef.current?.(data.missingReceipts.length)
    } catch (err) {
      console.error('SchedulePastMissingReceiptsModal load', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  const handleMarkNoReceipt = async (tour: SchedulePastFollowUpTour) => {
    const confirmMsg = isKo
      ? `${tour.tour_date || ''} ${tour.product_name || ''} — 영수증이 필요 없는 투어로 저장할까요? 이 목록에서 사라집니다.`
      : `${tour.tour_date || ''} ${tour.product_name || ''} — Mark this tour as not requiring a receipt? It will leave this list.`
    if (!window.confirm(confirmMsg)) return
    setSavingId(tour.id)
    try {
      const { error } = await markTourReceiptNotRequired(supabase, tour.id, actorEmail ?? null)
      if (error) {
        alert(isKo ? `저장 실패: ${error}` : `Save failed: ${error}`)
        return
      }
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== tour.id)
        onCountsChangeRef.current?.(next.length)
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-800 shrink-0">
              <Receipt className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {isKo ? '영수증 미첨부 투어' : 'Tours missing receipts'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isKo
                  ? '오늘 이전 투어 중 영수증 이미지가 없는 목록입니다. 야경·불의계곡처럼 영수증이 없으면 ‘영수증 없음’으로 저장하세요.'
                  : 'Past tours (before today) without a receipt image. Mark night / Valley of Fire tours as “No receipt” to hide them.'}
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
              {isKo ? '영수증이 없는 지난 투어가 없습니다.' : 'No past tours are missing receipts.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                  <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                  <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                  <th className="py-2 pr-2 w-40">{isKo ? '작업' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const title = `${t.tour_date || ''} ${t.product_name || t.product_id || ''}`.trim()
                  const busy = savingId === t.id
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                      <td className="py-2 pr-2 truncate max-w-[220px]" title={t.product_name || t.product_id || ''}>
                        {t.product_name || t.product_id || '—'}
                      </td>
                      <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                      <td className="py-2 pr-2">{(t.tour_status || '—').toString()}</td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenTour(t.id, title || (isKo ? '투어 상세' : 'Tour detail'))}
                            className="text-xs font-medium text-primary hover:text-primary/80"
                          >
                            {isKo ? '상세' : 'Open'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleMarkNoReceipt(t)}
                            className="px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-900 text-[11px] font-medium hover:bg-rose-100 disabled:opacity-50"
                          >
                            {busy ? '…' : isKo ? '영수증 없음' : 'No receipt'}
                          </button>
                        </div>
                      </td>
                    </tr>
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
