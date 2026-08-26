const RFC822_HEADER_RE =
  /\r?\n(?:Received|X-Received|Return-Path|Authentication-Results|DKIM-Signature|ARC-Seal|ARC-Authentication-Results|ARC-Message-Signature|X-Google-DKIM-Signature|X-Gm-Message-State|X-Google-Smtp-Source)\s*:/i

const BASE64_BLOCK_RE = /\r?\n(?:[A-Za-z0-9+/]{72,}={0,2}\r?\n){4,}/

const BOOKING_DETAIL_RE =
  /\b(?:When|Location|Staff|Price|Choose\s+one|Pick[\s-]*up\s*(?:Hotel|Location)|View\s+Session|Number\s+of\s+participants)\s*:/i

function extractHtmlDocument(raw: string): string | null {
  const doctype = raw.search(/<!DOCTYPE\s+html/i)
  const htmlTag = raw.search(/<html[\s>]/i)
  const start = doctype >= 0 ? doctype : htmlTag
  if (start < 0) return null
  const close = raw.slice(start).search(/<\/html>/i)
  if (close >= 0) return raw.slice(start, start + close + '</html>'.length).trim()
  const headerDump = RFC822_HEADER_RE.exec(raw.slice(start))
  if (headerDump && headerDump.index > 80) {
    return raw.slice(start, start + headerDump.index).trim()
  }
  return raw.slice(start).trim() || null
}

function looksLikeBookingDetails(text: string): boolean {
  const t = text.trim()
  if (t.length < 8) return false
  return BOOKING_DETAIL_RE.test(t) || /라스베가스\s*[>＞]/.test(t)
}

function htmlAlreadyHasSessionDetails(html: string): boolean {
  return /\bWhen\s*:/i.test(html) && /\bPrice\s*:/i.test(html)
}

function stripMimeChrome(s: string): string {
  return s
    .replace(/^\s*--[A-Za-z0-9._=-]{8,}\s*$/gm, '')
    .replace(/^\s*Content-(?:Type|Transfer-Encoding|Disposition)\s*:.*$/gim, '')
    .replace(/^\s*charset\s*=.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractTrailingBookingBlock(text: string): string {
  const chromeStripped = stripMimeChrome(text)
  if (!chromeStripped) return ''
  const markers = [
    /라스베가스\s*[>＞]/,
    /\bWhen\s*:/i,
    /\bLocation\s*:/i,
    /\bChoose\s+one\s*:/i,
  ]
  let start = -1
  for (const re of markers) {
    const m = re.exec(chromeStripped)
    if (m && (start < 0 || m.index < start)) start = m.index
  }
  if (start >= 0) return chromeStripped.slice(start).trim()
  return looksLikeBookingDetails(chromeStripped) ? chromeStripped : ''
}

function injectPlainAfterHtml(html: string, extraPlain: string): string {
  const extra = extractTrailingBookingBlock(extraPlain)
  if (!extra) return html
  if (htmlAlreadyHasSessionDetails(html) && html.includes(extra.slice(0, Math.min(40, extra.length)))) {
    return html
  }
  const block = `<div data-import-email-rest style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;white-space:pre-wrap;font:14px/1.65 ui-sans-serif,system-ui,sans-serif;color:#111827">${escapeHtml(extra)}</div>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${block}</html>`)
  return `${html}${block}`
}

function wrapFragmentAsHtml(fragment: string): string {
  const css =
    '<style>html,body{height:auto!important;max-height:none!important;overflow:visible!important;}</style>'
  if (/<html[\s>]/i.test(fragment) || /<!DOCTYPE\s+html/i.test(fragment)) {
    if (/<head[\s>]/i.test(fragment)) return fragment.replace(/<head[^>]*>/i, (m) => `${m}${css}`)
    return fragment.replace(/<html[^>]*>/i, (m) => `${m}<head>${css}</head>`)
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${css}</head><body>${fragment}</body></html>`
}

/** RFC822 전송 헤더·base64만 제거. HTML 첫 문서 뒤에서 예약 본문을 버리지 않는다. */
export function stripRfc822NoiseFromImportedEmailBody(raw: string): string {
  if (!raw?.trim()) return ''
  let out = raw
  const header = RFC822_HEADER_RE.exec(out)
  if (header && header.index > 40) out = out.slice(0, header.index)

  const b64 = BASE64_BLOCK_RE.exec(out)
  if (b64 && b64.index > 120) out = out.slice(0, b64.index)

  return out.trim()
}

export function importedEmailLooksLikeHtml(s: string): boolean {
  const t = s.trimStart()
  if (!t) return false
  if (/^<!DOCTYPE\s+html|^<html[\s>]|^<head[\s>]|^<body[\s>]/i.test(t)) return true
  const head = t.slice(0, 2500)
  const tags = head.match(/<[a-z][a-z0-9]*\b[^>]*>/gi) ?? []
  return tags.length >= 5 && /<(?:table|div|p|h[1-6]|img|span|td|tr)\b/i.test(head)
}

export function getImportedEmailPreviewParts(
  text: string | null | undefined,
  html: string | null | undefined
): { htmlSrcDoc: string | null; plainText: string; sourceCode: string } {
  const rawHtml = (html ?? '').trim()
  const rawText = (text ?? '').trim()
  const sourceCode = rawText || rawHtml
  const cleanedHtml = stripRfc822NoiseFromImportedEmailBody(rawHtml)
  const cleanedText = stripRfc822NoiseFromImportedEmailBody(rawText || rawHtml)

  const htmlSource = cleanedHtml || cleanedText
  const htmlDoc = extractHtmlDocument(htmlSource)

  if (htmlDoc && importedEmailLooksLikeHtml(htmlDoc)) {
    const afterSame = htmlSource.slice(htmlSource.indexOf(htmlDoc) + htmlDoc.length)
    const extra = [afterSame, cleanedText !== htmlSource ? cleanedText : ''].filter(Boolean).join('\n\n')
    const withRest = injectPlainAfterHtml(htmlDoc, extra)
    return { htmlSrcDoc: wrapFragmentAsHtml(withRest), plainText: '', sourceCode }
  }

  if (importedEmailLooksLikeHtml(cleanedText)) {
    return { htmlSrcDoc: wrapFragmentAsHtml(cleanedText), plainText: '', sourceCode }
  }

  return { htmlSrcDoc: null, plainText: stripMimeChrome(cleanedText) || rawText, sourceCode }
}
