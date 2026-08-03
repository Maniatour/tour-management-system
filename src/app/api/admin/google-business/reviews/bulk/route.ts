import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { bulkUpdateGoogleReviewStatus } from '@/lib/googleReviewAdmin'

const VALID_ACTIONS = {
  approve: 'approved',
  reject: 'rejected',
  hide: 'hidden',
  pending: 'pending',
} as const

/**
 * POST /api/admin/google-business/reviews/bulk
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: { ids?: string[]; action?: keyof typeof VALID_ACTIONS }
  try {
    body = (await request.json()) as { ids?: string[]; action?: keyof typeof VALID_ACTIONS }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const ids = (body.ids ?? []).filter(Boolean)
  const action = body.action
  if (!ids.length || !action || !(action in VALID_ACTIONS)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const updated = await bulkUpdateGoogleReviewStatus({
      operatorId: auth.operatorId,
      reviewIds: ids,
      importStatus: VALID_ACTIONS[action],
      updatedByEmail: auth.userEmail,
    })
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('[google-business/reviews/bulk]', error)
    const message = error instanceof Error ? error.message : 'bulk_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
