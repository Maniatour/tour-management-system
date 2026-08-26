import type { SupabaseClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type GmailPart = {
  mimeType?: string
  filename?: string
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

function isTextPart(mime: string): boolean {
  return mime.includes('text/html') || mime.includes('text/plain') || mime === ''
}

export function decodeGmailInlineHtmlAndText(payload: GmailPart | undefined): { text: string; html: string } {
  const texts: string[] = []
  const htmls: string[] = []
  const walk = (part: GmailPart | undefined) => {
    if (!part) return
    const mime = (part.mimeType ?? '').toLowerCase()
    if (mime.startsWith('multipart/')) {
      for (const child of part.parts ?? []) walk(child)
      return
    }
    if (part.body?.data && isTextPart(mime)) {
      const decoded = decodeBase64Url(part.body.data)
      if (mime.includes('text/html')) htmls.push(decoded)
      else texts.push(decoded)
    }
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return { text: texts.join('\n\n').trim(), html: htmls.join('\n\n').trim() }
}

export function decodeGmailPayload(payload: GmailPart | undefined): string {
  const { text, html } = decodeGmailInlineHtmlAndText(payload)
  return text || html
}

function collectTextAttachmentIds(
  payload: GmailPart | undefined
): Array<{ mime: string; attachmentId: string; filename?: string }> {
  const out: Array<{ mime: string; attachmentId: string; filename?: string }> = []
  const walk = (part: GmailPart | undefined) => {
    if (!part) return
    const mime = (part.mimeType ?? '').toLowerCase()
    if (mime.startsWith('multipart/')) {
      for (const child of part.parts ?? []) walk(child)
      return
    }
    const attachmentId = part.body?.attachmentId
    const filename = String(part.filename ?? '')
    const htmlFile = /\.html?$/i.test(filename)
    if (attachmentId && (isTextPart(mime) || htmlFile) && !part.body?.data) {
      out.push({ mime: htmlFile && !mime ? 'text/html' : mime, attachmentId, filename })
    }
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return out
}

export function zelleBodyLooksComplete(body: string): boolean {
  const s = body.replace(/\s+/g, ' ')
  return (
    /you sent/i.test(s) &&
    /\$\s*[\d,]+/.test(s) &&
    /(?:confirmation(?:\s+number)?|memo|date\s*:)/i.test(s)
  )
}

async function fetchGmailAttachment(
  accessToken: string,
  gmailId: string,
  attachmentId: string
): Promise<string> {
  const res = await fetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return ''
  const json = (await res.json()) as { data?: string }
  if (!json.data) return ''
  return decodeBase64Url(json.data)
}

async function fetchGmailRawRfc822(accessToken: string, gmailId: string): Promise<string> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailId)}?format=raw`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ''
  const json = (await res.json()) as { raw?: string }
  if (!json.raw) return ''
  return decodeBase64Url(json.raw)
}

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

export async function extractGmailMessageText(
  full: { payload?: GmailPart; snippet?: string },
  accessToken: string,
  gmailId: string
): Promise<string> {
  const texts: string[] = []
  const htmls: string[] = []
  const inline = decodeGmailPayload(full.payload)
  if (inline.trim()) {
    const mimeGuess = /<\/?[a-z][\s\S]{0,80}>/i.test(inline) ? 'html' : 'text'
    if (mimeGuess === 'html') htmls.push(inline)
    else texts.push(inline)
  }

  for (const part of collectTextAttachmentIds(full.payload)) {
    const decoded = await fetchGmailAttachment(accessToken, gmailId, part.attachmentId)
    if (!decoded.trim()) continue
    if (part.mime.includes('text/html') || /\.html?$/i.test(part.filename ?? '')) htmls.push(decoded)
    else texts.push(decoded)
  }

  const textBody = texts.join('\n\n').trim()
  const htmlBody = htmls.join('\n\n').trim()
  let body = zelleBodyLooksComplete(htmlBody)
    ? htmlBody
    : zelleBodyLooksComplete(textBody)
      ? textBody
      : htmlBody || textBody
  const snippet = String(full.snippet ?? '').trim()
  if (snippet && !zelleBodyLooksComplete(body)) {
    body = body ? `${body}\n${snippet}` : snippet
  }
  /**
   * RAW RFC822는 Zelle처럼 Gmail 파트가 불완전할 때만 사용한다.
   * 예약 알림(Wix 등)에 붙이면 DKIM·base64가 본문 미리보기에 그대로 노출된다.
   */
  const maybeZelle = /zelle|you sent money|payment sent/i.test(`${body}\n${snippet}`)
  if (!zelleBodyLooksComplete(body) && (maybeZelle || !body.trim())) {
    const raw = await fetchGmailRawRfc822(accessToken, gmailId)
    if (raw.trim()) {
      const decoded = decodeQuotedPrintable(raw)
      if (zelleBodyLooksComplete(decoded)) {
        body = decoded
      } else if (!body.trim() && decoded.trim()) {
        body = decoded
      }
    }
  }
  return body.trim()
}

/** reservation_imports.message_id 형식 `<gmailId@gmail>` → Gmail API id */
export function parseStoredGmailMessageId(messageId: string | null | undefined): string | null {
  const s = String(messageId ?? '').trim()
  if (!s) return null
  const wrapped = /^<([^@>\s]+)@gmail>$/i.exec(s)
  if (wrapped?.[1]) return wrapped[1]
  if (/^[a-f0-9]+$/i.test(s)) return s
  return null
}

export async function refreshGmailAccessToken(
  client: SupabaseClient
): Promise<{ accessToken: string } | { error: string }> {
  const { data: conn, error: connError } = await fromUntypedTable(client, 'gmail_connections')
    .select('refresh_token')
    .limit(1)
    .maybeSingle()
  const refreshToken = (conn as { refresh_token?: string } | null)?.refresh_token
  if (connError || !refreshToken) {
    return { error: 'Gmail이 연결되어 있지 않습니다. 예약 가져오기에서 Gmail을 연결해 주세요.' }
  }
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { error: 'Gmail 연동 환경 변수가 없습니다.' }
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    error_description?: string
    error?: string
  }
  if (!tokenRes.ok || !tokenData.access_token) {
    return {
      error: tokenData.error_description || tokenData.error || 'Gmail 토큰을 갱신하지 못했습니다.',
    }
  }
  return { accessToken: tokenData.access_token }
}

export async function fetchGmailMessageBody(
  accessToken: string,
  gmailId: string
): Promise<string> {
  const result = await fetchGmailMessageBodyDetailed(accessToken, gmailId)
  return result.text
}

export async function fetchGmailMessageBodyDetailed(
  accessToken: string,
  gmailId: string
): Promise<{ text: string; httpStatus: number }> {
  const getRes = await fetch(`${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!getRes.ok) {
    if (getRes.status === 404) {
      const raw = await fetchGmailRawRfc822(accessToken, gmailId)
      return { text: decodeQuotedPrintable(raw).trim(), httpStatus: getRes.status }
    }
    return { text: '', httpStatus: getRes.status }
  }
  const full = (await getRes.json()) as { payload?: GmailPart; snippet?: string }
  const text = await extractGmailMessageText(full, accessToken, gmailId)
  return { text, httpStatus: getRes.status }
}

/** ATM Receipt 미리보기용 — format=full 본문만. RAW·첨부 대량 다운로드는 하지 않습니다. */
export async function fetchGmailMessageHtmlAndText(
  accessToken: string,
  gmailId: string
): Promise<{ text: string; html: string | null; httpStatus: number }> {
  const getRes = await fetch(`${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000),
  })
  if (!getRes.ok) {
    return { text: '', html: null, httpStatus: getRes.status }
  }

  const full = (await getRes.json()) as { payload?: GmailPart; snippet?: string }
  const inline = decodeGmailInlineHtmlAndText(full.payload)
  if (inline.html || inline.text) {
    return { text: inline.text, html: inline.html || null, httpStatus: getRes.status }
  }

  const htmlParts = collectTextAttachmentIds(full.payload)
    .filter(
      (part) =>
        part.mime.includes('text/html') ||
        part.mime.includes('text/plain') ||
        /\.html?$/i.test(part.filename ?? '')
    )
    .slice(0, 2)
  const texts: string[] = []
  const htmls: string[] = []
  for (const part of htmlParts) {
    const decoded = await fetchGmailAttachment(accessToken, gmailId, part.attachmentId)
    if (!decoded.trim()) continue
    if (part.mime.includes('text/html') || /\.html?$/i.test(part.filename ?? '')) htmls.push(decoded)
    else texts.push(decoded)
  }

  const html = htmls.join('\n\n').trim()
  const text = texts.join('\n\n').trim() || String(full.snippet ?? '').trim()
  return { text, html: html || null, httpStatus: getRes.status }
}
