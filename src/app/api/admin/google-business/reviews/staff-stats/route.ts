import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  getGoogleReviewStaffMonthlyStats,
  getGoogleReviewStaffStats,
  pivotGoogleReviewStaffMonthlyStats,
} from '@/lib/googleReviewStaffStats'

/**
 * GET /api/admin/google-business/reviews/staff-stats
 * ?view=monthly&year=2026
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const view = request.nextUrl.searchParams.get('view')
  const yearParam = request.nextUrl.searchParams.get('year')
  const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

  try {
    if (view === 'monthly') {
      const rows = await getGoogleReviewStaffMonthlyStats(
        auth.operatorId,
        Number.isFinite(year) ? year : new Date().getFullYear()
      )
      const monthlyStats = await pivotGoogleReviewStaffMonthlyStats(rows)
      return NextResponse.json({
        ok: true,
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
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
