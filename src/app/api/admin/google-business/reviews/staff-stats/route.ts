import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { getGoogleReviewStaffStats } from '@/lib/googleReviewStaffStats'

/**
 * GET /api/admin/google-business/reviews/staff-stats
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  try {
    const stats = await getGoogleReviewStaffStats(auth.operatorId)
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    console.error('[google-business/reviews/staff-stats]', error)
    const message = error instanceof Error ? error.message : 'staff_stats_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
