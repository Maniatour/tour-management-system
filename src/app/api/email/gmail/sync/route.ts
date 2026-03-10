import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

function getHeader(headers: Array<{ name?: string; value?: string }>, name: string): string | null {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

function decodeBody(payload: { body?: { data?: string }; parts?: Array<{ body?: { data?: string }; mimeType?: string }> }): string {
  let raw = ''
  if (payload.body?.data) {
    raw = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  if (!raw && payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain' || !p.mimeType)
    if (textPart?.body?.data) {
      raw = Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
    }
    if (!raw) {
      const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html')
      if (htmlPart?.body?.data) {
        raw = Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8')
      }
    }
  }
  return raw
}

/**
 * POST /api/email/gmail/sync
 * 저장된 refresh_token으로 Gmail에서 최근 메일 조회 후 예약 가져오기 목록에 추가
 */
export async function POST() {
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const { data: conn, error: connError } = await client
    .from('gmail_connections')
    .select('email, refresh_token')
    .limit(1)
    .maybeSingle()

  if (connError || !conn?.refresh_token) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
  }

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Gmail 연동용 GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET 환경 변수를 설정하세요.' },
      { status: 500 }
    )
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json({ error: tokenData.error || 'Failed to refresh token' }, { status: 502 })
  }

  const accessToken = tokenData.access_token
  const listRes = await fetch(
    `${GMAIL_API_BASE}/messages?maxResults=50&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const listData = (await listRes.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } }
  if (!listRes.ok || listData.error) {
    return NextResponse.json(
      { error: listData.error?.message || 'Gmail API list failed' },
      { status: 502 }
    )
  }
  const messages = listData.messages ?? []

  let imported = 0
  for (const msg of messages) {
    const getRes = await fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const full = (await getRes.json()) as {
      id: string
      payload?: {
        headers?: Array<{ name?: string; value?: string }>
        body?: { data?: string }
        parts?: Array<{ body?: { data?: string }; mimeType?: string }> }
    }
    if (!getRes.ok || !full.payload) continue

    const subject = getHeader(full.payload.headers ?? [], 'Subject') ?? ''
    const from = getHeader(full.payload.headers ?? [], 'From')
    const body = decodeBody(full.payload)
    const messageId = full.id ? `<${full.id}@gmail>` : null

    const { data: existing } = await client
      .from('reservation_imports')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle()
    if (existing) continue

    const { platform_key, extracted_data } = extractReservationFromEmail({
      subject,
      text: body,
      html: null,
      sourceEmail: from,
    })

    const { error: insertErr } = await client.from('reservation_imports').insert({
      message_id: messageId,
      source_email: from,
      platform_key,
      subject,
      received_at: new Date().toISOString(),
      raw_body_text: body.slice(0, 50000),
      raw_body_html: null,
      extracted_data: extracted_data as object,
      status: 'pending',
    })
    if (!insertErr) imported++
  }

  return NextResponse.json({ imported, total: messages.length })
}
