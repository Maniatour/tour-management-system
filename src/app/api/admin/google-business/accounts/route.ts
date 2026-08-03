import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  getGoogleBusinessAccessToken,
  listGoogleBusinessAccounts,
} from '@/lib/googleBusinessConnection'

/**
 * GET /api/admin/google-business/accounts
 * Lists Google Business Profile accounts for the connected operator.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  try {
    const accessToken = await getGoogleBusinessAccessToken(auth.operatorId)
    const accounts = await listGoogleBusinessAccounts(accessToken)
    return NextResponse.json({ ok: true, accounts })
  } catch (error) {
    console.error('[google-business/accounts]', error)
    const message = error instanceof Error ? error.message : 'accounts_failed'
    const status = message === 'not_connected' ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
