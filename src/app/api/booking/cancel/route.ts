import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findConfirmedStripePaymentIntentId } from '@/lib/customerBookingCancel'

/**
 * POST /api/booking/cancel
 * 고객 셀프 취소: 예약 ID + 이메일 소유 확인.
 * - 미결제(inquiry/pending 등, Stripe 확정 결제 없음): cancelled 가능
 * - Stripe 카드 결제 확정: 셀프 취소 불가 (환불 수수료·운영 처리 → 고객센터/Admin)
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 })
    }

    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const confirm = body.confirm === true

    if (!reservationId || !email) {
      return NextResponse.json({ error: '예약 ID와 이메일이 필요합니다.' }, { status: 400 })
    }
    if (!confirm) {
      return NextResponse.json({ error: '취소 확인이 필요합니다.' }, { status: 400 })
    }

    const { data: reservation, error } = await supabaseAdmin
      .from('reservations')
      .select('id, status, tour_date, tour_time, customer_id, product_id, event_note')
      .eq('id', reservationId)
      .maybeSingle()

    if (error || !reservation) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!reservation.customer_id) {
      return NextResponse.json({ error: '고객 정보가 없는 예약입니다.' }, { status: 400 })
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, email')
      .eq('id', reservation.customer_id)
      .maybeSingle()

    if (!customer?.email || customer.email.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }

    const status = (reservation.status || '').toLowerCase()
    if (status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyCancelled: true, reservationId })
    }
    if (status === 'completed' || status === 'deleted') {
      return NextResponse.json(
        { error: '완료된 예약은 온라인으로 취소할 수 없습니다. 고객센터로 문의해 주세요.' },
        { status: 400 }
      )
    }

    const paid = await findConfirmedStripePaymentIntentId(supabaseAdmin, reservationId)
    if (paid) {
      return NextResponse.json(
        {
          error:
            '카드(Stripe)로 결제된 예약은 온라인에서 직접 취소할 수 없습니다. 환불은 고객센터로 문의해 주세요.',
          code: 'STRIPE_PAID_NO_SELF_CANCEL',
        },
        { status: 400 }
      )
    }

    const cancelNote = 'Customer self-cancelled (unpaid / inquiry)'
    const prevNote = (reservation.event_note || '').trim()
    const nextEventNote = prevNote ? `${prevNote}\n${cancelNote}` : cancelNote

    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        event_note: nextEventNote,
      })
      .eq('id', reservationId)

    if (updateError) {
      return NextResponse.json({ error: `취소 상태 업데이트 실패: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      reservationId,
      refunded: false,
    })
  } catch (err) {
    console.error('[api/booking/cancel]', err)
    const message = err instanceof Error ? err.message : '취소 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
