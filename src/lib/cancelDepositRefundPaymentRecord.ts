/**
 * 취소 예약 보증금 반환(파트너) 입금 라인 — 결제 상태·결제 방법·금액 자동 채움
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isReturnedPaymentStatus } from '@/utils/reservationPricingBalance'

const PARTNER_REFUND_STATUS = '환불됨 (파트너)'
export const CANCEL_DEPOSIT_REFUND_NOTE_AUTO = '자동: 취소 시 보증금 반환 (파트너)'
export const CANCEL_DEPOSIT_REFUND_NOTE_MANUAL = '수동: 취소 보증금 반환 (파트너)'

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

/** DB `payment_methods`: Partner Received + transfer (표시: Partner Received (transfer)) */
export async function resolvePartnerReceivedTransferPaymentMethodRef(
  client: SupabaseClient
): Promise<string> {
  const { data: exact } = await client
    .from('payment_methods')
    .select('id')
    .eq('method', 'Partner Received')
    .eq('method_type', 'transfer')
    .limit(1)
    .maybeSingle()

  if (exact && (exact as { id?: string }).id) {
    return String((exact as { id: string }).id)
  }

  const { data: loose } = await client
    .from('payment_methods')
    .select('id, method')
    .eq('method_type', 'transfer')
    .ilike('method', '%Partner Received%')
    .limit(1)
    .maybeSingle()

  if (loose && (loose as { id?: string }).id) {
    return String((loose as { id: string }).id)
  }

  return 'Partner Received'
}

export async function reservationHasPartnerReturnedRefundLine(
  client: SupabaseClient,
  reservationId: string
): Promise<boolean> {
  const { data, error } = await client
    .from('payment_records')
    .select('payment_status')
    .eq('reservation_id', reservationId)

  if (error || !data?.length) return false

  for (const row of data) {
    if (isReturnedPaymentStatus(String((row as { payment_status?: string }).payment_status ?? ''))) {
      return true
    }
  }
  return false
}

export async function fetchReservationDepositAmountUsd(
  client: SupabaseClient,
  reservationId: string
): Promise<number> {
  const { data } = await client
    .from('reservation_pricing')
    .select('deposit_amount')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  return Math.round(toNum((data as { deposit_amount?: unknown } | null)?.deposit_amount) * 100) / 100
}

export async function insertCancelDepositRefundPaymentRecord(opts: {
  supabase: SupabaseClient
  reservationId: string
  amountUsd: number
  note?: string | null
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { supabase, reservationId, amountUsd } = opts
  const rounded = Math.round(amountUsd * 100) / 100
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return { ok: true, skipped: true }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) {
    return { ok: false, error: '인증이 필요합니다.' }
  }

  const payment_method = await resolvePartnerReceivedTransferPaymentMethodRef(supabase)

  const response = await fetch('/api/payment-records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reservation_id: reservationId,
      payment_status: PARTNER_REFUND_STATUS,
      amount: rounded,
      payment_method,
      note: opts.note ?? CANCEL_DEPOSIT_REFUND_NOTE_MANUAL,
    }),
  })

  if (!response.ok) {
    let msg = '입금 내역을 추가할 수 없습니다.'
    try {
      const j = await response.json()
      if (typeof j?.error === 'string') msg = j.error
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg }
  }

  return { ok: true }
}
