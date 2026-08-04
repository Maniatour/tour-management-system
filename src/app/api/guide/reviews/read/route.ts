import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getGuideLinkedReviews, markGuideReviewsRead } from '@/lib/guideReviews'

/**
 * POST /api/guide/reviews/read
 * Body: { reviewIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as { reviewIds?: string[] }
    const reviewIds = Array.isArray(body.reviewIds)
      ? body.reviewIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : []

    if (reviewIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 })
    }

    await markGuideReviewsRead(auth.ctx.actingEmail, reviewIds)

    const payload = await getGuideLinkedReviews(auth.ctx.actingEmail)
    return NextResponse.json({
      ok: true,
      unreadCount: payload.summary.unreadCount,
    })
  } catch (error) {
    console.error('[api/guide/reviews/read]', error)
    const message = error instanceof Error ? error.message : 'mark_read_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
