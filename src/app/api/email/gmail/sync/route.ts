import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import { isZellePaymentSentEmail, ZELLE_PAYMENT_PLATFORM_KEY } from '@/lib/zellePaymentEmail'
import { decodeGmailPayload, extractGmailMessageText, type GmailPart } from '@/lib/gmailMessageBody'
import type { Json } from '@/lib/database.types'

export const maxDuration = 120

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const GMAIL_FULL_FETCH_PER_REQUEST = 60
const GMAIL_AFTER_DAYS_MAX = 400

function getHeader(headers: Array<{ name?: string; value?: string }>, name: string): string | null {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

function decodeBody(payload: GmailPart): string {
  return decodeGmailPayload(payload)
}

type FullMsg = {
  id: string
  internalDate?: string
  snippet?: string
  labelIds?: string[]
  payload?: GmailPart & {
    headers?: Array<{ name?: string; value?: string }>
  }
}

/**
 * POST /api/email/gmail/sync
 * 전체 재동기화: body { fullSync: true } → History 생략, after:(오늘-7일) 수신함 목록으로 누락 보정
 * 1) fullSync가 아니고 last_history_id가 있으면 History API로 messageAdded 수집 → 있으면 즉시 반환
 * 2) History에서 추가 ID가 없어도 Gmail 누락이 있을 수 있으므로 항상 이어서 messages.list(수신함)로 보정
 * 3) 목록 쿼리: 일반 동기화 after:3일, fullSync 시 after:7일, afterDays로 더 긴 기간 지정 가능
 *    afterDays > 7이면 History를 건너뛰고, 이미 DB에 있는 message_id는 본문 조회 없이 스킵한 뒤
 *    요청당 최대 60건만 가져오며 remaining으로 클라이언트가 이어서 호출한다
 */
export async function POST(request: Request) {
  let forceFullSync = false
  let afterDays: number | null = null
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('full') === '1') forceFullSync = true
  } catch {
    /* ignore */
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { fullSync?: boolean; afterDays?: number }
    if (body?.fullSync === true) forceFullSync = true
    if (typeof body?.afterDays === 'number' && Number.isFinite(body.afterDays)) {
      afterDays = Math.min(GMAIL_AFTER_DAYS_MAX, Math.max(1, Math.round(body.afterDays)))
    }
  } catch {
    /* ignore */
  }
  const lookbackDays = afterDays ?? (forceFullSync ? 7 : 3)
  const skipHistory = lookbackDays > 7

  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const { data: conn, error: connError } = await fromUntypedTable(client, 'gmail_connections')
    .select('id, email, refresh_token, last_history_id')
    .limit(1)
    .maybeSingle()

  const connRow = conn as {
    id?: string
    email?: string
    refresh_token?: string
    last_history_id?: string | null
  } | null

  if (connError || !connRow?.refresh_token) {
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
      refresh_token: connRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }
  if (!tokenRes.ok || !tokenData.access_token) {
    const oauthErr = tokenData.error ?? ''
    // invalid_grant: 리프레시 토큰 폐기·만료, 비밀번호 변경, OAuth 클라이언트 불일치, 사용자가 앱 연결 해제 등
    if (oauthErr === 'invalid_grant') {
      const connId = connRow.id
      const connEmail = connRow.email
      try {
        const del = fromUntypedTable(client, 'gmail_connections').delete()
        if (connId) await del.eq('id', connId)
        else if (connEmail) await del.eq('email', connEmail)
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error:
            'Gmail 인증이 만료되었거나 취소되었습니다. 아래 「다시 연결」을 눌러 Google 계정을 다시 승인해 주세요. (Google Cloud 콘솔에서 OAuth 클라이언트 ID/비밀번호가 바뀌었으면 재연결이 필요합니다.)',
          code: 'invalid_grant',
        },
        { status: 401 }
      )
    }
    return NextResponse.json(
      {
        error: tokenData.error_description || tokenData.error || 'Failed to refresh token',
      },
      { status: 502 }
    )
  }

  const accessToken = tokenData.access_token
  const connId = connRow.id
  const connEmail = connRow.email
  const lastHistoryId = skipHistory || forceFullSync ? null : (connRow.last_history_id ?? null)

  const processOneMessage = async (full: FullMsg, skipInboxCheck = false): Promise<boolean> => {
    if (!full.payload) return false
    const labelIds = full.labelIds ?? []
    if (!skipInboxCheck && labelIds.length > 0 && !labelIds.includes('INBOX')) return false

    const subject = getHeader(full.payload.headers ?? [], 'Subject') ?? ''
    const from = getHeader(full.payload.headers ?? [], 'From')
    const body =
      (await extractGmailMessageText(full, accessToken, full.id)).trim() || decodeBody(full.payload)
    const messageId = full.id ? `<${full.id}@gmail>` : null
    if (!messageId) return false

    const { data: existing } = await client
      .from('reservation_imports')
      .select('id, raw_body_text, raw_body_html, platform_key, subject')
      .eq('message_id', messageId)
      .maybeSingle()
    const zelleMail = isZellePaymentSentEmail(subject)
    if (existing) {
      const empty =
        !String(existing.raw_body_text ?? '').trim() && !String(existing.raw_body_html ?? '').trim()
      const existingZelle =
        existing.platform_key === ZELLE_PAYMENT_PLATFORM_KEY ||
        isZellePaymentSentEmail(existing.subject)
      if (!empty || !body.trim() || !(zelleMail || existingZelle)) return false
      const { error: updErr } = await client
        .from('reservation_imports')
        .update({
          raw_body_text: body.slice(0, 50000),
          platform_key: ZELLE_PAYMENT_PLATFORM_KEY,
          extracted_data: { is_booking_confirmed: false, zelle_processed: false } as Json,
          status: 'pending',
        })
        .eq('id', existing.id)
      if (updErr) {
        console.error('[gmail/sync] reservation_imports body backfill:', updErr.message)
      }
      return !updErr
    }

    let receivedAt: string
    if (full.internalDate) {
      const ms = parseInt(String(full.internalDate), 10)
      if (!isNaN(ms)) receivedAt = new Date(ms).toISOString()
      else receivedAt = new Date().toISOString()
    } else {
      receivedAt = new Date().toISOString()
    }

    const { platform_key, extracted_data } = zelleMail
      ? {
          platform_key: ZELLE_PAYMENT_PLATFORM_KEY,
          extracted_data: { is_booking_confirmed: false, zelle_processed: false },
        }
      : extractReservationFromEmail({
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
      received_at: receivedAt,
      raw_body_text: body.slice(0, 50000),
      raw_body_html: null,
      extracted_data: extracted_data as Json,
      status: 'pending',
    })
    if (insertErr) {
      console.error('[gmail/sync] reservation_imports insert:', insertErr.message, insertErr.code)
    }
    return !insertErr
  }

  const updateHistoryId = async (historyId: string) => {
    if (!connId && !connEmail) return
    const q = fromUntypedTable(client, 'gmail_connections').update({
      last_history_id: historyId,
      updated_at: new Date().toISOString(),
    } as never)
    if (connId) await q.eq('id', connId)
    else if (connEmail) await q.eq('email', connEmail)
  }

  // 1) History API: last_history_id 이후 추가된 메일만 조회 (최신 메일만 확실히 포함)
  if (lastHistoryId && lastHistoryId.trim() !== '') {
    const addedIds: string[] = []
    let newHistoryId: string | null = null
    let historyPageToken: string | undefined

    do {
      const histUrl = new URL(`${GMAIL_API_BASE}/history`)
      histUrl.searchParams.set('startHistoryId', lastHistoryId.trim())
      histUrl.searchParams.set('historyTypes', 'messageAdded')
      histUrl.searchParams.set('maxResults', '500')
      if (historyPageToken) histUrl.searchParams.set('pageToken', historyPageToken)

      const histRes = await fetch(histUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (histRes.status === 404) {
        const clearQ = fromUntypedTable(client, 'gmail_connections').update({
          last_history_id: null,
        } as never)
        if (connId) await clearQ.eq('id', connId)
        else if (connEmail) await clearQ.eq('email', connEmail)
        break
      }

      if (!histRes.ok) {
        const errBody = await histRes.json().catch(() => ({}))
        return NextResponse.json(
          { error: (errBody as { error?: { message?: string } }).error?.message || 'Gmail history list failed' },
          { status: 502 }
        )
      }

      const histData = (await histRes.json()) as {
        history?: Array<{
          id?: string
          messagesAdded?: Array<{ message?: { id?: string } }>
        }>
        nextPageToken?: string
        historyId?: string
      }
      newHistoryId = histData.historyId ?? null
      historyPageToken = histData.nextPageToken

      for (const rec of histData.history ?? []) {
        for (const add of rec.messagesAdded ?? []) {
          const id = add.message?.id
          if (id) addedIds.push(id)
        }
      }
    } while (historyPageToken)

    if (newHistoryId && addedIds.length > 0) {
      let imported = 0
      for (const id of addedIds) {
        const getRes = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const full = (await getRes.json()) as FullMsg
        if (getRes.ok && (await processOneMessage(full))) imported++
      }
      await updateHistoryId(newHistoryId)
      return NextResponse.json({ imported, total: addedIds.length, remaining: 0, mode: 'history' })
    }

    // History에 messageAdded가 없어도 Gmail이 일부 변경을 누락할 수 있음 → 아래 messages.list 로 보정
    if (newHistoryId) {
      await updateHistoryId(newHistoryId)
    }
  }

  // 2) 수신함 messages.list: History 미적용·누락 분을 DB와 대조해 삽입 (중복은 message_id로 스킵)
  const profileRes = await fetch(`${GMAIL_API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    return NextResponse.json(
      { error: 'Gmail profile failed' },
      { status: 502 }
    )
  }
  const profile = (await profileRes.json()) as { historyId?: string }
  const currentHistoryId = profile.historyId

  // after:YYYY/MM/DD — 일반 3일, 전체 재동기화 7일, afterDays로 올해 등 더 긴 기간
  const afterDate = new Date()
  afterDate.setDate(afterDate.getDate() - lookbackDays)
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`
  const listIds: string[] = []
  let listPageToken: string | undefined
  do {
    const listUrl = new URL(`${GMAIL_API_BASE}/messages`)
    listUrl.searchParams.set('maxResults', '500')
    listUrl.searchParams.set('labelIds', 'INBOX')
    listUrl.searchParams.set('q', `after:${afterStr}`)
    if (listPageToken) listUrl.searchParams.set('pageToken', listPageToken)
    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const listData = (await listRes.json()) as {
      messages?: Array<{ id: string }>
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!listRes.ok || listData.error) {
      return NextResponse.json(
        { error: listData.error?.message || 'Gmail API list failed' },
        { status: 502 }
      )
    }
    const page = (listData.messages ?? []).map((m) => m.id)
    for (const id of page) listIds.push(id)
    listPageToken = listData.nextPageToken
  } while (listPageToken)

  if (listIds.length === 0) {
    if (currentHistoryId) await updateHistoryId(currentHistoryId)
    return NextResponse.json({ imported: 0, total: 0, remaining: 0, mode: 'full', queryUsed: `after:${afterStr}` })
  }

  const existingIds = new Set<string>()
  const emptyBodyZelleIds = new Set<string>()
  for (let i = 0; i < listIds.length; i += 200) {
    const chunk = listIds.slice(i, i + 200).map((id) => `<${id}@gmail>`)
    const { data } = await client
      .from('reservation_imports')
      .select('message_id, raw_body_text, raw_body_html, platform_key, subject')
      .in('message_id', chunk)
    for (const row of data ?? []) {
      if (!row.message_id) continue
      existingIds.add(row.message_id)
      const empty =
        !String(row.raw_body_text ?? '').trim() && !String(row.raw_body_html ?? '').trim()
      const zelle =
        row.platform_key === ZELLE_PAYMENT_PLATFORM_KEY ||
        isZellePaymentSentEmail(row.subject)
      if (empty && zelle) emptyBodyZelleIds.add(row.message_id)
    }
  }
  const missingIds = listIds.filter((id) => {
    const mid = `<${id}@gmail>`
    return !existingIds.has(mid) || emptyBodyZelleIds.has(mid)
  })
  const remainingAfterBatch = Math.max(0, missingIds.length - GMAIL_FULL_FETCH_PER_REQUEST)
  const toFetch = missingIds.slice(0, GMAIL_FULL_FETCH_PER_REQUEST)

  const fullList: FullMsg[] = []
  for (const id of toFetch) {
    const getRes = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const full = (await getRes.json()) as FullMsg
    if (getRes.ok && full.payload) fullList.push(full)
  }
  fullList.sort((a, b) => {
    const ta = parseInt(String(a.internalDate ?? '0'), 10)
    const tb = parseInt(String(b.internalDate ?? '0'), 10)
    return tb - ta
  })

  let imported = 0
  for (const full of fullList) {
    if (await processOneMessage(full, true)) imported++
  }
  if (currentHistoryId) await updateHistoryId(currentHistoryId)

  return NextResponse.json({
    imported,
    total: listIds.length,
    remaining: remainingAfterBatch,
    mode: 'full',
    queryUsed: `after:${afterStr}`,
  })
}
