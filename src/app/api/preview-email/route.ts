import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildReservationEmailPreview } from '@/lib/reservationEmailPreviewBuilder'

export const dynamic = 'force-dynamic'

/**
 * POST /api/preview-email
 *
 * 예약 확인 이메일 미리보기 API (발송 없이 내용만 반환)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, type = 'both', locale: localeParam, includePriceInfo } = body

    if (!reservationId) {
      return NextResponse.json({ error: '예약 ID가 필요합니다.' }, { status: 400 })
    }

    const emailRouteDb = supabaseAdmin ?? supabase

    const { data: reservation, error: reservationError } = await emailRouteDb
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.', details: reservationError?.message },
        { status: 404 }
      )
    }

    let product = null
    if (reservation.product_id) {
      const { data: productData } = await emailRouteDb
        .from('products')
        .select(
          'id, name, name_ko, name_en, customer_name_ko, customer_name_en, duration, departure_city, arrival_city, base_price'
        )
        .eq('id', reservation.product_id)
        .maybeSingle()
      product = productData
    }

    if (!product) {
      return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    let customer = null
    if (reservation.customer_id) {
      const { data: customerData } = await emailRouteDb
        .from('customers')
        .select('id, name, email, language')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      customer = customerData
    }

    if (!customer) {
      return NextResponse.json({ error: '고객 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const result = await buildReservationEmailPreview({
      reservation,
      customer,
      product,
      type,
      locale: localeParam,
      includePriceInfo: includePriceInfo !== false,
      injectProductDetailEditMarkers: true,
      db: emailRouteDb,
    })

    return NextResponse.json({
      success: true,
      emailContent: result.emailContent,
      productDetailEdit: result.productDetailEdit,
    })
  } catch (error) {
    console.error('[preview-email] 서버 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    )
  }
}
