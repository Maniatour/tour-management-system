import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { getAppOrigin } from '@/lib/appOrigin'
import type { GoogleBusinessOAuthStatePayload } from '@/types/googleBusiness'

export const GOOGLE_BUSINESS_OAUTH_SCOPE = 'https://www.googleapis.com/auth/business.manage'

export const GBP_OAUTH_STATE_COOKIE = 'gbp_oauth_state'
export const GBP_OAUTH_STATE_MAX_AGE_SEC = 600

function oauthStateSecret(): string {
  const secret =
    process.env.GOOGLE_BUSINESS_OAUTH_STATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) {
    throw new Error('GOOGLE_BUSINESS_OAUTH_STATE_SECRET (or CRON_SECRET) is not configured')
  }
  return secret
}

export function getGoogleBusinessOAuthClientId(): string {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error('GOOGLE_BUSINESS_CLIENT_ID is not configured')
  }
  return clientId
}

export function getGoogleBusinessOAuthClientSecret(): string {
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim()
  if (!clientSecret) {
    throw new Error('GOOGLE_BUSINESS_CLIENT_SECRET is not configured')
  }
  return clientSecret
}

/** OAuth redirect URI registered in Google Cloud Console. */
export function getGoogleBusinessRedirectUri(request?: NextRequest): string {
  const explicit = process.env.GOOGLE_BUSINESS_REDIRECT_URI?.trim()
  if (explicit) return explicit
  if (request) {
    return `${new URL(request.url).origin}/api/admin/google-business/callback`
  }
  return `${getAppOrigin()}/api/admin/google-business/callback`
}

export function createGoogleBusinessOAuthState(input: {
  locale: string
  redirectPath: string
  operatorId: string
}): { state: string; nonce: string } {
  const nonce = randomBytes(32).toString('base64url')
  const payload: GoogleBusinessOAuthStatePayload = {
    n: nonce,
    locale: input.locale === 'en' ? 'en' : 'ko',
    redirect: input.redirectPath,
    operatorId: input.operatorId,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', oauthStateSecret())
    .update(payloadB64)
    .digest('base64url')
  return { state: `${payloadB64}.${sig}`, nonce }
}

export function verifyGoogleBusinessOAuthState(state: string): GoogleBusinessOAuthStatePayload | null {
  const dot = state.lastIndexOf('.')
  if (dot <= 0) return null

  const payloadB64 = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = createHmac('sha256', oauthStateSecret())
    .update(payloadB64)
    .digest('base64url')

  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as GoogleBusinessOAuthStatePayload
    if (!parsed?.n || !parsed.locale || !parsed.redirect || !parsed.operatorId) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function buildGoogleBusinessAuthorizeUrl(input: {
  request: NextRequest
  locale: string
  redirectPath: string
  operatorId: string
}): { url: string; nonce: string } {
  const clientId = getGoogleBusinessOAuthClientId()
  const redirectUri = getGoogleBusinessRedirectUri(input.request)
  const { state, nonce } = createGoogleBusinessOAuthState({
    locale: input.locale,
    redirectPath: input.redirectPath,
    operatorId: input.operatorId,
  })

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_BUSINESS_OAUTH_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)

  return { url: url.toString(), nonce }
}

export async function exchangeGoogleBusinessAuthCode(input: {
  code: string
  request: NextRequest
}): Promise<{ refreshToken: string; accessToken: string; expiresIn: number | null }> {
  const redirectUri = getGoogleBusinessRedirectUri(input.request)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: getGoogleBusinessOAuthClientId(),
      client_secret: getGoogleBusinessOAuthClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = (await tokenRes.json()) as {
    refresh_token?: string
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!tokenRes.ok || tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error || tokenRes.statusText)
  }

  if (!tokenData.refresh_token) {
    throw new Error('no_refresh_token')
  }
  if (!tokenData.access_token) {
    throw new Error('no_access_token')
  }

  return {
    refreshToken: tokenData.refresh_token,
    accessToken: tokenData.access_token,
    expiresIn: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : null,
  }
}

export async function refreshGoogleBusinessAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getGoogleBusinessOAuthClientId(),
      client_secret: getGoogleBusinessOAuthClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'token_refresh_failed')
  }

  return {
    accessToken: tokenData.access_token,
    expiresIn: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : null,
  }
}
