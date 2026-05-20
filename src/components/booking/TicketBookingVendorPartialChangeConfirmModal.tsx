'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  formatQtyArrow,
  formatTimeArrow,
  ticketBookingPendingQtyDiffers,
  ticketBookingPendingTimeDiffers,
} from '@/lib/ticketBookingWorkflow'

export type TicketBookingVendorPartialChangePayload = {
  apply_qty: boolean
  apply_time: boolean
}

export type TicketBookingVendorPartialChangeConfirmModalProps = {
  open: boolean
  locale: string
  company?: string
  booking: {
    ea?: number | null
    time?: string | null
    change_status?: string | null
    pending_ea?: number | null
    pending_time?: string | null
  }
  onClose: () => void
  onConfirm: (payload: TicketBookingVendorPartialChangePayload) => void | Promise<void>
  saving?: boolean
}

export default function TicketBookingVendorPartialChangeConfirmModal({
  open,
  locale,
  company,
  booking,
  onClose,
  onConfirm,
  saving,
}: TicketBookingVendorPartialChangeConfirmModalProps) {
  const isKo = locale === 'ko'
  const qtyPending = ticketBookingPendingQtyDiffers(booking)
  const timePending = ticketBookingPendingTimeDiffers(booking)

  const [applyQty, setApplyQty] = useState(false)
  const [applyTime, setApplyTime] = useState(false)

  useEffect(() => {
    if (open) {
      setApplyQty(false)
      setApplyTime(false)
    }
  }, [open, booking.ea, booking.pending_ea, booking.time, booking.pending_time])

  const canSubmit = useMemo(() => {
    if (applyQty && !qtyPending) return false
    if (applyTime && !timePending) return false
    return (applyQty && qtyPending) || (applyTime && timePending)
  }, [applyQty, applyTime, qtyPending, timePending])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    await onConfirm({
      apply_qty: applyQty && qtyPending,
      apply_time: applyTime && timePending,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-vendor-partial-confirm-title"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 id="ticket-vendor-partial-confirm-title" className="text-base font-semibold text-gray-900">
          {isKo ? '부분 확정' : 'Partial confirm'}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {isKo
            ? '벤더가 반영한 항목만 선택하세요. 선택하지 않은 변경은 응답 대기 상태로 남습니다.'
            : 'Select only the changes the vendor applied. Unselected items stay pending.'}
        </p>
        {company ? <p className="mt-2 text-xs font-medium text-gray-700">{company}</p> : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <fieldset className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <legend className="px-1 text-xs font-semibold text-gray-700">
              {isKo ? '반영할 변경' : 'Changes to apply'}
            </legend>
            {qtyPending ? (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={applyQty}
                  onChange={(e) => setApplyQty(e.target.checked)}
                  disabled={!!saving}
                />
                <span>
                  <span className="font-medium text-red-700">{isKo ? '수량' : 'Quantity'}</span>
                  <span className="mt-0.5 block tabular-nums text-xs text-gray-600">
                    {formatQtyArrow(booking)}
                  </span>
                </span>
              </label>
            ) : null}
            {timePending ? (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={applyTime}
                  onChange={(e) => setApplyTime(e.target.checked)}
                  disabled={!!saving}
                />
                <span>
                  <span className="font-medium text-red-700">{isKo ? '시간' : 'Time'}</span>
                  <span className="mt-0.5 block tabular-nums text-xs text-gray-600">
                    {formatTimeArrow(booking)}
                  </span>
                </span>
              </label>
            ) : null}
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={!!saving}
            >
              {isKo ? '취소' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="rounded bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              disabled={!!saving || !canSubmit}
            >
              {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '부분 확정 저장' : 'Save partial confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
