import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  searchNearbyToursForGoogleReviewLink,
  searchToursForGoogleReviewLink,
} from '@/lib/googleReviewTourLink'

/**
 * GET /api/admin/google-business/reviews/tours-search
 * mode=nearby — (review_date - day_range) through review_date in Las Vegas TZ
 * mode=search — tour_date, customer_name, q filters
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const mode = request.nextUrl.searchParams.get('mode') ?? 'search'
  const tourDate = request.nextUrl.searchParams.get('tour_date')
  const reviewDate = request.nextUrl.searchParams.get('review_date')
  const productId = request.nextUrl.searchParams.get('product_id')
  const includeTourId = request.nextUrl.searchParams.get('include_tour_id')
  const query = request.nextUrl.searchParams.get('q')
  const customerName = request.nextUrl.searchParams.get('customer_name')
  const dayRange = Number.parseInt(request.nextUrl.searchParams.get('day_range') ?? '3', 10)

  try {
    if (mode === 'nearby') {
      const tours = await searchNearbyToursForGoogleReviewLink({
        operatorId: auth.operatorId,
        reviewDate,
        productId,
        includeTourId,
        dayRange: Number.isFinite(dayRange) ? dayRange : 3,
        limit: 30,
      })
      return NextResponse.json({ ok: true, tours })
    }

    const tours = await searchToursForGoogleReviewLink({
      operatorId: auth.operatorId,
      tourDate,
      query,
      customerName,
      productId,
      limit: 30,
    })
    return NextResponse.json({ ok: true, tours })
  } catch (error) {
    console.error('[google-business/reviews/tours-search]', error)
    const message = error instanceof Error ? error.message : 'tour_search_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
