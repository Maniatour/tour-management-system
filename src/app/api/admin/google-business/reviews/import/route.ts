import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { importGoogleBusinessReviewsPage } from '@/lib/googleReviewImport'
import { isGoogleBusinessTokenExpiredError } from '@/lib/googleBusinessOAuth'

export const maxDuration = 60

/**
 * POST /api/admin/google-business/reviews/import
 * Imports one page (up to 50) of GBP reviews. Client loops with pageToken until done.
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: { pageToken?: string | null } = {}
  try {
    body = (await request.json()) as { pageToken?: string | null }
  } catch {
    // empty body is fine for first page
  }

  try {
    const result = await importGoogleBusinessReviewsPage({
      operatorId: auth.operatorId,
      pageToken: body.pageToken ?? null,
      classifiedBy: auth.userEmail,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[google-business/reviews/import]', error)
    const message = error instanceof Error ? error.message : 'import_failed'
    const status =
      message === 'location_not_selected' || message === 'not_connected'
        ? 400
        : isGoogleBusinessTokenExpiredError(message)
          ? 401
          : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
