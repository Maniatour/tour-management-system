import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { getGoogleReviewSourceCounts } from '@/lib/googleReviewAdmin'
import { isReviewSource, REVIEW_SOURCE_TABS_WITH_COUNT } from '@/lib/reviewSources'

/**
 * GET /api/admin/google-business/reviews/source-counts
 * Returns total review counts per source (default: google, getyourguide, viator).
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const sourcesParam = request.nextUrl.searchParams.get('sources')
  const sources = sourcesParam
    ? sourcesParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => isReviewSource(value))
    : [...REVIEW_SOURCE_TABS_WITH_COUNT]

  try {
    const counts = await getGoogleReviewSourceCounts(auth.operatorId, sources)
    return NextResponse.json({ ok: true, counts })
  } catch (error) {
    console.error('[google-business/reviews/source-counts]', error)
    const message = error instanceof Error ? error.message : 'counts_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
