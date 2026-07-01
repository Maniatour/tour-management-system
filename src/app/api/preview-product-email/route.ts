import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  buildReservationEmailPreview,
  resolveProductEmailPreviewContext,
  type ReservationEmailPreviewType,
} from '@/lib/reservationEmailPreviewBuilder'
import {
  buildPickupScheduleEmailPreview,
  resolvePickupPreviewTimes,
} from '@/lib/pickupScheduleEmailPreviewBuilder'
import {
  mapEmailKeyToPreviewType,
  type ProductEmailDestinationKey,
} from '@/lib/productEmailDestinations'

export const dynamic = 'force-dynamic'

/**
 * POST /api/preview-product-email
 *
 * 상품 편집 화면용 — 예약 없이도 샘플 데이터로 이메일 미리보기
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productId,
      emailType,
      locale: localeParam = 'ko',
    } = body as {
      productId?: string
      emailType?: ProductEmailDestinationKey
      locale?: 'ko' | 'en'
    }

    if (!productId) {
      return NextResponse.json({ error: '상품 ID가 필요합니다.' }, { status: 400 })
    }

    if (!emailType) {
      return NextResponse.json({ error: '이메일 유형이 필요합니다.' }, { status: 400 })
    }

    const emailRouteDb = supabaseAdmin ?? supabase
    const locale = localeParam === 'en' ? 'en' : 'ko'
    const ctx = await resolveProductEmailPreviewContext(productId, locale, emailRouteDb)

    if (emailType === 'pickup_notification') {
      const { tourDate, pickupTime } = resolvePickupPreviewTimes(ctx.reservation)
      const imageProxyBaseUrl =
        (typeof request.headers.get('origin') === 'string' && request.headers.get('origin')) ||
        (typeof request.nextUrl?.origin === 'string' && request.nextUrl?.origin) ||
        process.env.NEXT_PUBLIC_APP_URL ||
        null

      const result = await buildPickupScheduleEmailPreview({
        reservationId: String(ctx.reservation.id),
        reservation: ctx.reservation,
        customer: ctx.customer,
        product: ctx.product,
        pickupTime,
        tourDate,
        locale,
        useSamplePickupFallback: ctx.usedSampleData,
        imageProxyBaseUrl,
        db: emailRouteDb,
      })

      return NextResponse.json({
        success: true,
        usedSampleData: ctx.usedSampleData,
        emailContent: result.emailContent,
      })
    }

    const previewType = mapEmailKeyToPreviewType(emailType)
    if (!previewType) {
      return NextResponse.json(
        { error: '지원하지 않는 이메일 유형입니다.' },
        { status: 400 }
      )
    }

    const result = await buildReservationEmailPreview({
      reservation: ctx.reservation,
      customer: ctx.customer,
      product: ctx.product,
      type: previewType as ReservationEmailPreviewType,
      locale,
      injectProductDetailEditMarkers: false,
      db: emailRouteDb,
    })

    return NextResponse.json({
      success: true,
      usedSampleData: ctx.usedSampleData,
      emailContent: result.emailContent,
    })
  } catch (error) {
    console.error('[preview-product-email] 서버 오류:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    )
  }
}
