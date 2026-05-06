import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** 비로그인 영수증 등: products RLS(비활성 상품) 우회 없이 메타만 서버에서 조회 */
const RESERVATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const reservationId = request.nextUrl.searchParams.get('reservation_id')?.trim() ?? ''
  if (!reservationId || !RESERVATION_ID_RE.test(reservationId)) {
    return NextResponse.json({ ok: false, message: 'Invalid reservation_id' }, { status: 400 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: 'Service unavailable' }, { status: 503 })
  }
  const db = supabaseAdmin

  const { data: rez, error: rezErr } = await db
    .from('reservations')
    .select(
      'id, tour_date, tour_time, adults, child, infant, total_people, customer_id, product_id, status, created_at, pickup_hotel, channel_id'
    )
    .eq('id', reservationId)
    .maybeSingle()

  if (rezErr || !rez) {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 })
  }

  const customerId = (rez as { customer_id?: string | null }).customer_id
  const productId = (rez as { product_id?: string | null }).product_id
  const pickupHotelId = (rez as { pickup_hotel?: string | null }).pickup_hotel
  const channelId = (rez as { channel_id?: string | null }).channel_id

  const [customerRes, productRes, pickupRes, channelRes] = await Promise.all([
    customerId
      ? db.from('customers').select('name, language, email, phone').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null as null }),
    productId
      ? db
          .from('products')
          .select('name_ko, name_en, customer_name_ko, customer_name_en')
          .eq('id', productId)
          .maybeSingle()
      : Promise.resolve({ data: null as null }),
    pickupHotelId
      ? db.from('pickup_hotels').select('hotel').eq('id', pickupHotelId).maybeSingle()
      : Promise.resolve({ data: null as null }),
    channelId
      ? db.from('channels').select('name').eq('id', channelId).maybeSingle()
      : Promise.resolve({ data: null as null }),
  ])

  return NextResponse.json(
    {
      ok: true,
      reservation: rez,
      customer: customerRes.data ?? null,
      product: productRes.data ?? null,
      pickupHotel: pickupRes.data ?? null,
      channel: channelRes.data ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
