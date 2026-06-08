import { NextRequest, NextResponse } from 'next/server'
import { buildPreTourContactSmsPreview } from '@/lib/buildPreTourContactSmsPreview'

/**
 * POST /api/preview-pre-tour-contact-sms
 * 투어 사전 연락 SMS 미리보기
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const locale =
      typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : null
    const bodyTemplateOverride =
      typeof body.bodyTemplate === 'string' ? body.bodyTemplate : null

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId가 필요합니다.' }, { status: 400 })
    }

    const result = await buildPreTourContactSmsPreview({
      reservationId,
      localeOverride: locale,
      bodyTemplateOverride,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (e) {
    console.error('[preview-pre-tour-contact-sms]', e)
    return NextResponse.json({ error: '미리보기 생성에 실패했습니다.' }, { status: 500 })
  }
}
