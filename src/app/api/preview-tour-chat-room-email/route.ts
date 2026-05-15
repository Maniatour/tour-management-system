import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { resolveChatRoomCodeForReservation } from '@/lib/resolveTourChatRoomForReservation'
import { renderTourChatRoomEmailPreviewDocument } from '@/lib/tourChatRoomEmailHtml'

/**
 * POST /api/preview-tour-chat-room-email
 * Body: { reservationId: string, locale?: 'ko' | 'en', tourId?: string, tourDate?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, locale: localeParam, tourId, tourDate: tourDateParam } = body as {
      reservationId?: string
      locale?: string | null
      tourId?: string | null
      tourDate?: string | null
    }

    if (!reservationId?.trim()) {
      return NextResponse.json({ error: '예약 ID가 필요합니다.' }, { status: 400 })
    }

    const routeDb = supabaseAdmin ?? supabase
    const { data: reservation, error: reservationError } = await routeDb
      .from('reservations')
      .select('id, customer_id, product_id, tour_id, tour_date')
      .eq('id', reservationId.trim())
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }

    let customer: { language?: string | null } | null = null
    if (reservation.customer_id) {
      const { data: customerData } = await routeDb
        .from('customers')
        .select('language')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      customer = customerData
    }

    const isEnglish = resolveReservationEmailIsEnglish(customer?.language ?? null, localeParam)
    const tourDate = tourDateParam ?? reservation.tour_date ?? null

    const { tourId: resolvedTourId, chatRoomCode } = await resolveChatRoomCodeForReservation(
      routeDb,
      reservationId.trim(),
      reservation,
      { tourDate, tourId: tourId ?? null }
    )

    if (!chatRoomCode) {
      return NextResponse.json(
        {
          error: isEnglish
            ? 'No active tour chat room was found for this reservation.'
            : '이 예약에 연결된 활성 투어 채팅방을 찾을 수 없습니다.',
          tourId: resolvedTourId,
        },
        { status: 404 }
      )
    }

    const emailContent = renderTourChatRoomEmailPreviewDocument(chatRoomCode, isEnglish)

    return NextResponse.json({
      ...emailContent,
      chatRoomCode,
      tourId: resolvedTourId,
      locale: isEnglish ? 'en' : 'ko',
    })
  } catch (error) {
    console.error('[preview-tour-chat-room-email] 서버 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
