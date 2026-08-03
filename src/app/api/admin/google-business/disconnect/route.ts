import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import { deleteGoogleBusinessConnection } from '@/lib/googleBusinessConnection'

/**
 * POST /api/admin/google-business/disconnect
 * Removes stored OAuth connection for the active operator.
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  try {
    await deleteGoogleBusinessConnection(auth.operatorId)
    return NextResponse.json({ ok: true, connected: false })
  } catch (error) {
    console.error('[google-business/disconnect]', error)
    const message = error instanceof Error ? error.message : 'disconnect_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
