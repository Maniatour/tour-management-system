import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { listGoogleReviewChangeLogs } from '@/lib/googleReviewChangeLog'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/google-business/reviews/[id]/history
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : 10

  try {
    const logs = await listGoogleReviewChangeLogs({
      operatorId: auth.operatorId,
      reviewId: id,
      limit: Number.isFinite(limit) ? limit : 10,
    })
    return NextResponse.json({ ok: true, logs })
  } catch (error) {
    console.error('[google-business/reviews/[id]/history]', error)
    const message = error instanceof Error ? error.message : 'list_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
