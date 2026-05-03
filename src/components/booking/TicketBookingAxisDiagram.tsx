'use client'

import { useTranslations } from 'next-intl'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatTicketBookingAxisLabel,
  type TicketBookingAxisKind,
} from '@/lib/ticketBookingAxisLabels'
import { TICKET_BOOKING_AXIS_DIAGRAM_ROWS } from '@/lib/ticketBookingAxisDiagram'

const AXIS_LABEL_KEYS: Record<TicketBookingAxisKind, string> = {
  booking: 'axisBooking',
  vendor: 'axisVendor',
  change: 'axisChange',
  payment: 'axisPayment',
  refund: 'axisRefund',
  operation: 'axisOperation',
}

type Props = {
  className?: string
}

export default function TicketBookingAxisDiagram({ className }: Props) {
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const tCal = useTranslations('booking.calendar')
  const tAct = useTranslations('booking.calendar.ticketBookingActions')

  return (
    <div
      className={cn(
        'bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 mb-3 text-[10px] leading-snug',
        className
      )}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="font-semibold text-gray-800 shrink-0">{tCal('ticketStatusExplainTitle')}</span>
        <span
          className="inline-flex cursor-help text-gray-400 hover:text-gray-600 pt-0.5"
          title={tCal('ticketStatusExplainSixAxisIntro')}
          aria-label={tCal('ticketStatusExplainSixAxisIntro')}
        >
          <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        </span>
      </div>
      <p className="sr-only">{tCal('ticketStatusExplainSixAxisIntro')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 border-t border-gray-200/80 pt-2">
        {TICKET_BOOKING_AXIS_DIAGRAM_ROWS.map(({ axis, primary, alternate }) => {
          const axisTitle = tAct(AXIS_LABEL_KEYS[axis])
          const primaryLine = primary
            .map((v) => formatTicketBookingAxisLabel(tAxis, axis, v))
            .join(' → ')
          const alternateLine =
            alternate?.length ?
              alternate.map((v) => formatTicketBookingAxisLabel(tAxis, axis, v)).join(' · ')
            : ''
          const ariaFlow =
            alternateLine ?
              `${axisTitle}. ${primaryLine}. ${tCal('ticketStatusDiagramAlternateCaption')}: ${alternateLine}`
            : `${axisTitle}. ${primaryLine}`

          return (
            <div
              key={axis}
              className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-gray-800"
              role="group"
              aria-label={ariaFlow}
            >
              <span className="font-semibold text-gray-600 shrink-0 tabular-nums">{axisTitle}</span>
              <span className="text-gray-400 shrink-0" aria-hidden>
                —
              </span>
              <span className="min-w-0 text-gray-800">{primaryLine}</span>
              {alternate?.length ?
                <span
                  className="inline-flex cursor-help items-center gap-0.5 shrink-0 rounded border border-dashed border-amber-300/80 bg-amber-50/70 px-1 py-px text-[9px] font-medium text-amber-900/90"
                  title={`${tCal('ticketStatusDiagramAlternateCaption')}: ${alternateLine}`}
                  aria-label={`${tCal('ticketStatusDiagramAlternateCaption')}: ${alternateLine}`}
                >
                  +{alternate.length}
                </span>
              : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
