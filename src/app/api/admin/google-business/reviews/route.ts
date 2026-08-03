import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { getGoogleReviewStats, listAdminGoogleReviews } from '@/lib/googleReviewAdmin'

/**
 * GET /api/admin/google-business/reviews
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const status = request.nextUrl.searchParams.get('status')
  const productId = request.nextUrl.searchParams.get('product_id')
  const reviewSource = request.nextUrl.searchParams.get('source')
  const unclassifiedOnly = request.nextUrl.searchParams.get('unclassified') === '1'
  const page = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10)

  try {
    const [{ reviews, total }, stats] = await Promise.all([
      listAdminGoogleReviews({
        operatorId: auth.operatorId,
        status: status || null,
        productId: productId || null,
        unclassifiedOnly,
        reviewSource: reviewSource || null,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 20,
      }),
      getGoogleReviewStats(auth.operatorId, reviewSource || null),
    ])

    return NextResponse.json({
      ok: true,
      reviews,
      total,
      page: Number.isFinite(page) ? page : 1,
      stats,
    })
  } catch (error) {
    console.error('[google-business/reviews]', error)
    const message = error instanceof Error ? error.message : 'list_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
