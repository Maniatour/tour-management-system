'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Receipt, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchSchedulePastTourFollowUp,
  markTourReceiptNotRequired,
  markTourReceiptRequired,
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

type ListTab = 'visible' | 'hidden'

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
  const [visibleRows, setVisibleRows] = useState<SchedulePastFollowUpTour[]>([])
  const [hiddenRows, setHiddenRows] = useState<SchedulePastFollowUpTour[]>([])
  const [listTab, setListTab] = useState<ListTab>('visible')
  const [savingId, setSavingId] = useState<string | null>(null)
  const onCountsChangeRef = useRef(onCountsChange)
  onCountsChangeRef.current = onCountsChange

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedulePastTourFollowUp(supabase)
      setVisibleRows(data.missingReceipts)
      setHiddenRows(data.missingReceiptsHidden)
      onCountsChangeRef.current?.(data.missingReceipts.length)
    } catch (err) {
      console.error('SchedulePastMissingReceiptsModal load', err)
      setVisibleRows([])
      setHiddenRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setListTab('visible')
    void load()
  }, [isOpen, load])

  const handleHide = async (tour: SchedulePastFollowUpTour) => {
    setSavingId(tour.id)
    try {
      const { error } = await markTourReceiptNotRequired(supabase, tour.id, actorEmail ?? null)
      if (error) {
        alert(isKo ? `저장 실패: ${error}` : `Save failed: ${error}`)
        return
      }
      setVisibleRows((prev) => {
        const next = prev.filter((r) => r.id !== tour.id)
        onCountsChangeRef.current?.(next.length)
        return next
      })
      setHiddenRows((prev) => [tour, ...prev.filter((r) => r.id !== tour.id)])
    } finally {
      setSavingId(null)
    }
  }

  const handleUnhide = async (tour: SchedulePastFollowUpTour) => {
    setSavingId(tour.id)
    try {
      const { error } = await markTourReceiptRequired(supabase, tour.id)
      if (error) {
        alert(isKo ? `저장 실패: ${error}` : `Save failed: ${error}`)
        return
      }
      setHiddenRows((prev) => prev.filter((r) => r.id !== tour.id))
      setVisibleRows((prev) => {
        const next = [tour, ...prev.filter((r) => r.id !== tour.id)]
        onCountsChangeRef.current?.(next.length)
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  if (!isOpen) return null

  const showingHidden = listTab === 'hidden'
  const rows = showingHidden ? hiddenRows : visibleRows

  const tabBtn = (id: ListTab, label: string, count: number) => {
    const active = listTab === id
    return (
      <button
        type="button"
        onClick={() => setListTab(id)}
        className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
          active
            ? 'bg-rose-700 text-white border-rose-700'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        {label}
        <span className={`ml-1 tabular-nums ${active ? 'text-white/90' : 'text-gray-500'}`}>({count})</span>
      </button>
    )
  }

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
                {isKo ? '지출 없는 투어' : 'Tours with no expenses'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isKo
                  ? '오늘 이전 투어 중 지출 기록이 없는 목록입니다. 숨김을 체크하면 목록에서 빠지고, 숨김 탭에서 다시 볼 수 있습니다.'
                  : 'Past tours (before today) with no expenses. Check Hide to move a tour to the Hidden tab.'}
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

        <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 border-b border-gray-100">
          {tabBtn('visible', isKo ? '목록' : 'List', visibleRows.length)}
          {tabBtn('hidden', isKo ? '숨김' : 'Hidden', hiddenRows.length)}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              {showingHidden
                ? isKo
                  ? '숨긴 투어가 없습니다.'
                  : 'No hidden tours.'
                : isKo
                  ? '지출이 없는 지난 투어가 없습니다.'
                  : 'No past tours without expenses.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2 w-14">{isKo ? '숨김' : 'Hide'}</th>
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                  <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                  <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                  <th className="py-2 pr-2 w-24">{isKo ? '작업' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const title = `${t.tour_date || ''} ${t.product_name || t.product_id || ''}`.trim()
                  const busy = savingId === t.id
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-rose-700 focus:ring-rose-600"
                          checked={showingHidden}
                          disabled={busy}
                          onChange={() => {
                            if (showingHidden) void handleUnhide(t)
                            else void handleHide(t)
                          }}
                          aria-label={
                            showingHidden
                              ? isKo
                                ? '목록으로 되돌리기'
                                : 'Restore to list'
                              : isKo
                                ? '이 목록에서 숨기기'
                                : 'Hide from this list'
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                      <td className="py-2 pr-2 truncate max-w-[220px]" title={t.product_name || t.product_id || ''}>
                        {t.product_name || t.product_id || '—'}
                      </td>
                      <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                      <td className="py-2 pr-2">{(t.tour_status || '—').toString()}</td>
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
