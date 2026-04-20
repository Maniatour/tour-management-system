import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'
import {
  extractReservationFromEmail,
  isCancellationRequestEmailSubject,
  extractChannelRnForCancellationLookup,
  isKlookBookingConfirmedReservationEmail,
  isKlookOrderEmailSubjectForReservation,
} from '@/lib/emailReservationParser'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ReservationImportInsert, ExtractedReservationData } from '@/types/reservationImport'
import { normalizeCustomerNameFromImport } from '@/utils/reservationUtils'
import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'

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

function channelRnMatchesExistingSet(channelRn: string | undefined | null, existing: Set<string>): boolean {
  if (!channelRn?.trim()) return false
  return expandChannelRnMatchVariants(channelRn).some((v) => existing.has(v))
}

/** @ 앞 로컬파트만 (자사 홈 등 이메일 앞자리 비교용) */
function normalizeEmailLocalPart(email: string | null | undefined): string {
  if (email == null || typeof email !== 'string') return ''
  const s = email.trim().toLowerCase()
  const at = s.indexOf('@')
  if (at <= 0) return ''
  const local = s.slice(0, at).replace(/\./g, '')
  return local
}

/**
 * 고객명 + (전화 / 이메일) 정규화 키.
 * - 긴 전화: 숫자만 전체·끝 10자리 (OTA 등)
 * - 짧은 전화·홈페이지: 이름 + 끝 4자리 (채널 RN 없을 때)
 * - 이름 + 이메일 로컬파트 (홈페이지 예약)
 */
function expandCustomerIdentityKeys(
  name: string | null | undefined,
  phone: string | null | undefined,
  email: string | null | undefined
): string[] {
  const n = normalizeCustomerNameFromImport(name ?? '')
  if (!n) return []
  const nameKey = n.toLowerCase()
  const d = String(phone ?? '').replace(/\D/g, '')
  const keys = new Set<string>()

  if (d.length >= 4) {
    keys.add(`${nameKey}|p4:${d.slice(-4)}`)
  }
  if (d.length >= 8) {
    keys.add(`${nameKey}|${d}`)
    if (d.length >= 10) keys.add(`${nameKey}|${d.slice(-10)}`)
  }

  const local = normalizeEmailLocalPart(email)
  if (local.length >= 2) {
    keys.add(`${nameKey}|em:${local}`)
  }

  return [...keys]
}

function extractedDataMatchesCustomerIdentity(
  ext: ExtractedReservationData | undefined | null,
  identityKeys: Set<string>
): boolean {
  if (!ext) return false
  for (const k of expandCustomerIdentityKeys(ext.customer_name, ext.customer_phone, ext.customer_email)) {
    if (identityKeys.has(k)) return true
  }
  return false
}

/** 삭제되지 않은 예약의 고객(name+phone) 조합 키 집합 (페이지네이션으로 전부 적재) */
async function fetchReservationCustomerIdentityKeys(client: SupabaseClient<Database>): Promise<Set<string>> {
  const keys = new Set<string>()
  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await client
      .from('reservations')
      .select('customer_name, customer_email, customer_phone, customer:customers(name, phone, email)')
      .not('status', 'eq', 'deleted')
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('[reservation-imports] customer identity keys:', error.message)
      break
    }
    const rows = (data ?? []) as Array<{
      customer_name?: string | null
      customer_email?: string | null
      customer_phone?: string | null
      customer: { name?: string; phone?: string | null; email?: string | null } | null
    }>
    for (const row of rows) {
      const c = row.customer
      if (c) {
        for (const k of expandCustomerIdentityKeys(c.name, c.phone, c.email)) {
          keys.add(k)
        }
      }
      for (const k of expandCustomerIdentityKeys(row.customer_name, row.customer_phone, row.customer_email)) {
        keys.add(k)
      }
    }
    if (rows.length < pageSize) break
    offset += pageSize
    if (offset > 200000) break
  }
  return keys
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
    .select(
      'id, message_id, source_email, platform_key, subject, received_at, extracted_data, status, reservation_id, created_at, raw_body_text, raw_body_html'
    )

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

  /** 취소 메일 목록 뱃지: 채널 RN으로 예약 조회 후 처리 필요/완료 */
  const cancellationBadgeByImportId = new Map<string, 'needed' | 'done'>()
  const cancellationMetaList: Array<{ id: string; variantSet: Set<string> }> = []

  for (const r of list) {
    const row = r as { id: string; subject?: string | null; extracted_data?: ExtractedReservationData }
    if (!isCancellationRequestEmailSubject(row.subject)) continue

    const ext = row.extracted_data
    const fromExt = ext?.channel_rn?.trim()
    const rnRaw =
      fromExt && fromExt.toLowerCase() !== 'id'
        ? fromExt
        : extractChannelRnForCancellationLookup(String(row.subject ?? ''), '')

    if (!rnRaw?.trim()) {
      cancellationBadgeByImportId.set(row.id, 'needed')
      continue
    }
    cancellationMetaList.push({
      id: row.id,
      variantSet: new Set(expandChannelRnMatchVariants(rnRaw.trim())),
    })
  }

  const allCancelVariants = [...new Set(cancellationMetaList.flatMap((m) => [...m.variantSet]))]
  if (allCancelVariants.length > 0) {
    const { data: cancelResRows } = await client
      .from('reservations')
      .select('channel_rn, status')
      .in('channel_rn', allCancelVariants)
      .not('channel_rn', 'is', null)

    const resList = (cancelResRows ?? []) as Array<{ channel_rn: string | null; status: string | null }>

    const resMatchesImportVariants = (resRn: string | null, variantSet: Set<string>): boolean => {
      if (!resRn?.trim()) return false
      return expandChannelRnMatchVariants(resRn.trim()).some((v) => variantSet.has(v))
    }

    for (const m of cancellationMetaList) {
      const matched = resList.filter((row) => resMatchesImportVariants(row.channel_rn, m.variantSet))
      if (matched.length === 0) {
        cancellationBadgeByImportId.set(m.id, 'needed')
      } else {
        const allDone = matched.every((row) => {
          const s = String(row.status || '').toLowerCase()
          return s === 'cancelled' || s === 'deleted'
        })
        cancellationBadgeByImportId.set(m.id, allDone ? 'done' : 'needed')
      }
    }
  }

  const channelRns = list
    .map((r: { extracted_data?: { channel_rn?: string } }) => r.extracted_data?.channel_rn)
    .filter((rn: string | undefined): rn is string => typeof rn === 'string' && rn.trim().length > 0)
  const uniqueChannelRns = [...new Set(channelRns)]
  const lookupChannelRns = [...new Set(uniqueChannelRns.flatMap(expandChannelRnMatchVariants))]

  let existingChannelRns = new Set<string>()
  if (lookupChannelRns.length > 0) {
    const { data: resRows } = await client
      .from('reservations')
      .select('channel_rn')
      .in('channel_rn', lookupChannelRns)
      .not('channel_rn', 'is', null)
    if (resRows?.length) {
      resRows.forEach((r: { channel_rn?: string | null }) => {
        const cr = r.channel_rn?.trim()
        if (!cr) return
        expandChannelRnMatchVariants(cr).forEach((v) => existingChannelRns.add(v))
      })
    }
  }

  const listNeedsCustomerMatch = list.some((r: { extracted_data?: ExtractedReservationData }) => {
    const ext = r.extracted_data
    const n = normalizeCustomerNameFromImport(String(ext?.customer_name ?? ''))
    if (n.length === 0) return false
    const d = String(ext?.customer_phone ?? '').replace(/\D/g, '')
    if (d.length >= 4) return true
    const em = normalizeEmailLocalPart(ext?.customer_email)
    return em.length >= 2
  })

  let existingCustomerIdentityKeys = new Set<string>()
  if (listNeedsCustomerMatch) {
    existingCustomerIdentityKeys = await fetchReservationCustomerIdentityKeys(client as SupabaseClient<Database>)
  }

  const data = list.map(
    (r: {
      id: string
      subject?: string | null
      platform_key?: string | null
      extracted_data?: ExtractedReservationData | null
      raw_body_text?: string | null
      raw_body_html?: string | null
      reservation_id?: string | null
      message_id?: string | null
      source_email?: string | null
      received_at?: string | null
      status?: string | null
      created_at?: string | null
    }) => {
      let extracted_data = r.extracted_data ?? undefined
      const looksKlook =
        r.platform_key === 'klook' || isKlookOrderEmailSubjectForReservation(r.subject)
      if (looksKlook) {
        const ext = extracted_data ?? ({} as ExtractedReservationData)
        if (ext.is_booking_confirmed !== true) {
          if (
            isKlookBookingConfirmedReservationEmail(
              r.subject ?? '',
              r.raw_body_text ?? '',
              r.raw_body_html ?? null
            )
          ) {
            extracted_data = { ...ext, is_booking_confirmed: true }
          }
        }
      }
      const { raw_body_text: _rawOmit, raw_body_html: _htmlOmit, ...rest } = r
      void _rawOmit
      void _htmlOmit
      const channelRn = (extracted_data ?? r.extracted_data)?.channel_rn?.trim()
      const existsByChannelRn = channelRnMatchesExistingSet(channelRn, existingChannelRns)
      const existsByCustomerMatch = extractedDataMatchesCustomerIdentity(
        extracted_data ?? r.extracted_data,
        existingCustomerIdentityKeys
      )
      const cancellationListBadge = isCancellationRequestEmailSubject(r.subject)
        ? (cancellationBadgeByImportId.get(r.id) ?? 'needed')
        : null
      return {
        ...rest,
        platform_key:
          rest.platform_key ??
          (isKlookOrderEmailSubjectForReservation(r.subject) ? 'klook' : rest.platform_key),
        extracted_data: extracted_data ?? r.extracted_data,
        reservation_exists_by_channel_rn: existsByChannelRn,
        reservation_exists_by_customer_match: existsByCustomerMatch,
        cancellation_list_badge: cancellationListBadge,
      }
    }
  )

  return NextResponse.json({ data })
}
