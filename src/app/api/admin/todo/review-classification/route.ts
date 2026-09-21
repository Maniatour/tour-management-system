import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { loadReviewClassificationQueue } from '@/lib/reviewClassificationQueue'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { reviewClassificationWorkCount } from '@/lib/reviewClassificationTodo'

/**
 * GET /api/admin/todo/review-classification
 * Unclassified Google reviews without a tour, plus OTA manual-check status.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  try {
    const queue = await loadReviewClassificationQueue(auth.operatorId)
    const todayKey = todayInLasVegas()
    return NextResponse.json({
      ok: true,
      todayKey,
      googleReviews: queue.googleReviews,
      platforms: queue.platforms,
      workCount: reviewClassificationWorkCount(
        queue.googleReviews.length,
        queue.platforms,
        todayKey
      ),
    })
  } catch (error) {
    console.error('[todo/review-classification]', error)
    const message = error instanceof Error ? error.message : 'queue_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
