import { NextRequest, NextResponse } from 'next/server'
import { requireGoogleBusinessAdminAuth } from '@/lib/googleBusinessAdminAuth'
import {
  GBP_OAUTH_STATE_COOKIE,
  GBP_OAUTH_STATE_MAX_AGE_SEC,
  buildGoogleBusinessAuthorizeUrl,
} from '@/lib/googleBusinessOAuth'

/**
 * GET /api/admin/google-business/connect
 * Redirects administrator to Google OAuth consent screen.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGoogleBusinessAdminAuth(request)
  if (!auth.ok) return auth.response

  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ko'
  const redirectPath =
    request.nextUrl.searchParams.get('redirect')?.trim() ||
    `/${locale}/admin/google-reviews`

  try {
    const { url, nonce } = buildGoogleBusinessAuthorizeUrl({
      request,
      locale,
      redirectPath: redirectPath.startsWith('/') ? redirectPath : `/${locale}/admin/google-reviews`,
      operatorId: auth.operatorId,
    })

    const response = NextResponse.redirect(url)
    response.cookies.set(GBP_OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: GBP_OAUTH_STATE_MAX_AGE_SEC,
      path: '/api/admin/google-business',
    })
    return response
  } catch (error) {
    console.error('[google-business/connect]', error)
    const message = error instanceof Error ? error.message : 'oauth_config_error'
    const redirectUrl = new URL(redirectPath, request.url)
    redirectUrl.searchParams.set('error', message)
    return NextResponse.redirect(redirectUrl)
  }
}
