import { NextRequest, NextResponse } from 'next/server'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

/**
 * GET /api/email/gmail/start
 * Google OAuth 로그인 페이지로 리디렉트
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Gmail 연동용 GOOGLE_GMAIL_CLIENT_ID 환경 변수를 설정하세요. (Drive 등 다른 API용 GOOGLE_CLIENT_ID와 구분됩니다.)' },
      { status: 500 }
    )
  }
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'ko'
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/email/gmail/auth`
  const state = Buffer.from(JSON.stringify({ redirect: `${origin}/${locale}/admin/email-integration` })).toString('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GMAIL_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return NextResponse.redirect(url.toString())
}
