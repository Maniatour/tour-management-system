import { NextRequest, NextResponse } from 'next/server'
import { buildReservationOutboundSmsPreview } from '@/lib/buildReservationOutboundSmsPreview'
import { isReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'

/**
 * POST /api/preview-reservation-sms
 * 예약 카드 SMS — 카테고리별 미리보기
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const categoryId =
      typeof body.categoryId === 'string' && isReservationOutboundSmsCategoryId(body.categoryId)
        ? body.categoryId
        : null
    const locale =
      typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : null
    const bodyTemplateOverride =
      typeof body.bodyTemplate === 'string' ? body.bodyTemplate : null

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId가 필요합니다.' }, { status: 400 })
    }
    if (!categoryId) {
      return NextResponse.json({ error: '유효하지 않은 SMS 카테고리입니다.' }, { status: 400 })
    }

    const result = await buildReservationOutboundSmsPreview({
      reservationId,
      categoryId,
      localeOverride: locale,
      bodyTemplateOverride,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (e) {
    console.error('[preview-reservation-sms]', e)
    return NextResponse.json({ error: '미리보기 생성에 실패했습니다.' }, { status: 500 })
  }
}
