import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/email/gmail/auth
 * Google OAuth 콜백: code로 토큰 교환 후 refresh_token 저장, 관리자 페이지로 리디렉트
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin
  let redirectTo = `${origin}/admin/email-integration`
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
      if (decoded.redirect) redirectTo = decoded.redirect
    }
  } catch {
    // ignore
  }

  if (error) {
    return NextResponse.redirect(`${redirectTo}?error=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${redirectTo}?error=no_code`)
  }

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${redirectTo}?error=server_config`)
  }

  const redirectUri = `${origin}/api/email/gmail/auth`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = (await tokenRes.json()) as { refresh_token?: string; access_token?: string; error?: string }

  if (!tokenRes.ok || tokenData.error) {
    return NextResponse.redirect(
      `${redirectTo}?error=${encodeURIComponent(tokenData.error || tokenRes.statusText)}`
    )
  }
  const refreshToken = tokenData.refresh_token
  if (!refreshToken) {
    return NextResponse.redirect(`${redirectTo}?error=no_refresh_token`)
  }

  // 사용자 이메일 조회 (선택)
  let email = 'connected@gmail.com'
  if (tokenData.access_token) {
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as { email?: string }
        if (profile.email) email = profile.email
      }
    } catch {
      // ignore
    }
  }

  const mod = await import('@/lib/supabase')
  const client = mod.supabaseAdmin ?? mod.supabase
  if (!client) {
    return NextResponse.redirect(
      `${redirectTo}?error=${encodeURIComponent('DB 연결 불가 (SUPABASE_SERVICE_ROLE_KEY 확인)')}`
    )
  }
  const { error: upsertError } = await client
    .from('gmail_connections')
    .upsert(
      { email, refresh_token: refreshToken, updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    )

  if (upsertError) {
    console.error('[gmail/auth] upsert error:', upsertError.message, upsertError.code)
    return NextResponse.redirect(
      `${redirectTo}?error=${encodeURIComponent(upsertError.message || '저장 실패')}`
    )
  }

  return NextResponse.redirect(`${redirectTo}?success=1`)
}
