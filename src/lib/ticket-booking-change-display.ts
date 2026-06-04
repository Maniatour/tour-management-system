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
