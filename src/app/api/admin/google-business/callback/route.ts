import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  GBP_OAUTH_STATE_COOKIE,
  exchangeGoogleBusinessAuthCode,
  verifyGoogleBusinessOAuthState,
} from '@/lib/googleBusinessOAuth'
import {
  fetchGoogleBusinessProfileEmail,
  upsertGoogleBusinessConnection,
} from '@/lib/googleBusinessConnection'

/**
 * GET /api/admin/google-business/callback
 * OAuth callback — exchanges code, encrypts refresh token, stores connection.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ko'
  const fallbackRedirect = `/${locale}/admin/google-reviews`

  const { searchParams } = request.nextUrl
  const oauthError = searchParams.get('error')
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')

  let redirectPath = fallbackRedirect
  if (stateRaw) {
    const parsed = verifyGoogleBusinessOAuthState(stateRaw)
    if (parsed?.redirect?.startsWith('/')) {
      redirectPath = parsed.redirect
    }
  }

  const redirectUrl = new URL(redirectPath, request.url)

  if (!auth.ok) {
    redirectUrl.searchParams.set('error', 'admin_auth_required')
    return NextResponse.redirect(redirectUrl)
  }

  if (oauthError) {
    redirectUrl.searchParams.set('error', oauthError)
    return NextResponse.redirect(redirectUrl)
  }

  if (!code || !stateRaw) {
    redirectUrl.searchParams.set('error', 'missing_code_or_state')
    return NextResponse.redirect(redirectUrl)
  }

  const state = verifyGoogleBusinessOAuthState(stateRaw)
  if (!state) {
    redirectUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(redirectUrl)
  }

  const cookieNonce = request.cookies.get(GBP_OAUTH_STATE_COOKIE)?.value
  if (!cookieNonce || cookieNonce !== state.n) {
    redirectUrl.searchParams.set('error', 'state_mismatch')
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete(GBP_OAUTH_STATE_COOKIE)
    return response
  }

  if (state.operatorId !== auth.operatorId) {
    redirectUrl.searchParams.set('error', 'operator_mismatch')
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete(GBP_OAUTH_STATE_COOKIE)
    return response
  }

  try {
    const tokens = await exchangeGoogleBusinessAuthCode({ code, request })
    const connectedEmail = await fetchGoogleBusinessProfileEmail(tokens.accessToken)

    await upsertGoogleBusinessConnection({
      operatorId: auth.operatorId,
      connectedEmail,
      refreshToken: tokens.refreshToken,
      connectedByEmail: auth.userEmail,
      connectedByUserId: auth.userId,
    })

    redirectUrl.searchParams.set('success', '1')
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete(GBP_OAUTH_STATE_COOKIE)
    return response
  } catch (error) {
    console.error('[google-business/callback]', error)
    const message = error instanceof Error ? error.message : 'callback_failed'
    redirectUrl.searchParams.set('error', message)
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete(GBP_OAUTH_STATE_COOKIE)
    return response
  }
}
