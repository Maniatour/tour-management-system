'use client'

import React, { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { canPermanentDeleteRecords } from '@/utils/tourUtils'

export type DeletedReservationRow = {
  id: string
  customer_id?: string | null
  tour_date?: string | null
  status?: string | null
  customer_name?: string | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  reservations: DeletedReservationRow[]
  loading?: boolean
  userEmail: string | null | undefined
  locale: string
  onPermanentDelete: (reservationId: string) => Promise<void>
  emptyHint?: string
}

export function DeletedReservationsTableModal({
  isOpen,
  onClose,
  title,
  subtitle,
  reservations,
  loading = false,
  userEmail,
  locale,
  onPermanentDelete,
  emptyHint,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canPurge = canPermanentDeleteRecords(userEmail)
  const isKo = locale === 'ko'

  if (!isOpen) return null

  const handlePurge = async (id: string) => {
    const msg = isKo
      ? 'DB에서 이 예약을 완전히 삭제합니다. 계속할까요?'
      : 'Permanently delete this reservation from the database?'
    if (!confirm(msg)) return
    setDeletingId(id)
    try {
      await onPermanentDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
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
          ) : reservations.length === 0 ? (
            <p className="text-sm text-gray-500">{emptyHint || (isKo ? '삭제된 예약이 없습니다.' : 'No deleted reservations.')}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2">{isKo ? '예약 ID' : 'Reservation'}</th>
                  <th className="py-2 pr-2">{isKo ? '고객' : 'Customer'}</th>
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Tour date'}</th>
                  <th className="py-2 pr-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-2">{r.customer_name || '—'}</td>
                    <td className="py-2 pr-2">{r.tour_date || '—'}</td>
                    <td className="py-2 pr-2 text-right">
                      {canPurge ? (
                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => handlePurge(r.id)}
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
