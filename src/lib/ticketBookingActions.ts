import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export const TICKET_BOOKING_ACTION_IDS = [
  'request_booking',
  'mark_tentative',
  'confirm_booking',
  'request_change',
  'confirm_change',
  'request_payment',
  'mark_paid',
  'request_refund',
  'mark_credit_received',
  'mark_refunded',
  'report_issue',
] as const

export type TicketBookingActionId = (typeof TICKET_BOOKING_ACTION_IDS)[number]

export type TicketBookingAxisSnapshot = {
  booking_status?: string | null | undefined
  vendor_status?: string | null | undefined
  change_status?: string | null | undefined
  payment_status?: string | null | undefined
  refund_status?: string | null | undefined
  operation_status?: string | null | undefined
}

/**
 * 현재 스냅샷 기준으로 노출할 액션(보수적 규칙 — 필요 시 조정)
 */
export function getSuggestedTicketBookingActions(b: TicketBookingAxisSnapshot): TicketBookingActionId[] {
  const bs = (b.booking_status ?? 'requested').toLowerCase()
  const vs = (b.vendor_status ?? 'pending').toLowerCase()
  const cs = (b.change_status ?? 'none').toLowerCase()
  const ps = (b.payment_status ?? 'not_due').toLowerCase()
  const rs = (b.refund_status ?? 'none').toLowerCase()

  const out: TicketBookingActionId[] = []

  if ((bs === 'requested' || bs === 'on_hold') && vs === 'pending') {
    out.push('mark_tentative')
  }
  if (bs === 'tentative' || bs === 'on_hold') {
    out.push('confirm_booking')
  }
  if (bs === 'confirmed' && cs === 'none') {
    out.push('request_change')
  }
  if (cs === 'requested') {
    out.push('confirm_change')
  }
  if (bs === 'confirmed' && (ps === 'not_due' || ps === 'failed')) {
    out.push('request_payment')
  }
  if (ps === 'requested') {
    out.push('mark_paid')
  }
  if ((ps === 'paid' || ps === 'partially_paid') && rs === 'none') {
    out.push('request_refund')
  }
  if (rs === 'requested') {
    out.push('mark_credit_received', 'mark_refunded')
  }

  out.push('report_issue')

  return [...new Set(out)]
}

const ACTION_LABEL_KO: Record<string, string> = {
  request_booking: '예매 요청',
  mark_tentative: '가예약 처리',
  confirm_booking: '확정 처리',
  request_change: '변경 요청',
  confirm_change: '변경 확정',
  request_payment: '결제 요청',
  mark_paid: '결제 완료',
  request_refund: '환불 요청',
  mark_credit_received: '크레딧 받음',
  mark_refunded: '환불 완료',
  report_issue: '문제 발생 기록',
}

export function ticketBookingActionLabelKo(action: string): string {
  return ACTION_LABEL_KO[action] ?? action
}

export type ApplyTicketBookingActionResult = {
  ok: boolean
  error?: string
  data?: Json
}

/**
 * DB RPC `apply_ticket_booking_action` 호출
 */
export async function applyTicketBookingAction(
  bookingId: string,
  action: string,
  payload: Record<string, unknown> = {},
  actorEmail?: string | null
): Promise<ApplyTicketBookingActionResult> {
  const { data, error } = await supabase.rpc('apply_ticket_booking_action', {
    p_booking_id: bookingId,
    p_action: action,
    p_payload: payload as Json,
    p_actor: actorEmail ?? null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data as Json }
}

export type TicketBookingAxisPatch = {
  booking_status: string
  vendor_status: string
  change_status: string
  payment_status: string
  refund_status: string
  operation_status: string
}

/**
 * 6축 일괄 설정 → 레거시 status 파생 — DB RPC `apply_ticket_booking_action`(p_action = `set_axes`)
 */
export async function applyTicketBookingSetAxes(
  bookingId: string,
  patch: TicketBookingAxisPatch,
  actorEmail?: string | null
): Promise<ApplyTicketBookingActionResult> {
  const { data, error } = await supabase.rpc('apply_ticket_booking_action', {
    p_booking_id: bookingId,
    p_action: 'set_axes',
    p_payload: patch as unknown as Json,
    p_actor: actorEmail ?? null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data as Json }
}

/** 테이블 워크플로우 전용 RPC 액션 (마이그레이션 `20260609120000_ticket_booking_workflow`) */
export async function applyTicketBookingWorkflowAction(
  bookingId: string,
  action:
    | 'workflow_vendor_confirm_initial'
    | 'workflow_vendor_reject_initial'
    | 'workflow_submit_change'
    | 'workflow_vendor_confirm_change'
    | 'workflow_vendor_reject_change'
    | 'workflow_complete_payment',
  payload: Record<string, unknown> = {},
  actorEmail?: string | null
): Promise<ApplyTicketBookingActionResult> {
  return applyTicketBookingAction(bookingId, action, payload, actorEmail)
}
