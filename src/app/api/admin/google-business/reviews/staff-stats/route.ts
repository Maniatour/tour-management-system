import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleReviewStaffStatsReadAuth } from '@/lib/googleBusinessAdminAuth'
import {
  getGoogleReviewStaffMonthlyStats,
  getGoogleReviewStaffStats,
  parseGoogleReviewStaffMonthBy,
  pivotGoogleReviewStaffMonthlyStats,
} from '@/lib/googleReviewStaffStats'

/**
 * GET /api/admin/google-business/reviews/staff-stats
 * ?view=monthly&year=2026&monthBy=review_date|tour_date
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleReviewStaffStatsReadAuth(request)
  if (!auth.ok) return auth.response

  const view = request.nextUrl.searchParams.get('view')
  const yearParam = request.nextUrl.searchParams.get('year')
  const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()
  const monthBy = parseGoogleReviewStaffMonthBy(request.nextUrl.searchParams.get('monthBy'))

  try {
    if (view === 'monthly') {
      const resolvedYear = Number.isFinite(year) ? year : new Date().getFullYear()
      const rows = await getGoogleReviewStaffMonthlyStats(
        auth.operatorId,
        resolvedYear,
        monthBy
      )
      const monthlyStats = await pivotGoogleReviewStaffMonthlyStats(rows)
      return NextResponse.json({
        ok: true,
        year: resolvedYear,
        monthBy,
        monthlyStats,
      })
    }

    const stats = await getGoogleReviewStaffStats(auth.operatorId)
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    console.error('[google-business/reviews/staff-stats]', error)
    const message = error instanceof Error ? error.message : 'staff_stats_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
