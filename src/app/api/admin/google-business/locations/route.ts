import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  discoverGoogleBusinessLocations,
  getGoogleBusinessAccessToken,
  listGoogleBusinessLocations,
} from '@/lib/googleBusinessConnection'

/**
 * GET /api/admin/google-business/locations?account=accounts/123
 * Lists locations for a Google Business Profile account.
 * Query `discover=1` searches all linked accounts when the selected one is empty.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const accountName = request.nextUrl.searchParams.get('account')?.trim() ?? ''
  const discoverAll = request.nextUrl.searchParams.get('discover') === '1'

  if (!accountName.startsWith('accounts/') && !discoverAll) {
    return NextResponse.json({ ok: false, error: 'invalid_account' }, { status: 400 })
  }

  try {
    const accessToken = await getGoogleBusinessAccessToken(auth.operatorId)

    if (discoverAll || !accountName) {
      const discovered = await discoverGoogleBusinessLocations({
        accessToken,
        preferredAccountName: accountName || null,
      })
      return NextResponse.json({
        ok: true,
        locations: discovered.locations,
        resolvedAccountName: discovered.resolvedAccountName,
        triedAccounts: discovered.triedAccounts,
      })
    }

    let locations = await listGoogleBusinessLocations({ accessToken, accountName })
    let resolvedAccountName: string | null = accountName

    if (locations.length === 0) {
      const discovered = await discoverGoogleBusinessLocations({
        accessToken,
        preferredAccountName: accountName,
      })
      locations = discovered.locations
      resolvedAccountName = discovered.resolvedAccountName
    }

    return NextResponse.json({
      ok: true,
      locations,
      resolvedAccountName,
      empty: locations.length === 0,
    })
  } catch (error) {
    console.error('[google-business/locations]', error)
    const message = error instanceof Error ? error.message : 'locations_failed'
    const status = message === 'not_connected' ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
