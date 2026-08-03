import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  isValidGoogleLocationName,
  normalizeGoogleAccountName,
  normalizeGoogleLocationName,
  updateGoogleBusinessConnectionSelection,
} from '@/lib/googleBusinessConnection'
type ConnectionBody = {
  googleAccountName?: string
  googleAccountDisplayName?: string | null
  googleLocationName?: string
  googleLocationTitle?: string | null
}

/**
 * POST /api/admin/google-business/connection
 * Saves selected Google Business Profile account and location.
 */
export async function POST(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  let body: ConnectionBody
  try {
    body = (await request.json()) as ConnectionBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const googleAccountName = normalizeGoogleAccountName(body.googleAccountName?.trim() ?? '')
  const googleLocationName = normalizeGoogleLocationName(
    body.googleLocationName?.trim() ?? '',
    googleAccountName
  )

  if (!googleAccountName.startsWith('accounts/')) {
    return NextResponse.json({ ok: false, error: 'invalid_account' }, { status: 400 })
  }
  if (!isValidGoogleLocationName(googleLocationName)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_location',
        detail: 'Location must be accounts/{id}/locations/{id} or locations/{id}',
      },
      { status: 400 }
    )
  }
  try {
    await updateGoogleBusinessConnectionSelection({
      operatorId: auth.operatorId,
      googleAccountName,
      googleAccountDisplayName: body.googleAccountDisplayName?.trim() || null,
      googleLocationName,
      googleLocationTitle: body.googleLocationTitle?.trim() || null,
    })

    return NextResponse.json({
      ok: true,
      googleAccountName,
      googleAccountDisplayName: body.googleAccountDisplayName?.trim() || null,
      googleLocationName,
      googleLocationTitle: body.googleLocationTitle?.trim() || null,
    })
  } catch (error) {
    console.error('[google-business/connection]', error)
    const message = error instanceof Error ? error.message : 'connection_save_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
