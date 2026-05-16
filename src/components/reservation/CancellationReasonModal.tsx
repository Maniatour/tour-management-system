'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'

interface CancellationReasonModalProps {
  isOpen: boolean
  locale?: string
  title?: string
  initialValue?: string
  saving?: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void> | void
}

export default function CancellationReasonModal({
  isOpen,
  locale = 'ko',
  title = 'Follow up',
  initialValue = '',
  saving = false,
  onClose,
  onSubmit,
}: CancellationReasonModalProps) {
  const isEn = locale === 'en'
  const [reason, setReason] = useState(initialValue)

  useEffect(() => {
    if (isOpen) setReason(initialValue)
  }, [isOpen, initialValue])

  const presets = useMemo(
    () =>
      isEn
        ? ['No Show', 'Canceled by customer', 'Rebooking', 'Not recruited', 'Weather', 'Schedule conflict', 'Duplicate booking', 'Price / Policy', 'Other']
        : ['No Show', '고객 취소', '재예약', '미모집', '날씨', '일정 변경', '중복 예약', '가격/정책', '기타'],
    [isEn]
  )

  if (!isOpen) return null

  const submitDisabled = saving || !reason.trim()

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
          <MessageSquare className="h-4 w-4" />
          {title}
        </h3>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{isEn ? 'Cancellation reason' : '취소 사유'}</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isEn ? 'Or enter cancellation reason' : '또는 취소 사유를 직접 입력 (선택)'}
              rows={2}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => void onSubmit(reason)}
              disabled={submitDisabled}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isEn ? 'Save' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
