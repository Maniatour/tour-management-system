import {
  deriveTicketBookingUnitPriceUsd,
  formatHHMM,
  formatUsdExpenseCell,
  formatUsdExpenseChunk,
} from '@/lib/ticketBookingWorkflow'

export type TicketBookingChangeStackLine = {
  text: string
  tone?: 'default' | 'muted' | 'pending'
}

export type TicketBookingChangeStackModel = {
  lines: TicketBookingChangeStackLine[]
  highlight: boolean
}

function isChangeRequested(cs: string | null | undefined): boolean {
  return (cs ?? 'none').toLowerCase() === 'requested'
}

/** 수량 — 세로: `5개` / `→` / `11개` */
export function getTicketBookingQtyStack(booking: {
  ea?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): TicketBookingChangeStackModel {
  const cur = booking.ea ?? 0
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (isChangeRequested(cs) && booking.pending_ea != null && booking.pending_ea !== cur) {
    return {
      highlight: true,
      lines: [
        { text: `${cur}개`, tone: 'default' },
        { text: '→', tone: 'muted' },
        { text: `${booking.pending_ea}개`, tone: 'pending' },
      ],
    }
  }
  return { highlight: false, lines: [{ text: `${cur}개`, tone: 'default' }] }
}

/** 시간 — 세로 스택 */
export function getTicketBookingTimeStack(booking: {
  time?: string | null
  change_status?: string | null
  pending_time?: string | null
}): TicketBookingChangeStackModel {
  const cur = formatHHMM(booking.time) || '—'
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (isChangeRequested(cs) && booking.pending_time) {
    const pend = formatHHMM(booking.pending_time)
    if (pend && cur !== pend) {
      return {
        highlight: true,
        lines: [
          { text: cur, tone: 'default' },
          { text: '→', tone: 'muted' },
          { text: pend, tone: 'pending' },
        ],
      }
    }
  }
  return { highlight: false, lines: [{ text: cur, tone: 'default' }] }
}

/** 비용(USD) — 세로 스택 */
export function getTicketBookingExpenseStack(booking: {
  ea?: number | null
  expense?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): TicketBookingChangeStackModel {
  const cs = (booking.change_status ?? 'none').toLowerCase()
  const curEa = booking.ea ?? 0
  const curRaw = booking.expense

  if (!isChangeRequested(cs) || booking.pending_ea == null || booking.pending_ea === curEa) {
    return {
      highlight: false,
      lines: [{ text: formatUsdExpenseCell(curRaw as number | null | undefined), tone: 'default' }],
    }
  }

  const curNum = Number(curRaw ?? 0)
  const unit = deriveTicketBookingUnitPriceUsd(curEa, curNum, booking.unit_price ?? null)
  const pendNum =
    unit > 0 ? Math.round(unit * booking.pending_ea * 100) / 100 : curNum

  if (Math.abs(curNum - pendNum) < 0.005) {
    return {
      highlight: false,
      lines: [{ text: formatUsdExpenseCell(curRaw as number | null | undefined), tone: 'default' }],
    }
  }

  return {
    highlight: true,
    lines: [
      { text: formatUsdExpenseChunk(curNum), tone: 'default' },
      { text: '→', tone: 'muted' },
      { text: formatUsdExpenseChunk(pendNum), tone: 'pending' },
    ],
  }
}

export type TicketBookingPayableSnap = {
  ea?: number | null
  expense?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
  payment_status?: string | null
  paid_amount?: number | null
  booking_status?: string | null
  status?: string | null
}

/** 벤더에 아직 지불해야 할 금액. 취소·결제 완료는 0 */
export function ticketBookingRemainingPayableUsd(booking: TicketBookingPayableSnap): number {
  const bs = (booking.booking_status ?? booking.status ?? '').trim().toLowerCase()
  if (bs === 'cancelled' || bs === 'canceled' || bs === 'failed' || bs === 'expired' || bs === 'weather_cancelled') return 0
  const ps = (booking.payment_status ?? '').toLowerCase()
  if (ps === 'paid' || ps === 'refunded') return 0
  const expense = getTicketBookingEffectiveExpenseUsd(booking)
  const paid = Number(booking.paid_amount ?? 0)
  const remaining = expense - (Number.isFinite(paid) ? paid : 0)
  return remaining > 0 ? Math.round(remaining * 100) / 100 : 0
}

export function sumTicketBookingsRemainingPayableUsd(
  bookings: readonly TicketBookingPayableSnap[]
): number {
  const sum = bookings.reduce((s, b) => s + ticketBookingRemainingPayableUsd(b), 0)
  return Math.round(sum * 100) / 100
}

/** 벤더에 이미 지불한 금액. 환불 완료는 0. 결제 완료인데 paid_amount가 비면 expense로 본다. */
export function ticketBookingPaidUsd(booking: TicketBookingPayableSnap): number {
  const bs = (booking.booking_status ?? booking.status ?? '').trim().toLowerCase()
  if (bs === 'cancelled' || bs === 'canceled' || bs === 'failed' || bs === 'expired') return 0
  const ps = (booking.payment_status ?? '').toLowerCase()
  if (ps === 'refunded') return 0
  const paid = Number(booking.paid_amount ?? 0)
  if (Number.isFinite(paid) && paid > 0) return Math.round(paid * 100) / 100
  if (ps === 'paid') {
    const expense = getTicketBookingEffectiveExpenseUsd(booking)
    return Number.isFinite(expense) && expense > 0 ? Math.round(expense * 100) / 100 : 0
  }
  return 0
}

export function sumTicketBookingsPaidUsd(
  bookings: readonly TicketBookingPayableSnap[]
): number {
  const sum = bookings.reduce((s, b) => s + ticketBookingPaidUsd(b), 0)
  return Math.round(sum * 100) / 100
}

export function sumTicketBookingsEffectiveExpenseUsd(
  bookings: readonly TicketBookingPayableSnap[]
): number {
  const sum = bookings.reduce((s, b) => {
    const bs = (b.booking_status ?? b.status ?? '').trim().toLowerCase()
    if (bs === 'cancelled' || bs === 'canceled' || bs === 'failed' || bs === 'expired' || bs === 'weather_cancelled') return s
    const expense = getTicketBookingEffectiveExpenseUsd(b)
    return s + (Number.isFinite(expense) ? expense : 0)
  }, 0)
  return Math.round(sum * 100) / 100
}

export function formatTicketPayableUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/** 명세 합계 대조용 — 변경 요청 중이면 표시·계산에 쓰는 예상 비용 */
export function getTicketBookingEffectiveExpenseUsd(booking: {
  ea?: number | null
  expense?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): number {
  const cs = (booking.change_status ?? 'none').toLowerCase()
  const curEa = booking.ea ?? 0
  const curNum = Number(booking.expense ?? 0)
  if (!isChangeRequested(cs) || booking.pending_ea == null || booking.pending_ea === curEa) {
    return Number.isFinite(curNum) ? curNum : 0
  }
  const unit = deriveTicketBookingUnitPriceUsd(curEa, curNum, booking.unit_price ?? null)
  const pendNum =
    unit > 0 ? Math.round(unit * booking.pending_ea * 100) / 100 : curNum
  return Number.isFinite(pendNum) ? pendNum : 0
}
