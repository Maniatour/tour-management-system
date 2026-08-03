import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { autoLinkGoogleReviewsToTours } from '@/lib/googleReviewTourLink'

/**
 * POST /api/admin/google-business/reviews/link-tours
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: { limit?: number } = {}
  try {
    body = (await request.json()) as { limit?: number }
  } catch {
    // optional body
  }

  try {
    const result = await autoLinkGoogleReviewsToTours({
      operatorId: auth.operatorId,
      limit: body.limit ?? 300,
      linkedByEmail: auth.userEmail,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[google-business/reviews/link-tours]', error)
    const message = error instanceof Error ? error.message : 'link_tours_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
