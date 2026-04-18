'use client'

import React, { useState, useEffect, type ReactNode } from 'react'
import { X, Trash2 } from 'lucide-react'
import { canPermanentDeleteRecords } from '@/utils/tourUtils'
import type { Reservation } from '@/types/reservation'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  reservations: Reservation[]
  loading?: boolean
  userEmail: string | null | undefined
  locale: string
  onPermanentDelete: (reservationId: string) => Promise<void>
  emptyHint?: string
  /** 간단 예약 카드 (`ReservationCardItem` 등) */
  renderReservationCard: (reservation: Reservation) => ReactNode
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
  renderReservationCard,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canPurge = canPermanentDeleteRecords(userEmail)
  const isKo = locale === 'ko'

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

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
    <div
      role="presentation"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleted-reservations-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div>
            <h2 id="deleted-reservations-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
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

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{isKo ? '불러오는 중…' : 'Loading…'}</p>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-gray-500">
              {emptyHint || (isKo ? '삭제된 예약이 없습니다.' : 'No deleted reservations.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservations.map((r) => (
                <div key={r.id} className="relative">
                  {canPurge ? (
                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => handlePurge(r.id)}
                      className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 shadow-sm"
                      title={isKo ? '영구 삭제' : 'Purge'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isKo ? '영구 삭제' : 'Purge'}
                    </button>
                  ) : null}
                  {renderReservationCard(r)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
