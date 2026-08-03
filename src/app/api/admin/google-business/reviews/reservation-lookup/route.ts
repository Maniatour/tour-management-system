import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { checkOtaReviewAlreadyImported } from '@/lib/otaReviewDedup'
import { lookupReservationForReviewLinkWithTour } from '@/lib/googleReviewTourLink'
import { isOtaReviewSource } from '@/lib/reviewSources'

/**
 * GET /api/admin/google-business/reviews/reservation-lookup?ref=GYG7VKVXF253&source=getyourguide
 * RN#(channel_rn)으로 예약 → 고객명, 상품, 투어 ID 조회
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const reference = request.nextUrl.searchParams.get('ref')?.trim() ?? ''
  if (!reference) {
    return NextResponse.json({ ok: false, error: 'missing_reference' }, { status: 400 })
  }

  const sourceParam = request.nextUrl.searchParams.get('source')?.trim().toLowerCase() ?? ''

  try {
    const [result, duplicateCheck] = await Promise.all([
      lookupReservationForReviewLinkWithTour({
        operatorId: auth.operatorId,
        reference,
      }),
      isOtaReviewSource(sourceParam)
        ? checkOtaReviewAlreadyImported({
            operatorId: auth.operatorId,
            source: sourceParam,
            reservationNumber: reference,
          })
        : Promise.resolve({ exists: false, reviewId: null }),
    ])

    return NextResponse.json({
      ok: true,
      found: Boolean(result.reservation),
      reservation: result.reservation,
      suggestedTour: result.suggestedTour,
      alreadyImported: duplicateCheck.exists,
      existingReviewId: duplicateCheck.reviewId,
    })
  } catch (error) {
    console.error('[google-business/reviews/reservation-lookup]', error)
    const message = error instanceof Error ? error.message : 'lookup_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
