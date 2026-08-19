'use client'

import { CloudOff } from 'lucide-react'
import type { WeatherCancelCreditFollowUpState } from '@/lib/ticketBookingWorkflow'

const COPY: Record<
  WeatherCancelCreditFollowUpState,
  { ko: string; en: string; className: string }
> = {
  not_needed: {
    ko: '결제 전 · 크레딧 없음',
    en: 'Unpaid · no credit due',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  pending: {
    ko: '결제 후 · 크레딧 대기',
    en: 'Paid · credit follow-up',
    className: 'border-cyan-300 bg-cyan-50 text-cyan-950',
  },
  received: {
    ko: '결제 후 · 크레딧 완료',
    en: 'Paid · credit received',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
}

export default function WeatherCancelCreditFollowUpChip({
  state,
  locale,
  compact = false,
}: {
  state: WeatherCancelCreditFollowUpState
  locale: string
  compact?: boolean
}) {
  const isEn = locale.startsWith('en')
  const copy = COPY[state]
  return (
    <span
      className={`inline-flex items-center gap-0.5 border font-medium ${copy.className} ${
        compact ? 'rounded-md px-1.5 py-0.5 text-[10px]' : 'rounded-lg px-2 py-0.5 text-xs'
      }`}
      title={isEn ? copy.en : copy.ko}
    >
      <CloudOff className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      {isEn ? copy.en : copy.ko}
    </span>
  )
}
