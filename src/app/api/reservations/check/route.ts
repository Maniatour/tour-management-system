import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fetchReservationOptionsLegacyByReservationId } from '@/lib/fetchReservationOptionsLegacy'
import { findConfirmedStripePaymentIntentId } from '@/lib/customerBookingCancel'

/**
 * POST /api/reservations/check
 * 고객용 예약 조회 — reservation id + customers.email 소유 확인
 */
export async function POST(request: NextRequest) {
  try {
    const db = supabaseAdmin ?? supabase
    const body = await request.json()
    const reservationId =
      typeof body.reservation_id === 'string'
        ? body.reservation_id.trim()
        : typeof body.reservationId === 'string'
          ? body.reservationId.trim()
          : ''
    const customerEmail =
      typeof body.customer_email === 'string'
        ? body.customer_email.trim().toLowerCase()
        : typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : ''

    if (!reservationId || !customerEmail) {
      return NextResponse.json(
        { error: '예약 ID와 고객 이메일을 입력해주세요' },
        { status: 400 }
      )
    }

    const { data: reservation, error } = await db
      .from('reservations')
      .select(
        `
        id,
        status,
        tour_date,
        tour_time,
        adults,
        child,
        infant,
        total_people,
        event_note,
        pickup_hotel,
        created_at,
        customer_id,
        product_id
      `
      )
      .eq('id', reservationId)
      .maybeSingle()

    if (error || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다. 예약 ID와 이메일을 확인해주세요.' },
        { status: 404 }
      )
    }

    if (!reservation.customer_id) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다. 예약 ID와 이메일을 확인해주세요.' },
        { status: 404 }
      )
    }

    const { data: customer } = await db
      .from('customers')
      .select('id, name, email, phone, language, special_requests')
      .eq('id', reservation.customer_id)
      .maybeSingle()

    if (!customer?.email || customer.email.trim().toLowerCase() !== customerEmail) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다. 예약 ID와 이메일을 확인해주세요.' },
        { status: 404 }
      )
    }

    const [{ data: product }, { data: pricing }, { data: paymentRecords }] = await Promise.all([
      reservation.product_id
        ? db
            .from('products')
            .select(
              'id, name, name_ko, customer_name_ko, customer_name_en, base_price, duration, max_participants, departure_city, arrival_city, departure_country, arrival_country'
            )
            .eq('id', reservation.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from('reservation_pricing')
        .select('total_price, coupon_code, coupon_discount')
        .eq('reservation_id', reservationId)
        .maybeSingle(),
      db
        .from('payment_records')
        .select('id, payment_status, amount, payment_method, submit_on, confirmed_on, note')
        .eq('reservation_id', reservationId)
        .order('submit_on', { ascending: false }),
    ])

    const optionsClient = supabaseAdmin ?? supabase
    const reservation_options = await fetchReservationOptionsLegacyByReservationId(
      optionsClient,
      reservationId
    )

    const stripePaid = await findConfirmedStripePaymentIntentId(db, reservationId)
    const statusOk = ['inquiry', 'pending', 'confirmed'].includes(
      (reservation.status || '').toLowerCase()
    )

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        status: reservation.status,
        tour_date: reservation.tour_date,
        departure_time: reservation.tour_time,
        adults: reservation.adults ?? 0,
        children: reservation.child ?? 0,
        infants: reservation.infant ?? 0,
        total_people: reservation.total_people,
        total_price: Number(pricing?.total_price) || 0,
        special_requests: customer.special_requests || null,
        nationality: null,
        created_at: reservation.created_at,
        customer_name: customer.name || '',
        customer_email: customer.email || '',
        customer_phone: customer.phone || '',
        product: product || {
          id: reservation.product_id,
          name: '',
          name_ko: null,
          customer_name_ko: '',
          customer_name_en: '',
          base_price: 0,
          duration: null,
          max_participants: null,
          departure_city: null,
          arrival_city: null,
          departure_country: null,
          arrival_country: null,
        },
        reservation_options,
        payment_records: paymentRecords || [],
        coupon_code: pricing?.coupon_code || null,
        /** Stripe 결제 확정 건은 셀프 취소 불가 */
        can_self_cancel: statusOk && !stripePaid,
        has_stripe_payment: Boolean(stripePaid),
      },
    })
  } catch (error) {
    console.error('예약 확인 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

/**
 * PATCH — 보안상 비활성화.
 * 고객 취소는 POST /api/booking/cancel 을 사용하세요.
 */
export async function PATCH() {
  return NextResponse.json(
    {
      error: '이 엔드포인트는 더 이상 사용할 수 없습니다. /api/booking/cancel 을 사용하세요.',
      code: 'PATCH_DISABLED',
    },
    { status: 405 }
  )
}
