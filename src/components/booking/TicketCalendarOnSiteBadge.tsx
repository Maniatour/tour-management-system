'use client'

import { formatTicketPayableUsd } from '@/lib/ticket-booking-change-display'

export function TicketCalendarOnSiteBadge({
  amount,
  locale,
  compact = false,
}: {
  amount: number
  locale: string
  compact?: boolean
}) {
  if (!(amount > 0)) return null
  const isEn = locale.startsWith('en')
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-emerald-50 font-bold tabular-nums leading-none text-emerald-900 ring-1 ring-emerald-200 ${
        compact
          ? 'px-1 py-px text-[8px] sm:px-1.5 sm:text-[10px]'
          : 'px-1.5 py-0.5 text-[10px] sm:text-xs'
      }`}
      title={
        isEn
          ? `On-site payment ${formatTicketPayableUsd(amount)}`
          : `현장 결제 ${formatTicketPayableUsd(amount)}`
      }
    >
      {isEn ? 'On-site ' : '현장 결제 '}
      {formatTicketPayableUsd(amount)}
    </span>
  )
}
