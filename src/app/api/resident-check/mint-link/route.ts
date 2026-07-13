import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mintResidentCheckTokenForReservation } from '@/lib/mintResidentCheckToken'

/**
 * POST /api/resident-check/mint-link
 * Body: { reservationId: string, locale?: 'ko' | 'en' }
 * HTML 복사·수동 발송용 고객 개인 링크 생성 (이메일 발송 API와 동일한 토큰 방식).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, locale: localeParam } = body as {
      reservationId?: string
      locale?: string | null
    }

    if (!reservationId?.trim()) {
      return NextResponse.json({ error: '예약 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('id', reservationId.trim())
      .maybeSingle()

    if (error || !reservation) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }

    const emailLocalePath = localeParam === 'en' ? 'en' : 'ko'
    const minted = await mintResidentCheckTokenForReservation({
      reservationId: reservationId.trim(),
      emailLocalePath,
    })

    if (!minted?.absoluteUrl) {
      return NextResponse.json(
        { error: '고객 링크를 생성할 수 없습니다. 서버 설정을 확인해 주세요.' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      absoluteUrl: minted.absoluteUrl,
    })
  } catch (e) {
    console.error('resident-check/mint-link', e)
    return NextResponse.json({ error: '링크 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
