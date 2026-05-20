'use client'

import type { TicketBookingChangeStackModel } from '@/lib/ticket-booking-change-display'

const toneClass = {
  default: 'text-gray-900',
  muted: 'text-gray-400 text-[10px] leading-none',
  pending: 'text-red-600 font-semibold',
} as const

type Props = {
  model: TicketBookingChangeStackModel
  className?: string
}

/** 수량·비용·시간 등 변경 전후를 세로로 표시 */
export function TicketBookingChangeStack({ model, className = '' }: Props) {
  return (
    <div
      className={`inline-flex flex-col items-start gap-0.5 leading-tight tabular-nums ${model.highlight ? 'font-medium' : ''} ${className}`}
    >
      {model.lines.map((line, i) => (
        <span key={i} className={toneClass[line.tone ?? 'default']}>
          {line.text}
        </span>
      ))}
    </div>
  )
}
