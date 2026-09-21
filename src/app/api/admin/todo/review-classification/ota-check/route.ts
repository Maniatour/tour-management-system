import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { upsertOtaReviewManualCheck } from '@/lib/otaReviewManualChecks'
import {
  isReviewClassificationOtaSource,
  type OtaReviewManualCheckStatus,
} from '@/lib/reviewClassificationTodo'

type Body = {
  source?: string
  status?: string
}

/**
 * POST /api/admin/todo/review-classification/ota-check
 * Mark an OTA channel as no-review or follow-up.
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const source = (body.source || '').trim().toLowerCase()
  const status = (body.status || '').trim() as OtaReviewManualCheckStatus
  if (!isReviewClassificationOtaSource(source)) {
    return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 })
  }
  if (status !== 'no_review' && status !== 'follow_up') {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  try {
    const check = await upsertOtaReviewManualCheck({
      operatorId: auth.operatorId,
      source,
      status,
      checkedByEmail: auth.userEmail,
    })
    return NextResponse.json({ ok: true, check })
  } catch (error) {
    console.error('[todo/review-classification/ota-check]', error)
    const message = error instanceof Error ? error.message : 'check_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
