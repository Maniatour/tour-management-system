import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  getStripeClient,
  STRIPE_PI_NOTE_PREFIX,
} from '@/lib/customerBookingCheckout'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'

type AdminClient = SupabaseClient<Database>

/** 투어 시작 이전 몇 시간까지 고객 셀프 무료 취소·스크립트 환불 허용 */
export function getFreeCancelHoursBeforeTour(): number {
  const raw = process.env.CUSTOMER_FREE_CANCEL_HOURS_BEFORE_TOUR
  const n = raw ? Number(raw) : 24
  return Number.isFinite(n) && n >= 0 ? n : 24
}

export function extractStripePaymentIntentIdFromNote(note: string | null | undefined): string | null {
  if (!note) return null
  const trimmed = note.trim()
  if (trimmed.startsWith(STRIPE_PI_NOTE_PREFIX)) {
    const id = trimmed.slice(STRIPE_PI_NOTE_PREFIX.length).trim()
    return id.startsWith('pi_') ? id : null
  }
  const match = trimmed.match(/pi_[A-Za-z0-9]+/)
  return match?.[0] || null
}

export function computeTourStartUtc(tourDate: string, tourTime?: string | null): Date {
  const time = (tourTime || '00:00').slice(0, 5)
  // Las Vegas local (tour ops); fallback parse as local-noon if invalid
  const iso = `${tourDate}T${time.length === 5 ? `${time}:00` : '00:00:00'}-07:00`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return new Date(`${tourDate}T12:00:00.000Z`)
  }
  return d
}

export function isWithinFreeCancelWindow(tourDate: string, tourTime?: string | null, now = new Date()): boolean {
  const hours = getFreeCancelHoursBeforeTour()
  const tourStart = computeTourStartUtc(tourDate, tourTime)
  const deadline = new Date(tourStart.getTime() - hours * 60 * 60 * 1000)
  return now.getTime() <= deadline.getTime()
}

export async function findConfirmedStripePaymentIntentId(
  admin: AdminClient,
  reservationId: string
): Promise<{ paymentIntentId: string; amountUsd: number; paymentRecordId: string } | null> {
  const { data: rows } = await admin
    .from('payment_records')
    .select('id, amount, note, payment_status, payment_method')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false })

  for (const row of rows || []) {
    const status = (row.payment_status || '').toLowerCase()
    if (status !== 'confirmed' && status !== 'paid') continue
    const pi = extractStripePaymentIntentIdFromNote(row.note)
    if (!pi) continue
    return {
      paymentIntentId: pi,
      amountUsd: Number(row.amount) || 0,
      paymentRecordId: row.id,
    }
  }
  return null
}

export async function createStripeRefundAndRecord(
  admin: AdminClient,
  args: {
    reservationId: string
    paymentIntentId: string
    amountUsd?: number | null
    confirmedBy: string
    reasonNote?: string
  }
): Promise<{ refundId: string; amountUsd: number }> {
  const stripe = getStripeClient()
  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId)
  if (pi.status !== 'succeeded') {
    throw new Error(`결제 상태가 환불 가능한 상태가 아닙니다. (${pi.status})`)
  }

  const maxCents = pi.amount_received || pi.amount
  let refundCents = maxCents
  if (args.amountUsd != null && args.amountUsd > 0) {
    refundCents = Math.round(args.amountUsd * 100)
    if (refundCents > maxCents) {
      throw new Error('환불 금액이 결제 금액을 초과합니다.')
    }
  }

  // Destination charges (Connect): reverse transfer (+ app fee) so connected balance is clawed back
  const isDestinationCharge = Boolean(
    pi.transfer_data?.destination || pi.metadata?.connect_mode === 'destination'
  )

  const refund = await stripe.refunds.create({
    payment_intent: args.paymentIntentId,
    amount: refundCents,
    reason: 'requested_by_customer',
    ...(isDestinationCharge
      ? {
          reverse_transfer: true,
          refund_application_fee: true,
        }
      : {}),
    metadata: {
      reservation_id: args.reservationId,
      source: args.confirmedBy,
      ...(isDestinationCharge ? { connect_refund: '1' } : {}),
    },
  })

  const amountUsd = Math.round(refundCents) / 100
  const operatorId = await lookupReservationOperatorId(admin, args.reservationId)
  const { error } = await admin.from('payment_records').insert({
    operator_id: operatorId,
    reservation_id: args.reservationId,
    amount: amountUsd,
    payment_method: 'card',
    payment_status: '환불됨 (우리)',
    note: `stripe_refund_id:${refund.id}; ${STRIPE_PI_NOTE_PREFIX}${args.paymentIntentId}${args.reasonNote ? `; ${args.reasonNote}` : ''}`,
    submit_by: args.confirmedBy,
    submit_on: new Date().toISOString(),
    confirmed_by: args.confirmedBy,
    confirmed_on: new Date().toISOString(),
  })
  if (error) {
    console.error('[createStripeRefundAndRecord] payment_records', error)
    throw new Error(`Stripe 환불은 처리됐으나 입금 기록 저장에 실패했습니다: ${error.message}`)
  }

  return { refundId: refund.id, amountUsd }
}
