import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import type { ReservationImportInsert } from '@/types/reservationImport'

/** 직접 페이로드: 테스트 또는 다른 제공자에서 POST */
interface DirectInboundPayload {
  subject: string
  text?: string | null
  html?: string | null
  from?: string | null
  message_id?: string | null
}

/** Resend Inbound 웹훅 페이로드 (본문 미포함, email_id로 조회 필요) */
interface ResendInboundPayload {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
    message_id?: string
  }
}

function isResendInboundPayload(body: unknown): body is ResendInboundPayload {
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    (body as ResendInboundPayload).type === 'email.received' &&
    'data' in body &&
    typeof (body as ResendInboundPayload).data?.email_id === 'string'
  )
}

function isDirectPayload(body: unknown): body is DirectInboundPayload {
  return (
    typeof body === 'object' &&
    body !== null &&
    'subject' in body &&
    typeof (body as DirectInboundPayload).subject === 'string'
  )
}

/** Resend API로 수신 이메일 본문 조회 */
async function fetchResendReceivedEmail(emailId: string): Promise<{ subject?: string; text?: string; html?: string } | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { subject?: string; text?: string; html?: string }
  return data
}

/**
 * POST /api/reservation-imports
 *
 * 1) Resend Inbound: svix 헤더로 서명 검증 후, email.received 시 본문 조회 → 파싱 → 저장
 * 2) 직접 페이로드: { subject, text?, html?, from?, message_id? } → 파싱 → 저장
 * 중복은 message_id로 방지.
 */
export async function POST(request: NextRequest) {
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  let subject: string
  let text: string | null = null
  let html: string | null = null
  let from: string | null = null
  let message_id: string | null = null

  if (svixId && svixTimestamp && svixSignature) {
    const rawBody = await request.text()
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'RESEND_WEBHOOK_SECRET not configured' },
        { status: 500 }
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody) as unknown
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!isResendInboundPayload(parsed)) {
      return NextResponse.json({ message: 'Not email.received event' }, { status: 200 })
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const verified = (resend as { webhooks?: { verify: (payload: string, headers: Record<string, string>, secret: string) => unknown } }).webhooks?.verify?.(
        rawBody,
        { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature },
        webhookSecret
      )
      if (verified === false) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } catch (e) {
      console.error('[reservation-imports] Webhook verify error:', e)
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 })
    }
    const emailId = parsed.data!.email_id!
    const receivedEmail = await fetchResendReceivedEmail(emailId)
    if (!receivedEmail) {
      return NextResponse.json(
        { error: 'Failed to fetch email content from Resend' },
        { status: 502 }
      )
    }
    subject = receivedEmail.subject ?? parsed.data?.subject ?? ''
    text = receivedEmail.text ?? null
    html = receivedEmail.html ?? null
    from = parsed.data?.from ?? null
    message_id = parsed.data?.message_id ?? `<${emailId}>`
  } else {
    const body = await request.json().catch(() => null)
    if (!isDirectPayload(body)) {
      return NextResponse.json(
        { error: 'Expected JSON body with at least "subject", or Resend webhook with svix headers' },
        { status: 400 }
      )
    }
    subject = body.subject
    text = body.text ?? null
    html = body.html ?? null
    from = body.from ?? null
    message_id = body.message_id ?? null
  }

  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  if (message_id) {
    const { data: existing } = await client
      .from('reservation_imports')
      .select('id')
      .eq('message_id', message_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { message: 'Duplicate message_id', id: existing.id },
        { status: 200 }
      )
    }
  }

  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject,
    text,
    html,
    sourceEmail: from,
  })

  const row: ReservationImportInsert = {
    message_id,
    source_email: from,
    platform_key,
    subject,
    received_at: new Date().toISOString(),
    raw_body_text: text,
    raw_body_html: html,
    extracted_data: extracted_data as any,
    status: 'pending',
  }

  const { data: inserted, error } = await client
    .from('reservation_imports')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('[reservation-imports] Insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id, status: 'pending' })
}

/**
 * GET /api/reservation-imports
 * 목록 (status, from_date, to_date 쿼리. from_date/to_date는 YYYY-MM-DD, 날짜별 페이지네이션용)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'
  const fromDate = searchParams.get('from_date') // YYYY-MM-DD
  const toDate = searchParams.get('to_date')   // YYYY-MM-DD

  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  let query = client
    .from('reservation_imports')
    .select('id, message_id, source_email, platform_key, subject, received_at, extracted_data, status, reservation_id, created_at')
    .eq('status', status)
    .order('received_at', { ascending: false })
    .limit(200)

  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    query = query.gte('received_at', `${fromDate}T00:00:00.000Z`)
  }
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    query = query.lte('received_at', `${toDate}T23:59:59.999Z`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}
