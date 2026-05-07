'use client'

import React, { useState } from 'react'
import { X, Trash2, RotateCcw } from 'lucide-react'
import { canPermanentDeleteRecords } from '@/utils/tourUtils'

export type DeletedTourRow = {
  id: string
  tour_date?: string | null
  tour_status?: string | null
  product_id?: string | null
  tour_guide_id?: string | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  tours: DeletedTourRow[]
  productLabel?: string | null
  loading?: boolean
  userEmail: string | null | undefined
  locale: string
  /** 삭제됨 → scheduled 로 복구 (스케줄·목록에 다시 표시) */
  onRestoreTour?: (tourId: string) => Promise<void>
  onPermanentDelete: (tourId: string) => Promise<void>
  emptyHint?: string
}

export function DeletedToursTableModal({
  isOpen,
  onClose,
  title,
  subtitle,
  tours,
  productLabel,
  loading = false,
  userEmail,
  locale,
  onRestoreTour,
  onPermanentDelete,
  emptyHint,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const canPurge = canPermanentDeleteRecords(userEmail)
  const isKo = locale === 'ko'

  if (!isOpen) return null

  const handleRestore = async (id: string) => {
    if (!onRestoreTour) return
    const msg = isKo
      ? '이 투어를 "예정" 상태로 복구합니다. 가이드·차량은 비어 있으니 다시 배정해 주세요. 계속할까요?'
      : 'Restore this tour to scheduled? Reassign guide and vehicle afterward. Continue?'
    if (!confirm(msg)) return
    setRestoringId(id)
    try {
      await onRestoreTour(id)
    } finally {
      setRestoringId(null)
    }
  }

  const handlePurge = async (id: string) => {
    const msg = isKo
      ? 'DB에서 이 투어를 완전히 삭제합니다. 연결 데이터에 따라 실패할 수 있습니다. 계속할까요?'
      : 'Permanently delete this tour from the database? This may fail if related data exists. Continue?'
    if (!confirm(msg)) return
    setDeletingId(id)
    try {
      await onPermanentDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
            {productLabel ? (
              <p className="text-xs text-gray-500 mt-1">
                {isKo ? '상품' : 'Product'}: {productLabel}
              </p>
            ) : null}
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2">
              {isKo
                ? '영구 삭제는 info@maniatour.com 로그인 계정에서만 버튼이 표시됩니다.'
                : 'Permanent delete buttons are only shown when signed in as info@maniatour.com.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{isKo ? '불러오는 중…' : 'Loading…'}</p>
          ) : tours.length === 0 ? (
            <p className="text-sm text-gray-500">{emptyHint || (isKo ? '삭제된 투어가 없습니다.' : 'No deleted tours.')}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2">{isKo ? '투어 ID' : 'Tour'}</th>
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                  <th className="py-2 pr-2 w-40 text-right">{isKo ? '작업' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {tours.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-mono text-xs">{t.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-2">{t.tour_date || '—'}</td>
                    <td className="py-2 pr-2">{t.tour_status || '—'}</td>
                    <td className="py-2 pr-2 text-right space-x-1">
                      {onRestoreTour ? (
                        <button
                          type="button"
                          disabled={restoringId === t.id}
                          onClick={() => void handleRestore(t.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {isKo ? '복구' : 'Restore'}
                        </button>
                      ) : null}
                      {canPurge ? (
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => handlePurge(t.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isKo ? '영구 삭제' : 'Purge'}
                        </button>
                      ) : null}
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
