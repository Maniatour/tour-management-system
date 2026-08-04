import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getGuideLinkedReviews } from '@/lib/guideReviews'

/**
 * GET /api/guide/reviews
 * Returns linked approved reviews and summary stats for the logged-in guide.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const payload = await getGuideLinkedReviews(auth.ctx.actingEmail)
    return NextResponse.json({ ok: true, ...payload })
  } catch (error) {
    console.error('[api/guide/reviews]', error)
    const message = error instanceof Error ? error.message : 'guide_reviews_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
