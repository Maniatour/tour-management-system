import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { getGoogleBusinessConnectionStatus } from '@/lib/googleBusinessConnection'
import { getGoogleReviewStats } from '@/lib/googleReviewAdmin'

/**
 * GET /api/admin/google-business/status
 * Returns connection status without exposing tokens.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const status = await getGoogleBusinessConnectionStatus(auth.operatorId)
  const stats = await getGoogleReviewStats(auth.operatorId)

  return NextResponse.json({
    ok: true,
    ...status,
    reviewStats: stats,
  })
}
