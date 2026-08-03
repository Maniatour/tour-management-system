import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { listGoogleReviewChangeLogs } from '@/lib/googleReviewChangeLog'

/**
 * GET /api/admin/google-business/reviews/change-logs
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : 20

  try {
    const logs = await listGoogleReviewChangeLogs({
      operatorId: auth.operatorId,
      limit: Number.isFinite(limit) ? limit : 20,
    })
    return NextResponse.json({ ok: true, logs })
  } catch (error) {
    console.error('[google-business/reviews/change-logs]', error)
    const message = error instanceof Error ? error.message : 'list_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
