'use client'

import React, { useEffect, useState } from 'react'

export type TicketBookingVendorConfirmModalProps = {
  open: boolean
  initialRnNumber: string
  company?: string
  locale: string
  onClose: () => void
  onConfirm: (payload: { rn_number: string }) => void | Promise<void>
  saving?: boolean
}

export default function TicketBookingVendorConfirmModal({
  open,
  initialRnNumber,
  company,
  locale,
  onClose,
  onConfirm,
  saving,
}: TicketBookingVendorConfirmModalProps) {
  const [rn, setRn] = useState(initialRnNumber)

  useEffect(() => {
    if (open) {
      setRn(initialRnNumber)
    }
  }, [open, initialRnNumber])

  const isKo = locale === 'ko'

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onConfirm({ rn_number: rn.trim() })
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-vendor-confirm-title"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 id="ticket-vendor-confirm-title" className="text-base font-semibold text-gray-900">
          {isKo ? '벤더 확정' : 'Confirm vendor'}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {isKo
            ? 'RN#이 있으면 입력하세요. 비워두면 가예약으로 확정되며, 기존 RN#은 유지됩니다.'
            : 'Enter RN# if available. Leave empty to keep tentative; existing RN# is kept if unchanged.'}
        </p>
        {company ? (
          <p className="mt-2 text-xs font-medium text-gray-700">{company}</p>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="vendor-confirm-rn" className="block text-xs font-medium text-gray-600">
              RN#
            </label>
            <input
              id="vendor-confirm-rn"
              type="text"
              autoComplete="off"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              value={rn}
              onChange={(e) => setRn(e.target.value)}
              disabled={!!saving}
              placeholder={isKo ? '선택 입력' : 'Optional'}
            />
          </div>
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
              className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              disabled={!!saving}
            >
              {saving ? (isKo ? '처리 중…' : 'Saving…') : isKo ? '확정' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
