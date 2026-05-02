'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Mail, ClipboardCheck, Plane, MapPin, Minus } from 'lucide-react'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import { prerequisitesMetForDeparture, prerequisitesMetForPickup } from '@/lib/reservationFollowUpPipeline'

export type FollowUpPipelineEmailType =
  | 'confirmation'
  | 'resident_inquiry'
  | 'departure'
  | 'pickup'

type StepVisual = 'done' | 'action' | 'upcoming' | 'na'

function stepClasses(v: StepVisual): string {
  if (v === 'done') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (v === 'action') return 'text-amber-800 bg-amber-50 border-amber-300 ring-1 ring-amber-200'
  if (v === 'na') return 'text-gray-300 bg-gray-50 border-gray-100 opacity-70'
  return 'text-gray-400 bg-gray-50 border-gray-100'
}

function resolveSteps(s: ReservationFollowUpPipelineSnapshot): {
  confirm: StepVisual
  resident: StepVisual
  departure: StepVisual
  pickup: StepVisual
} {
  const confirm: StepVisual = s.confirmationSent ? 'done' : 'action'

  let resident: StepVisual = 'na'
  if (s.needsResidentFlow) {
    if (s.guestResidentFlowCompleted && s.residentInquirySent) resident = 'done'
    else if (!s.residentInquirySent || !s.guestResidentFlowCompleted) resident = 'action'
  }

  let departure: StepVisual = 'upcoming'
  if (!prerequisitesMetForDeparture(s)) departure = 'upcoming'
  else if (s.departureSent) departure = 'done'
  else departure = 'action'

  let pickup: StepVisual = 'upcoming'
  if (!prerequisitesMetForPickup(s)) pickup = 'upcoming'
  else if (s.pickupSent) pickup = 'done'
  else pickup = 'action'

  return { confirm, resident, departure, pickup }
}

function emailTypeForStepKey(
  key: string,
  residentVisual: StepVisual
): FollowUpPipelineEmailType | null {
  if (key === 'c') return 'confirmation'
  if (key === 'r') return residentVisual === 'na' ? null : 'resident_inquiry'
  if (key === 'd') return 'departure'
  if (key === 'p') return 'pickup'
  return null
}

export function ReservationFollowUpPipelineIcons({
  snapshot,
  disabled,
  onEmailPreviewClick,
}: {
  snapshot: ReservationFollowUpPipelineSnapshot | null | undefined
  /** 취소·삭제 등 파이프라인 비적용 */
  disabled?: boolean
  /** 단계별 이메일 미리보기 (거주 미해당 상품은 거주 아이콘 비활성) */
  onEmailPreviewClick?: (emailType: FollowUpPipelineEmailType) => void
}) {
  const t = useTranslations('reservations')

  if (!snapshot || disabled) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-gray-300" aria-hidden>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-100 bg-gray-50">
          <Minus className="h-3 w-3" />
        </span>
      </div>
    )
  }

  const { confirm, resident, departure, pickup } = resolveSteps(snapshot)

  const items: { key: string; Icon: typeof Mail; visual: StepVisual; label: string }[] = [
    { key: 'c', Icon: Mail, visual: confirm, label: t('followUpPipeline.step1IconTitle') },
    {
      key: 'r',
      Icon: resident === 'na' ? Minus : ClipboardCheck,
      visual: resident,
      label: resident === 'na' ? t('followUpPipeline.step2SkipTitle') : t('followUpPipeline.step2IconTitle'),
    },
    { key: 'd', Icon: Plane, visual: departure, label: t('followUpPipeline.step3IconTitle') },
    { key: 'p', Icon: MapPin, visual: pickup, label: t('followUpPipeline.step4IconTitle') },
  ]

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="group"
      aria-label={t('followUpPipeline.ariaPipelineStatus')}
    >
      {items.map(({ key, Icon, visual, label }) => {
        const emailType = emailTypeForStepKey(key, resident)
        const interactive = !!onEmailPreviewClick && emailType != null
        const boxClass = `inline-flex h-6 w-6 items-center justify-center rounded border ${stepClasses(visual)}`

        if (interactive) {
          return (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              className={`${boxClass} cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1`}
              onClick={(e) => {
                e.stopPropagation()
                onEmailPreviewClick(emailType)
              }}
            >
              <Icon className="h-3 w-3 shrink-0 pointer-events-none" aria-hidden />
            </button>
          )
        }

        return (
          <span key={key} title={label} className={boxClass}>
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
          </span>
        )
      })}
    </div>
  )
}
