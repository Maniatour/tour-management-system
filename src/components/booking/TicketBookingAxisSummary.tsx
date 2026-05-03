'use client'

import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  formatTicketBookingAxisLabel,
  type TicketBookingAxisKind,
} from '@/lib/ticketBookingAxisLabels'

export type TicketBookingAxisSnapshotProps = {
  booking_status?: string | null | undefined
  vendor_status?: string | null | undefined
  change_status?: string | null | undefined
  payment_status?: string | null | undefined
  refund_status?: string | null | undefined
  operation_status?: string | null | undefined
}

const ROWS: {
  axis: TicketBookingAxisKind
  field: keyof TicketBookingAxisSnapshotProps
  labelKey: 'axisBooking' | 'axisVendor' | 'axisChange' | 'axisPayment' | 'axisRefund' | 'axisOperation'
}[] = [
  { axis: 'booking', field: 'booking_status', labelKey: 'axisBooking' },
  { axis: 'vendor', field: 'vendor_status', labelKey: 'axisVendor' },
  { axis: 'change', field: 'change_status', labelKey: 'axisChange' },
  { axis: 'payment', field: 'payment_status', labelKey: 'axisPayment' },
  { axis: 'refund', field: 'refund_status', labelKey: 'axisRefund' },
  { axis: 'operation', field: 'operation_status', labelKey: 'axisOperation' },
]

export function snapshotHasAnyTicketBookingAxis(booking: TicketBookingAxisSnapshotProps): boolean {
  return ROWS.some(({ field }) => {
    const v = booking[field]
    return v != null && String(v).trim() !== ''
  })
}

/** 달력 칩·툴팁용 한 줄 (줄바꿈으로 여러 행 연결 가능) */
export function buildTicketBookingAxisTooltipLine(
  booking: TicketBookingAxisSnapshotProps,
  tAxis: (key: string) => string,
  tAct: (key: string) => string,
  omitAxes: readonly TicketBookingAxisKind[] = []
): string | null {
  if (!snapshotHasAnyTicketBookingAxis(booking)) return null
  const rows = omitAxes.length ? ROWS.filter((r) => !omitAxes.includes(r.axis)) : ROWS
  return rows
    .map(({ axis, field, labelKey }) => {
      const label = tAct(labelKey)
      const value = formatTicketBookingAxisLabel(tAxis, axis, booking[field])
      return `${label} ${value}`
    })
    .join(' · ')
}

type Props = {
  booking: TicketBookingAxisSnapshotProps
  variant?: 'inline' | 'grid'
  /** `variant="grid"`일 때 목록 테이블용 타이트 레이아웃 */
  compact?: boolean
  className?: string
  /** 예: 운영 축 미노출 — `['operation']` */
  omitAxes?: readonly TicketBookingAxisKind[]
}

/**
 * 입장권 부킹 6축 상태 요약 — 목록·상세에서 공통 사용.
 */
export default function TicketBookingAxisSummary({
  booking,
  variant = 'inline',
  compact = false,
  className,
  omitAxes = [],
}: Props) {
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const tAct = useTranslations('booking.calendar.ticketBookingActions')

  if (!snapshotHasAnyTicketBookingAxis(booking)) return null

  const rows = omitAxes.length ? ROWS.filter((r) => !omitAxes.includes(r.axis)) : ROWS

  if (variant === 'inline') {
    const line = buildTicketBookingAxisTooltipLine(booking, tAxis, tAct, omitAxes)
    if (!line) return null
    return (
      <span
        className={cn('inline-flex cursor-help items-center align-middle text-slate-500', className)}
        title={line}
        aria-label={line}
      >
        <Info className="h-3.5 w-3.5 shrink-0 opacity-80 hover:opacity-100" strokeWidth={2.25} aria-hidden />
      </span>
    )
  }

  return (
    <dl
      className={cn(
        'grid grid-cols-1 text-gray-700 sm:grid-cols-2',
        compact ? 'gap-0.5 text-[9px] leading-tight' : 'gap-1 text-[11px]',
        className
      )}
    >
      {rows.map(({ axis, field, labelKey }) => (
        <div key={axis} className={cn('flex', compact ? 'gap-1' : 'gap-2')}>
          <dt className={cn('shrink-0 text-gray-500', compact && 'w-8')}>{tAct(labelKey)}</dt>
          <dd
            className={cn(
              'min-w-0 break-words',
              compact ? 'font-medium text-gray-800' : 'text-gray-700'
            )}
          >
            {formatTicketBookingAxisLabel(tAxis, axis, booking[field])}
          </dd>
        </div>
      ))}
    </dl>
  )
}
