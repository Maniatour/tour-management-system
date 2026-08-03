import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { lookupReservationForReviewLink } from '@/lib/googleReviewTourLink'

/**
 * GET /api/admin/google-business/reviews/reservation-lookup?ref=GYG-12345
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const reference = request.nextUrl.searchParams.get('ref')?.trim() ?? ''
  if (!reference) {
    return NextResponse.json({ ok: false, error: 'missing_reference' }, { status: 400 })
  }

  try {
    const reservation = await lookupReservationForReviewLink({
      operatorId: auth.operatorId,
      reference,
    })

    return NextResponse.json({
      ok: true,
      found: Boolean(reservation),
      reservation,
    })
  } catch (error) {
    console.error('[google-business/reviews/reservation-lookup]', error)
    const message = error instanceof Error ? error.message : 'lookup_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
