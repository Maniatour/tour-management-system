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
 * 목록 (status, from_utc, to_utc 또는 from_date, to_date).
 * from_utc/to_utc: 로컬 기준 날짜를 브라우저에서 UTC ISO로 변환해 보낸 값 (라스베가스 등 타임존 정확 반영).
 * from_date/to_date: YYYY-MM-DD (UTC 자정 기준, 하위 호환).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  /** pending | confirmed | rejected | active (대기+예약 생성됨, 무시 제외) */
  const status = searchParams.get('status') || 'active'
  const fromUtc = searchParams.get('from_utc')
  const toUtc = searchParams.get('to_utc')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')

  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  let query = client
    .from('reservation_imports')
    .select('id, message_id, source_email, platform_key, subject, received_at, extracted_data, status, reservation_id, created_at')

  if (status === 'active') {
    query = query.in('status', ['pending', 'confirmed'])
  } else if (status === 'pending' || status === 'confirmed' || status === 'rejected') {
    query = query.eq('status', status)
  } else {
    query = query.in('status', ['pending', 'confirmed'])
  }
  query = query
    .order('received_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(1000)

  if (fromUtc && toUtc) {
    query = query.gte('received_at', fromUtc).lte('received_at', toUtc)
  } else {
    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      query = query.gte('received_at', `${fromDate}T00:00:00.000Z`)
    }
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      query = query.lte('received_at', `${toDate}T23:59:59.999Z`)
    }
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const list = rows ?? []

  const channelRns = list
    .map((r: { extracted_data?: { channel_rn?: string } }) => r.extracted_data?.channel_rn)
    .filter((rn: string | undefined): rn is string => typeof rn === 'string' && rn.trim().length > 0)
  const uniqueChannelRns = [...new Set(channelRns)]

  let existingChannelRns = new Set<string>()
  if (uniqueChannelRns.length > 0) {
    const { data: resRows } = await client
      .from('reservations')
      .select('channel_rn')
      .in('channel_rn', uniqueChannelRns)
      .not('channel_rn', 'is', null)
    if (resRows?.length) {
      resRows.forEach((r: { channel_rn?: string | null }) => {
        if (r.channel_rn) existingChannelRns.add(r.channel_rn.trim())
      })
    }
  }

  const data = list.map((r: { extracted_data?: { channel_rn?: string }; reservation_id?: string | null }) => {
    const channelRn = r.extracted_data?.channel_rn?.trim()
    const existsByChannelRn = !!channelRn && existingChannelRns.has(channelRn)
    return {
      ...r,
      reservation_exists_by_channel_rn: existsByChannelRn,
    }
  })

  return NextResponse.json({ data })
}
