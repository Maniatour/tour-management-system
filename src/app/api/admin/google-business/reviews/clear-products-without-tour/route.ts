import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { clearReviewProductsWithoutTourLink } from '@/lib/googleReviewAdmin'

/**
 * POST /api/admin/google-business/reviews/clear-products-without-tour
 * 투어 미연결 리뷰의 상품 분류를 모두 제거
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  try {
    const result = await clearReviewProductsWithoutTourLink(auth.operatorId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[google-business/reviews/clear-products-without-tour]', error)
    const message = error instanceof Error ? error.message : 'clear_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
