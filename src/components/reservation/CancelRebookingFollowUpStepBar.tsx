'use client'

import {
  buildCancelRebookingWorkflowBadges,
  buildCancelRebookingWorkflowState,
  cancelRebookingOutOfOrderTooltip,
  isCancellationReasonRecordedOutOfOrder,
  type CancelRebookingWorkflowState,
} from '@/lib/cancelRebookingFollowUpWorkflow'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'

type CancelRebookingFollowUpStepBarProps = {
  locale: string
  snapshot?: ReservationFollowUpPipelineSnapshot | null | undefined
  cancellationReason?: string | null
  hasCustomerResponse?: boolean
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

export function CancelRebookingFollowUpStepBar({
  locale,
  snapshot,
  cancellationReason,
  hasCustomerResponse = false,
  compact = false,
}: CancelRebookingFollowUpStepBarProps) {
  const workflow: CancelRebookingWorkflowState = buildCancelRebookingWorkflowState({
    snapshot,
    cancellationReason,
    hasCustomerResponse,
  })
  const badges = buildCancelRebookingWorkflowBadges(workflow, locale)
  const outOfOrder = isCancellationReasonRecordedOutOfOrder(workflow)
  const outOfOrderTooltip = cancelRebookingOutOfOrderTooltip(locale)

  return (
    <div className={compact ? 'min-w-0' : 'w-full'}>
      {!compact ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {locale === 'ko' ? '권장 처리 순서' : 'Recommended order'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {badges.map((badge) => {
          const showOutOfOrderTooltip = outOfOrder && badge.id === 'notice_needed'
          return (
            <span
              key={badge.id}
              title={showOutOfOrderTooltip ? outOfOrderTooltip : undefined}
              className={[
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight',
                badgeClassName(badge.tone),
                showOutOfOrderTooltip ? 'cursor-help' : undefined,
              ].join(' ')}
            >
              {badge.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
