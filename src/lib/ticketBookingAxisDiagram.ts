import type { TicketBookingAxisKind } from '@/lib/ticketBookingAxisLabels'

export type TicketBookingAxisDiagramRow = {
  axis: TicketBookingAxisKind
  /** 전형적인 진행 방향(왼쪽→오른쪽) */
  primary: readonly string[]
  /** 분기·종료 등 그 외 값 */
  alternate?: readonly string[]
}

/**
 * 상태 설명 UI 다이어그램용 — DB CHECK 값과 동일한 소문자 키.
 */
export const TICKET_BOOKING_AXIS_DIAGRAM_ROWS: readonly TicketBookingAxisDiagramRow[] = [
  {
    axis: 'booking',
    primary: ['requested', 'on_hold', 'tentative', 'confirmed'],
    alternate: ['cancel_requested', 'cancelled', 'no_show', 'failed', 'expired'],
  },
  {
    axis: 'vendor',
    primary: ['pending', 'confirmed'],
    alternate: ['rejected', 'changed', 'cancelled'],
  },
  {
    axis: 'change',
    primary: ['none', 'requested', 'confirmed'],
    alternate: ['rejected', 'cancelled'],
  },
  {
    axis: 'payment',
    primary: ['not_due', 'requested', 'paid'],
    alternate: ['partially_paid', 'failed', 'refunded'],
  },
  {
    axis: 'refund',
    primary: ['none', 'requested', 'credit_received', 'refunded'],
    alternate: ['partially_refunded', 'rejected'],
  },
  {
    axis: 'operation',
    primary: ['none', 'reconfirm_needed', 'reconfirmed'],
    alternate: ['issue_reported', 'under_review', 'resolved'],
  },
]
