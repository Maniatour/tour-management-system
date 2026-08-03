import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { getAdminGoogleReviewById, updateGoogleReviewStatus } from '@/lib/googleReviewAdmin'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected', 'hidden'])

/**
 * GET /api/admin/google-business/reviews/[id]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireGoogleBusinessAdminAuth(_request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
  }

  try {
    const review = await getAdminGoogleReviewById(auth.operatorId, id)
    if (!review) {
      return NextResponse.json({ ok: false, error: 'review_not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    console.error('[google-business/reviews/[id]] GET', error)
    const message = error instanceof Error ? error.message : 'get_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/google-business/reviews/[id]
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
  }

  let body: {
    importStatus?: string
    productId?: string | null
    tourId?: string | null
    excludeStaffRating?: boolean
  }
  try {
    body = (await request.json()) as {
      importStatus?: string
      productId?: string | null
      tourId?: string | null
      excludeStaffRating?: boolean
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (body.importStatus && !VALID_STATUSES.has(body.importStatus)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  try {
    await updateGoogleReviewStatus({
      operatorId: auth.operatorId,
      reviewId: id,
      ...(body.importStatus ? { importStatus: body.importStatus } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.tourId !== undefined ? { tourId: body.tourId } : {}),
      ...(body.excludeStaffRating !== undefined ? { excludeStaffRating: body.excludeStaffRating } : {}),
      updatedByEmail: auth.userEmail,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[google-business/reviews/[id]]', error)
    const message = error instanceof Error ? error.message : 'update_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
