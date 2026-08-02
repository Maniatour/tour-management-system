'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  getAssignmentStatusBadgeColor,
  getAssignmentStatusLabel,
  normalizeAssignmentStatus,
  updateTourAssignmentStatus,
} from '@/lib/guideAssignmentStatus'

type GuideAssignmentStatusBadgeProps = {
  status?: string | null | undefined
  locale?: string
  className?: string
}

export function GuideAssignmentStatusBadge({
  status,
  locale = 'ko',
  className = '',
}: GuideAssignmentStatusBadgeProps) {
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusBadgeColor(status)} ${className}`}
    >
      {getAssignmentStatusLabel(status, locale)}
    </span>
  )
}

type GuideAssignmentResponseButtonsProps = {
  tourId: string
  assignmentStatus?: string | null | undefined
  currentUserEmail?: string | null | undefined
  tourGuideId?: string | null
  assistantId?: string | null
  locale?: string
  onUpdated?: (status: 'confirmed' | 'rejected') => void
  compact?: boolean
}

export function GuideAssignmentResponseButtons({
  tourId,
  assignmentStatus,
  currentUserEmail,
  tourGuideId,
  assistantId,
  locale = 'ko',
  onUpdated,
  compact = false,
}: GuideAssignmentResponseButtonsProps) {
  const [loading, setLoading] = useState(false)
  const isKo = locale === 'ko'
  const email = (currentUserEmail || '').toLowerCase()
  const isAssignedStaff =
    email &&
    (String(tourGuideId || '').toLowerCase() === email ||
      String(assistantId || '').toLowerCase() === email)
  const normalized = normalizeAssignmentStatus(assignmentStatus)

  if (!isAssignedStaff || normalized !== 'assigned') return null

  const handleResponse = async (status: 'confirmed' | 'rejected') => {
    setLoading(true)
    try {
      const result = await updateTourAssignmentStatus(tourId, status)
      if (!result.ok) {
        alert(isKo ? '배정 상태 업데이트 중 오류가 발생했습니다.' : 'Error updating assignment status.')
        return
      }
      onUpdated?.(status)
      alert(
        isKo
          ? status === 'confirmed'
            ? '스케줄을 확정했습니다.'
            : '스케줄을 거절했습니다.'
          : status === 'confirmed'
            ? 'Schedule confirmed.'
            : 'Schedule rejected.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`flex gap-1 ${compact ? '' : 'mt-2'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleResponse('confirmed')}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        {isKo ? '확정' : 'Confirm'}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleResponse('rejected')}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        {isKo ? '거절' : 'Reject'}
      </button>
    </div>
  )
}
