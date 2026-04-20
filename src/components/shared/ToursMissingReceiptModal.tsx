'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Receipt } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import {
  fetchToursNeedCheckData,
  type TourNeedCheckRow,
} from '@/lib/toursNeedCheckStats'

export type { TourNeedCheckRow }
/** @deprecated Use TourNeedCheckRow */
export type TourRowMissingReceipt = TourNeedCheckRow

type TabKey = 'noReceipt' | 'balance'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  tabNoReceiptLabel: string
  tabBalanceLabel: string
  locale: string
  onTourClick: (tourId: string) => void
  /** 모달에서 데이터를 다시 불러온 뒤 상위(버튼 카운트) 갱신 */
  onDataLoaded?: (payload: {
    unionCount: number
    noReceiptCount: number
    balanceCount: number
  }) => void
}

export function ToursNeedCheckModal({
  isOpen,
  onClose,
  title,
  subtitle,
  tabNoReceiptLabel,
  tabBalanceLabel,
  locale,
  onTourClick,
  onDataLoaded,
}: Props) {
  const supabase = createClientSupabase()
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('noReceipt')
  const [noReceipt, setNoReceipt] = useState<TourNeedCheckRow[]>([])
  const [balanceRemaining, setBalanceRemaining] = useState<TourNeedCheckRow[]>([])
  const onDataLoadedRef = useRef(onDataLoaded)
  onDataLoadedRef.current = onDataLoaded

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchToursNeedCheckData(supabase)
      setNoReceipt(data.noReceipt)
      setBalanceRemaining(data.balanceRemaining)
      onDataLoadedRef.current?.({
        unionCount: data.unionCount,
        noReceiptCount: data.noReceiptCount,
        balanceCount: data.balanceCount,
      })
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  if (!isOpen) return null

  const rows = tab === 'noReceipt' ? noReceipt : balanceRemaining

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-800 shrink-0">
              <Receipt className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 border-b border-gray-100 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('noReceipt')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'noReceipt'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabNoReceiptLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({noReceipt.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('balance')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'balance'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabBalanceLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({balanceRemaining.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{isKo ? '불러오는 중…' : 'Loading…'}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isKo ? '조건에 해당하는 투어가 없습니다.' : 'No tours match this filter.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                  <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                  <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                  <th className="py-2 pr-2 w-28">{isKo ? '이동' : 'Open'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                    <td className="py-2 pr-2 truncate max-w-[200px]" title={t.product_name || t.product_id || ''}>
                      {t.product_name || t.product_id || '—'}
                    </td>
                    <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                    <td className="py-2 pr-2">{(t.tour_status || '—').toString()}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => onTourClick(t.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {isKo ? '상세' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/** @deprecated Use ToursNeedCheckModal */
export const ToursMissingReceiptModal = ToursNeedCheckModal
