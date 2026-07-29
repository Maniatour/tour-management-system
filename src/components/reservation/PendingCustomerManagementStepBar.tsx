'use client'

import {
  buildPendingCustomerWorkflowBadges,
  buildPendingCustomerWorkflowState,
  type PendingCustomerResolutionKind,
} from '@/lib/pendingCustomerManagementWorkflow'

type PendingCustomerManagementStepBarProps = {
  locale: string
  altTourNoticeManual: boolean
  hasCustomerResponse: boolean
  resolutionKind: PendingCustomerResolutionKind | null
  compact?: boolean
}

function badgeClassName(tone: 'needed' | 'done' | 'waiting'): string {
  if (tone === 'done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }
  if (tone === 'waiting') {
    return 'border-sky-200 bg-sky-50 text-sky-900'
  }
  return 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-200'
}

export function PendingCustomerManagementStepBar({
  locale,
  altTourNoticeManual,
  hasCustomerResponse,
  resolutionKind,
  compact = false,
}: PendingCustomerManagementStepBarProps) {
  const workflow = buildPendingCustomerWorkflowState({
    altTourNoticeManual,
    hasCustomerResponse,
    resolutionKind,
  })
  const badges = buildPendingCustomerWorkflowBadges(workflow, locale)

  return (
    <div className={compact ? 'min-w-0' : 'w-full'}>
      {!compact ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {locale === 'ko' ? '권장 처리 순서' : 'Recommended order'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {badges.map((badge) => (
          <span
            key={badge.id}
            className={[
              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight',
              badgeClassName(badge.tone),
            ].join(' ')}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </div>
  )
}
