'use client'

import React from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ReservationOptionsSection from '@/components/reservation/ReservationOptionsSection'

export interface ReservationOptionsModalProps {
  open: boolean
  onClose: () => void
  reservationId: string
  onPersistedMutation?: () => void
}

export default function ReservationOptionsModal({
  open,
  onClose,
  reservationId,
  onPersistedMutation,
}: ReservationOptionsModalProps) {
  const t = useTranslations('reservations.card')
  const tRes = useTranslations('reservations.reservationOptions')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-options-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 id="reservation-options-modal-title" className="text-base font-semibold text-gray-900">
            {t('reservationOptionsModalTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {/* 예약 정보 수정 폼(options-section)과 동일한 박스·라인 스타일 */}
          <div className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 overflow-y-auto">
            <ReservationOptionsSection
              reservationId={reservationId}
              isPersisted
              itemVariant="line"
              title={tRes('title')}
              onPersistedMutation={onPersistedMutation}
              addOptionModalZClass="z-[110]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}