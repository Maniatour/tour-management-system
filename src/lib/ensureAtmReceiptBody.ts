import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import {
  fetchGmailMessageHtmlAndText,
  parseStoredGmailMessageId,
  refreshGmailAccessToken,
} from '@/lib/gmailMessageBody'
import { htmlEmailToPlainTextKeepLines } from '@/lib/zellePaymentEmail'
import {
  parseWellsFargoAtmReceipt,
  WELLS_FARGO_ATM_PLATFORM_KEY,
  type ParsedWellsFargoAtmReceipt,
} from '@/lib/wellsFargoAtmReceipt'

export type AtmReceiptBodyPayload = {
  id: string
  subject: string | null
  receivedAt: string | null
  html: string | null
  text: string | null
  parsed: ParsedWellsFargoAtmReceipt
  fetchedFromGmail: boolean
}

function looksHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]{0,80}>/i.test(s)
}

function mergeExtractedAtm(existing: unknown, parsed: ParsedWellsFargoAtmReceipt): Json {
  const prev =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return {
    ...prev,
    is_booking_confirmed: false,
    atm: parsed,
  } as Json
}

function toDisplay(htmlRaw: string, textRaw: string): { html: string | null; text: string | null } {
  const html = htmlRaw || (looksHtml(textRaw) ? textRaw : '')
  const text = html ? htmlEmailToPlainTextKeepLines(html) : textRaw
  return { html: html || null, text: text || null }
}

export async function ensureAtmReceiptBody(
  client: SupabaseClient,
  importId: string
): Promise<AtmReceiptBodyPayload | { error: string; status: number }> {
  const { data, error } = await client
    .from('reservation_imports')
    .select(
      'id, subject, received_at, message_id, raw_body_text, raw_body_html, extracted_data, platform_key'
    )
    .eq('id', importId)
    .maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!data) return { error: '메일을 찾을 수 없습니다.', status: 404 }

  let htmlRaw = String(data.raw_body_html ?? '').trim()
  let textRaw = String(data.raw_body_text ?? '').trim()
  let fetchedFromGmail = false

  if (!htmlRaw && !textRaw) {
    const token = await refreshGmailAccessToken(client)
    if ('error' in token) return { error: token.error, status: 400 }
    const gmailId = parseStoredGmailMessageId(data.message_id)
    if (!gmailId) {
      return { error: 'Gmail 메시지 ID가 없어 본문을 가져올 수 없습니다.', status: 400 }
    }
    let fetched: { text: string; html: string | null; httpStatus: number }
    try {
      fetched = await fetchGmailMessageHtmlAndText(token.accessToken, gmailId)
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
      return {
        error: timedOut
          ? 'Gmail 본문 요청이 시간 초과되었습니다. 다시 시도해 주세요.'
          : e instanceof Error
            ? e.message
            : 'Gmail 본문을 가져오지 못했습니다.',
        status: timedOut ? 504 : 502,
      }
    }
    htmlRaw = String(fetched.html ?? '').trim().slice(0, 200000)
    textRaw = String(fetched.text ?? '').trim().slice(0, 50000)
    if (!htmlRaw && !textRaw) {
      return {
        error: `Gmail에서 본문을 가져오지 못했습니다. (HTTP ${fetched.httpStatus})`,
        status: 502,
      }
    }
    fetchedFromGmail = true
    const parsedNow = parseWellsFargoAtmReceipt(textRaw || null, htmlRaw || null)
    const { error: updErr } = await client
      .from('reservation_imports')
      .update({
        raw_body_text: textRaw || htmlRaw.slice(0, 50000),
        raw_body_html: htmlRaw || null,
        platform_key: data.platform_key || WELLS_FARGO_ATM_PLATFORM_KEY,
        extracted_data: mergeExtractedAtm(data.extracted_data, parsedNow),
      })
      .eq('id', importId)
    if (updErr) {
      console.error('[atm-receipt] persist gmail body:', updErr.message)
    }
  }

  const parsed = parseWellsFargoAtmReceipt(textRaw || null, htmlRaw || null)
  const display = toDisplay(htmlRaw, textRaw)
  return {
    id: data.id,
    subject: data.subject,
    receivedAt: data.received_at,
    html: display.html,
    text: display.text,
    parsed,
    fetchedFromGmail,
  }
}
