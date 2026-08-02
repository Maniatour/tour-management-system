'use client'

import type { ReactNode } from 'react'
import {
  normalizeAssignmentStatus,
  shouldShowAssignmentStatusIcon,
} from '@/lib/guideAssignmentStatus'

type GuideAssignmentStatusIconProps = {
  status?: string | null
  className?: string
  title?: string
  children: ReactNode
}

/** 인원 숫자를 감싸는 배정 상태 표시: 부여(○) · 확정(□) · 거절(×) */
export default function GuideAssignmentStatusIcon({
  status,
  className = '',
  title,
  children,
}: GuideAssignmentStatusIconProps) {
  const normalized = normalizeAssignmentStatus(status)

  if (!shouldShowAssignmentStatusIcon(status)) {
    return <span className={className}>{children}</span>
  }

  const label = (
    <span className="relative z-10 inline-flex min-w-[0.7rem] items-center justify-center tabular-nums text-[10px] font-semibold leading-none">
      {children}
    </span>
  )

  if (normalized === 'assigned') {
    return (
      <span
        className={`relative inline-flex min-h-[14px] min-w-[14px] items-center justify-center px-[2px] ${className}`}
        title={title}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full border-[1.5px] border-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.2)]"
          aria-hidden
        />
        {label}
      </span>
    )
  }

  if (normalized === 'confirmed') {
    return (
      <span
        className={`relative inline-flex min-h-[14px] min-w-[14px] items-center justify-center px-[2px] ${className}`}
        title={title}
      >
        <span
          className="pointer-events-none absolute inset-0 border-[1.5px] border-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.2)]"
          aria-hidden
        />
        {label}
      </span>
    )
  }

  if (normalized === 'rejected') {
    return (
      <span
        className={`relative inline-flex min-h-[14px] min-w-[14px] items-center justify-center px-[2px] ${className}`}
        title={title}
      >
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="absolute h-[110%] w-[1.5px] rotate-45 rounded-full bg-white shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
          <span className="absolute h-[110%] w-[1.5px] -rotate-45 rounded-full bg-white shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
        </span>
        {label}
      </span>
    )
  }

  return <span className={className}>{children}</span>
}
