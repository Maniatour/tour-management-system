import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildPickupScheduleEmailPreview } from '@/lib/pickupScheduleEmailPreviewBuilder'

export const dynamic = 'force-dynamic'

/**
 * POST /api/preview-pickup-schedule-notification
 *
 * 픽업 스케줄 알림 이메일 미리보기 API (발송 없이 내용만 반환)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      reservationId,
      pickupTime,
      tourDate,
      locale: localeParam,
      tourId,
      preparationInfo: preparationInfoFromBody,
    } = body

    if (!reservationId || !pickupTime || !tourDate) {
      return NextResponse.json(
        { error: '예약 ID, 픽업 시간, 투어 날짜가 필요합니다.' },
        { status: 400 }
      )
    }

    const routeDb = supabaseAdmin ?? supabase

    const { data: reservation, error: reservationError } = await routeDb
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

    let customer = null
    if (reservation.customer_id) {
      const { data: customerData } = await routeDb
        .from('customers')
        .select('id, name, email, language')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      customer = customerData
    }

    if (!customer) {
      return NextResponse.json({ error: '고객 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    let product = null
    if (reservation.product_id) {
      const { data: productData } = await routeDb
        .from('products')
        .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
        .eq('id', reservation.product_id)
        .maybeSingle()
      product = productData
    }

    const imageProxyBaseUrl =
      (typeof request.headers.get('origin') === 'string' && request.headers.get('origin')) ||
      (typeof request.nextUrl?.origin === 'string' && request.nextUrl?.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      null

    const result = await buildPickupScheduleEmailPreview({
      reservationId,
      reservation,
      customer: {
        name: customer.name,
        email: customer.email ?? 'preview@example.com',
        language: customer.language,
      },
      product,
      pickupTime,
      tourDate,
      locale: localeParam,
      tourId,
      preparationInfoOverride: preparationInfoFromBody,
      imageProxyBaseUrl,
      db: routeDb,
    })

    const isEnglish = localeParam === 'en' || customer.language === 'en'
    const productNameForSource = product
      ? isEnglish
        ? product.customer_name_en || product.name_en || product.name
        : product.customer_name_ko || product.name_ko || product.name
      : ''

    const preparationInfoSource = reservation.product_id
      ? {
          productId: reservation.product_id,
          channelId: (reservation as { channel_id?: string | null }).channel_id ?? null,
          languageCode: isEnglish ? 'en' : 'ko',
          productName: productNameForSource,
        }
      : null

    return NextResponse.json({
      success: true,
      emailContent: result.emailContent,
      preparationInfo: result.preparationInfo,
      preparationInfoSource,
    })
  } catch (error) {
    console.error('[preview-pickup-schedule-notification] 서버 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    )
  }
}
