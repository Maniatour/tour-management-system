/**
 * 입장권 부킹 테이블 워크플로우 — 예약/벤더 중심 노출, 변경·결제·환불 단계 규칙
 */

export type TicketBookingWorkflowSnapshot = {
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
}

/** 최초 단계: 예매 요청 · 벤더 응답 대기 (나머지 축 UI 숨김) */
export function isWorkflowInitialPhase(b: TicketBookingWorkflowSnapshot): boolean {
  const bs = (b.booking_status ?? 'requested').toLowerCase()
  const vs = (b.vendor_status ?? 'pending').toLowerCase()
  const cs = (b.change_status ?? 'none').toLowerCase()
  return bs === 'requested' && vs === 'pending' && cs === 'none'
}

/** 벤더 최초 응답 버튼 (확정 / 거절) */
export function showVendorInitialActions(b: TicketBookingWorkflowSnapshot): boolean {
  return isWorkflowInitialPhase(b)
}

/** 확정·가예약·홀드(자리 확보) + 벤더 확정일 때 수량·시간 변경 요청 가능 */
export function showChangeRequestButton(b: TicketBookingWorkflowSnapshot): boolean {
  const bs = (b.booking_status ?? '').toLowerCase()
  const vs = (b.vendor_status ?? '').toLowerCase()
  const cs = (b.change_status ?? 'none').toLowerCase()
  if (vs !== 'confirmed' || cs !== 'none') return false
  return bs === 'confirmed' || bs === 'tentative' || bs === 'on_hold'
}

/** 변경 요청 후 벤더 재응답 버튼 */
export function showVendorChangeActions(b: TicketBookingWorkflowSnapshot): boolean {
  const vs = (b.vendor_status ?? '').toLowerCase()
  const cs = (b.change_status ?? 'none').toLowerCase()
  return cs === 'requested' && vs === 'pending'
}

/** 결제 완료 처리 UI (결제 전 → 결제 완료) */
export function showPaymentCompleteButton(b: TicketBookingWorkflowSnapshot): boolean {
  const bs = (b.booking_status ?? '').toLowerCase()
  const vs = (b.vendor_status ?? '').toLowerCase()
  const ps = (b.payment_status ?? 'not_due').toLowerCase()
  if (bs === 'failed' || bs === 'cancelled') return false
  if (!showPostVendorConfirmedBooking(bs, vs)) return false
  return ps !== 'paid'
}

function showPostVendorConfirmedBooking(bs: string, vs: string): boolean {
  if (vs !== 'confirmed') return false
  return bs === 'confirmed' || bs === 'tentative'
}

/** 환불 서브 행 추가: 결제 완료 + 확정류만 */
export function showRefundLineManagement(b: TicketBookingWorkflowSnapshot): boolean {
  const bs = (b.booking_status ?? '').toLowerCase()
  const vs = (b.vendor_status ?? '').toLowerCase()
  const ps = (b.payment_status ?? '').toLowerCase()
  return (
    ps === 'paid' && vs === 'confirmed' && (bs === 'confirmed' || bs === 'tentative')
  )
}

function formatHHMM(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5)
}

/** 명시 단가 우선, 없으면 기존 총액÷수량 — 수량·시간 변경 모달과 동일 */
export function deriveTicketBookingUnitPriceUsd(
  initialEa: number,
  initialExpense: number,
  unitPrice?: number | null
): number {
  const up =
    unitPrice != null && Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null
  if (up != null) return up
  if (initialEa > 0 && initialExpense > 0) return initialExpense / initialEa
  return 0
}

function formatUsdExpenseChunk(n: number): string {
  if (!Number.isFinite(n)) return '$—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 목록 단일 표시는 기존 `$${expense}` 와 동일하게 유지 */
function formatUsdExpenseCell(exp: number | null | undefined): string {
  if (exp == null || Number.isNaN(Number(exp))) return '-'
  return `$${Number(exp)}`
}

/** 변경 요청 중 수량이 실제로 바뀐 경우 */
export function ticketBookingPendingQtyDiffers(booking: {
  ea?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): boolean {
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (cs !== 'requested' || booking.pending_ea == null) return false
  return (booking.ea ?? 0) !== booking.pending_ea
}

/** 변경 요청 중 시간이 실제로 바뀐 경우 */
export function ticketBookingPendingTimeDiffers(booking: {
  time?: string | null
  change_status?: string | null
  pending_time?: string | null
}): boolean {
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (cs !== 'requested' || booking.pending_time == null || String(booking.pending_time).trim() === '') {
    return false
  }
  return formatHHMM(booking.time) !== formatHHMM(booking.pending_time)
}

/** 변경 요청 중 비용(단가×수량 추정)이 실제로 바뀐 경우 — 수량 변경이 있을 때만 의미 있음 */
export function ticketBookingPendingExpenseDiffers(booking: {
  ea?: number | null
  expense?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): boolean {
  if (!ticketBookingPendingQtyDiffers(booking)) return false
  const curEa = booking.ea ?? 0
  const curExp = Number(booking.expense ?? 0)
  const unit = deriveTicketBookingUnitPriceUsd(curEa, curExp, booking.unit_price ?? null)
  const pendEa = booking.pending_ea ?? 0
  const pendExp = unit > 0 ? Math.round(unit * pendEa * 100) / 100 : curExp
  return Math.abs(curExp - pendExp) >= 0.005
}

export function formatQtyArrow(booking: {
  ea: number | null | undefined
  change_status?: string | null
  pending_ea?: number | null
}): string {
  const cur = booking.ea ?? 0
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (cs === 'requested' && booking.pending_ea != null && booking.pending_ea !== cur) {
    return `${cur}개 > ${booking.pending_ea}개`
  }
  return `${cur}개`
}

export function formatTimeArrow(booking: {
  time?: string | null
  change_status?: string | null
  pending_time?: string | null
}): string {
  const cur = formatHHMM(booking.time)
  const cs = (booking.change_status ?? 'none').toLowerCase()
  if (cs === 'requested' && booking.pending_time) {
    const pend = formatHHMM(booking.pending_time)
    if (pend && cur !== pend) {
      return `${cur || '—'} > ${pend}`
    }
  }
  return cur || '—'
}

/**
 * 변경 요청 중 비용 열: 수량 변경으로 추정 총액이 달라질 때만 `기존 > 신규`, 아니면 단일 표시.
 */
export function formatExpenseArrow(booking: {
  ea?: number | null
  expense?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): string {
  const cs = (booking.change_status ?? 'none').toLowerCase()
  const curEa = booking.ea ?? 0
  const curRaw = booking.expense

  if (cs !== 'requested' || booking.pending_ea == null || booking.pending_ea === curEa) {
    return formatUsdExpenseCell(curRaw as number | null | undefined)
  }

  const curNum = Number(curRaw ?? 0)
  const unit = deriveTicketBookingUnitPriceUsd(curEa, curNum, booking.unit_price ?? null)
  const pendNum =
    unit > 0 ? Math.round(unit * booking.pending_ea * 100) / 100 : curNum

  if (Math.abs(curNum - pendNum) < 0.005) {
    return formatUsdExpenseCell(curRaw as number | null | undefined)
  }

  return `${formatUsdExpenseChunk(curNum)} > ${formatUsdExpenseChunk(pendNum)}`
}

/**
 * EA당 금액(USD): (비용 − 수입) ÷ 수량. 변경 요청 중 수량·추정 비용이 바뀌면 `기존 > 신규` 형태.
 */
export function formatEaMarginUsdArrow(booking: {
  ea?: number | null
  expense?: number | null
  income?: number | null
  unit_price?: number | null
  change_status?: string | null
  pending_ea?: number | null
}): string {
  const inc = Number(booking.income ?? 0)
  if (!Number.isFinite(inc)) return '—'

  const perUnit = (exp: number, ea: number): number | null => {
    if (!Number.isFinite(ea) || ea <= 0) return null
    const e = Number(exp)
    if (!Number.isFinite(e)) return null
    return (e - inc) / ea
  }

  const cs = (booking.change_status ?? 'none').toLowerCase()
  const curEa = booking.ea ?? 0
  const curExp = Number(booking.expense ?? 0)
  const curPer = perUnit(curExp, curEa)

  if (curPer == null) return '—'

  if (cs !== 'requested' || booking.pending_ea == null || booking.pending_ea === curEa) {
    return formatUsdExpenseChunk(curPer)
  }

  const unit = deriveTicketBookingUnitPriceUsd(curEa, curExp, booking.unit_price ?? null)
  const pendExp =
    unit > 0 ? Math.round(unit * booking.pending_ea * 100) / 100 : curExp
  const pendPer = perUnit(pendExp, booking.pending_ea)

  if (pendPer == null) return formatUsdExpenseChunk(curPer)
  if (Math.abs(curPer - pendPer) < 0.0005) {
    return formatUsdExpenseChunk(curPer)
  }

  return `${formatUsdExpenseChunk(curPer)} > ${formatUsdExpenseChunk(pendPer)}`
}
