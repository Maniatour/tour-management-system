import { NextRequest, NextResponse } from 'next/server'
import { buildGuideScheduleConfirmPreview } from '@/lib/guideScheduleConfirmMessage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tourId = typeof body.tourId === 'string' ? body.tourId.trim() : ''
    const locale = typeof body.locale === 'string' ? body.locale.trim() : 'ko'

    if (!tourId) {
      return NextResponse.json({ error: 'tourId가 필요합니다.' }, { status: 400 })
    }

    const result = await buildGuideScheduleConfirmPreview(tourId, locale)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (e) {
    console.error('[guide-schedule-confirm/preview]', e)
    return NextResponse.json({ error: '미리보기 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
