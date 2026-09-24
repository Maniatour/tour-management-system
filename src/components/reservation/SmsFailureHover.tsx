'use client'

import type { ReactElement } from 'react'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import { explainSmsFailure } from '@/lib/smsFailureExplanation'

export default function SmsFailureHover({
  raw,
  locale,
  children,
}: {
  raw?: string | null | undefined
  locale: 'ko' | 'en'
  children: ReactElement
}) {
  return (
    <ScheduleHoverTooltip content={explainSmsFailure(raw, locale)} placement="above" maxWidth={360}>
      {children}
    </ScheduleHoverTooltip>
  )
}
