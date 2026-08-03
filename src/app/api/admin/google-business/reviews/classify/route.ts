import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { autoApproveFiveStarPendingReviews } from '@/lib/googleReviewImport'
import { classifyUnmappedGoogleReviews } from '@/lib/googleReviewClassification'
import { autoLinkGoogleReviewsToTours } from '@/lib/googleReviewTourLink'

/**
 * POST /api/admin/google-business/reviews/classify
 * Runs keyword classification on unmapped reviews.
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
    const result = await classifyUnmappedGoogleReviews({
      operatorId: auth.operatorId,
      classifiedBy: auth.userEmail,
      limit: body.limit ?? 200,
    })
    const autoApproved = await autoApproveFiveStarPendingReviews({
      operatorId: auth.operatorId,
    })
    const tourLinks = await autoLinkGoogleReviewsToTours({
      operatorId: auth.operatorId,
      limit: body.limit ?? 300,
      linkedByEmail: auth.userEmail,
    })
    return NextResponse.json({ ok: true, ...result, autoApproved, tourLinks })
  } catch (error) {
    console.error('[google-business/reviews/classify]', error)
    const message = error instanceof Error ? error.message : 'classify_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
