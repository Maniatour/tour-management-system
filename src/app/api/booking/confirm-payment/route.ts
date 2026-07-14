import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { finalizeCustomerBookingPayment } from '@/lib/customerBookingCheckout'

/**
 * POST /api/booking/confirm-payment
 * Stripe PaymentIntent 성공 여부를 서버에서 재검증한 뒤 예약을 confirmed로 확정합니다.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '서버 결제 설정이 완료되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const paymentIntentId =
      typeof body.paymentIntentId === 'string' ? body.paymentIntentId.trim() : ''
    const locale = body.locale === 'ko' || body.locale === 'en' ? body.locale : 'en'
    const origin =
      typeof body.origin === 'string'
        ? body.origin
        : request.headers.get('origin') || undefined

    if (!reservationId || !paymentIntentId) {
      return NextResponse.json(
        { error: 'reservationId와 paymentIntentId가 필요합니다.' },
        { status: 400 }
      )
    }

    const result = await finalizeCustomerBookingPayment(supabaseAdmin, {
      reservationId,
      paymentIntentId,
      locale,
      origin: origin || undefined,
    })

    return NextResponse.json({
      ok: true,
      alreadyFinalized: result.alreadyFinalized,
      reservationId: result.reservationId,
    })
  } catch (error) {
    console.error('[api/booking/confirm-payment]', error)
    const message = error instanceof Error ? error.message : '결제 확정 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
