import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  createStripeRefundAndRecord,
  extractStripePaymentIntentIdFromNote,
  findConfirmedStripePaymentIntentId,
} from '@/lib/customerBookingCancel'

/**
 * POST /api/payment/stripe-refund
 * 스태프 전용 Stripe 환불 + payment_records「환불됨 (우리)」기록
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 })
    }

    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const paymentIntentIdInput =
      typeof body.paymentIntentId === 'string' ? body.paymentIntentId.trim() : ''
    const amountUsd =
      body.amountUsd === undefined || body.amountUsd === null || body.amountUsd === ''
        ? null
        : Number(body.amountUsd)

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId가 필요합니다.' }, { status: 400 })
    }
    if (amountUsd != null && (!Number.isFinite(amountUsd) || amountUsd <= 0)) {
      return NextResponse.json({ error: '유효한 환불 금액이 필요합니다.' }, { status: 400 })
    }

    let paymentIntentId = paymentIntentIdInput
    if (!paymentIntentId) {
      const found = await findConfirmedStripePaymentIntentId(supabaseAdmin, reservationId)
      paymentIntentId = found?.paymentIntentId || ''
    }
    if (!paymentIntentId && typeof body.note === 'string') {
      paymentIntentId = extractStripePaymentIntentIdFromNote(body.note) || ''
    }
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: '이 예약에 연결된 Stripe PaymentIntent를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const result = await createStripeRefundAndRecord(supabaseAdmin, {
      reservationId,
      paymentIntentId,
      amountUsd,
      confirmedBy: auth.userEmail,
      reasonNote: 'admin stripe refund',
    })

    return NextResponse.json({
      ok: true,
      refundId: result.refundId,
      amountUsd: result.amountUsd,
      paymentIntentId,
    })
  } catch (err) {
    console.error('[api/payment/stripe-refund]', err)
    const message = err instanceof Error ? err.message : '환불 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
