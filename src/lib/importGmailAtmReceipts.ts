import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import {
  decodeGmailInlineHtmlAndText,
  refreshGmailAccessToken,
  type GmailPart,
} from '@/lib/gmailMessageBody'
import {
  addCalendarDaysYmd,
  ATM_RECEIPT_DAY_WINDOW,
  isWellsFargoAtmReceiptEmail,
  parseWellsFargoAtmReceipt,
  WELLS_FARGO_ATM_PLATFORM_KEY,
} from '@/lib/wellsFargoAtmReceipt'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const SEARCH_DAY_WINDOW = ATM_RECEIPT_DAY_WINDOW + 4

function ymdToUnixSec(ymd: string, endOfDay = false): number {
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'
  return Math.floor(Date.parse(`${ymd}${suffix}`) / 1000)
}

function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return String(h?.value ?? '').trim()
}

async function listGmailMessageIds(accessToken: string, query: string): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const url = new URL(`${GMAIL_API_BASE}/messages`)
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('q', query)
    url.searchParams.set('includeSpamTrash', 'true')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    const data = (await res.json()) as {
      messages?: Array<{ id: string }>
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(data.error?.message || `Gmail 검색 실패 (HTTP ${res.status})`)
    }
    for (const row of data.messages ?? []) {
      if (row.id) ids.push(row.id)
    }
    pageToken = data.nextPageToken
  } while (pageToken && ids.length < 120)
  return ids
}

export async function importAtmReceiptsFromGmail(
  client: SupabaseClient,
  dateYmd: string
): Promise<{ imported: number; searched: number; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return { imported: 0, searched: 0 }

  const token = await refreshGmailAccessToken(client)
  if ('error' in token) return { imported: 0, searched: 0, error: token.error }

  const afterYmd = addCalendarDaysYmd(dateYmd, -SEARCH_DAY_WINDOW)
  const beforeYmd = addCalendarDaysYmd(dateYmd, SEARCH_DAY_WINDOW)
  const afterSec = ymdToUnixSec(afterYmd)
  const beforeSec = ymdToUnixSec(addCalendarDaysYmd(beforeYmd, 1))

  const queries = [
    `in:anywhere from:notify.wellsfargo.com subject:ATM after:${afterSec} before:${beforeSec}`,
    `in:anywhere subject:(ATM Receipt) after:${afterSec} before:${beforeSec}`,
    `in:anywhere from:notify.wellsfargo.com subject:ATM newer_than:60d`,
  ]

  let gmailIds: string[] = []
  try {
    gmailIds = await listGmailMessageIds(token.accessToken, queries[0])
    if (gmailIds.length === 0) {
      gmailIds = await listGmailMessageIds(token.accessToken, queries[1])
    }
    if (gmailIds.length === 0) {
      gmailIds = await listGmailMessageIds(token.accessToken, queries[2])
    }
  } catch (e) {
    return { imported: 0, searched: 0, error: e instanceof Error ? e.message : String(e) }
  }

  const windowStartMs = Date.parse(`${afterYmd}T00:00:00.000Z`)
  const windowEndMs = Date.parse(`${beforeYmd}T23:59:59.999Z`)

  if (gmailIds.length === 0) return { imported: 0, searched: 0 }

  const messageIds = gmailIds.map((id) => `<${id}@gmail>`)
  const { data: existingRows } = await client
    .from('reservation_imports')
    .select('id, message_id, raw_body_text, raw_body_html')
    .in('message_id', messageIds)
  const existingByMessageId = new Map(
    (existingRows ?? []).map((row) => [String(row.message_id), row])
  )

  let imported = 0
  let searched = 0
  for (const gmailId of gmailIds) {
    const messageId = `<${gmailId}@gmail>`
    const existing = existingByMessageId.get(messageId)
    const hasBody = Boolean(
      String(existing?.raw_body_text ?? '').trim() || String(existing?.raw_body_html ?? '').trim()
    )
    if (existing && hasBody) {
      searched += 1
      continue
    }

    try {
      const getRes = await fetch(`${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailId)}?format=full`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        signal: AbortSignal.timeout(15000),
      })
      if (!getRes.ok) continue
      const full = (await getRes.json()) as {
        internalDate?: string
        snippet?: string
        payload?: GmailPart & { headers?: Array<{ name?: string; value?: string }> }
      }
      const subject = getHeader(full.payload?.headers, 'Subject')
      const from = getHeader(full.payload?.headers, 'From')
      const internalMs = parseInt(String(full.internalDate ?? ''), 10)
      const receivedAt = Number.isFinite(internalMs) ? new Date(internalMs).toISOString() : new Date().toISOString()
      if (Number.isFinite(internalMs) && (internalMs < windowStartMs || internalMs > windowEndMs)) {
        continue
      }
      if (
        !isWellsFargoAtmReceiptEmail({
          subject,
          from,
          body: String(full.snippet ?? ''),
        })
      ) {
        continue
      }
      searched += 1

      const inline = decodeGmailInlineHtmlAndText(full.payload)
      const html = inline.html.slice(0, 200000)
      const text = (inline.text || (!html ? String(full.snippet ?? '') : '')).slice(0, 50000)
      const parsed = parseWellsFargoAtmReceipt(text || null, html || null)
      const extracted = { is_booking_confirmed: false, atm: parsed } as Json
      const row = {
        raw_body_text: text || html.slice(0, 50000) || null,
        raw_body_html: html || null,
        platform_key: WELLS_FARGO_ATM_PLATFORM_KEY,
        extracted_data: extracted,
      }

      if (existing?.id) {
        const { error: updErr } = await client.from('reservation_imports').update(row).eq('id', existing.id)
        if (!updErr) imported += 1
        continue
      }

      const { error: insertErr } = await client.from('reservation_imports').insert({
        message_id: messageId,
        source_email: from,
        subject,
        received_at: receivedAt,
        status: 'pending',
        ...row,
      })
      if (!insertErr) imported += 1
    } catch {
      continue
    }
  }

  return { imported, searched }
}
