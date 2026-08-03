'use client'

import {
  normalizeAssignmentStatus,
  shouldShowAssignmentStatusIcon,
} from '@/lib/guideAssignmentStatus'

type GuideAssignmentStatusStripeProps = {
  status?: string | null
  title?: string
}

const STRIPE_BY_STATUS: Record<string, string> = {
  pending: 'bg-slate-400',
  assigned: 'bg-yellow-400',
  confirmed: 'bg-green-500',
  rejected: 'bg-red-500',
}

/**
 * 투어 박스 왼쪽 색상 라인 — 대기(회색) · 부여(노랑) · 배정(녹색) · 거절(빨강)
 */
export function GuideAssignmentStatusStripe({
  status,
  title,
}: GuideAssignmentStatusStripeProps) {
  const normalized = normalizeAssignmentStatus(status)

  if (!shouldShowAssignmentStatusIcon(status)) {
    return null
  }

  const colorClass = STRIPE_BY_STATUS[normalized]
  if (!colorClass) return null

  return (
    <span
      className={`pointer-events-none absolute left-0 top-0 z-20 h-full w-[4px] rounded-l-sm shadow-[1px_0_2px_rgba(0,0,0,0.35)] ${colorClass}`}
      title={title}
      aria-label={title}
    />
  )
}

export default GuideAssignmentStatusStripe
