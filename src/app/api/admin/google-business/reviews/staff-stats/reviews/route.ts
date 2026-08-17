import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleReviewStaffStatsReadAuth } from '@/lib/googleBusinessAdminAuth'
import {
  getGoogleReviewStaffStatReviews,
  parseGoogleReviewStaffMonthBy,
} from '@/lib/googleReviewStaffStats'

/**
 * GET /api/admin/google-business/reviews/staff-stats/reviews
 * ?staffEmail=...&rating=5&year=2026&month=8&monthBy=review_date|tour_date
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleReviewStaffStatsReadAuth(request)
  if (!auth.ok) return auth.response

  const staffEmail = request.nextUrl.searchParams.get('staffEmail')?.trim() ?? ''
  const rating = Number.parseInt(request.nextUrl.searchParams.get('rating') ?? '', 10)
  const yearParam = request.nextUrl.searchParams.get('year')
  const monthParam = request.nextUrl.searchParams.get('month')
  const monthBy = parseGoogleReviewStaffMonthBy(request.nextUrl.searchParams.get('monthBy'))

  if (!staffEmail || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 })
  }

  const year = yearParam ? Number.parseInt(yearParam, 10) : null
  const month = monthParam ? Number.parseInt(monthParam, 10) : null

  try {
    const reviews = await getGoogleReviewStaffStatReviews({
      operatorId: auth.operatorId,
      staffEmail,
      rating,
      year: year != null && Number.isFinite(year) ? year : null,
      month: month != null && Number.isFinite(month) ? month : null,
      monthBy,
    })

    return NextResponse.json({ ok: true, reviews })
  } catch (error) {
    console.error('[google-business/reviews/staff-stats/reviews]', error)
    const message = error instanceof Error ? error.message : 'staff_stat_reviews_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
