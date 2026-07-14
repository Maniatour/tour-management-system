import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createPendingCustomerBooking,
  parseCustomerBookingCustomer,
  parseCustomerBookingLine,
} from '@/lib/customerBookingCheckout'

/**
 * POST /api/booking/create-inquiry
 * 은행이체 등 비카드 경로: 서버에서 customers + reservation(inquiry) + pricing 생성.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '서버 설정이 완료되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const customer = parseCustomerBookingCustomer(body.customerInfo ?? body.customer)
    const line = parseCustomerBookingLine(body.line ?? body)
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode : null

    if (!customer) {
      return NextResponse.json(
        { error: '고객 이름, 이메일, 전화번호가 필요합니다.' },
        { status: 400 }
      )
    }
    if (!line) {
      return NextResponse.json(
        { error: '상품, 투어 날짜, 성인 인원이 필요합니다.' },
        { status: 400 }
      )
    }

    const pending = await createPendingCustomerBooking(supabaseAdmin, {
      customer,
      line,
      couponCode,
      status: 'inquiry',
    })

    return NextResponse.json({
      ok: true,
      reservationId: pending.reservationId,
      customerId: pending.customerId,
      amountUsd: pending.amountUsd,
      price: pending.price,
    })
  } catch (error) {
    console.error('[api/booking/create-inquiry]', error)
    const message = error instanceof Error ? error.message : '예약 문의 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
