/** Wells Fargo / Zelle 「You sent money with Zelle」 송금 확인 메일 */

export const ZELLE_PAYMENT_PLATFORM_KEY = 'zelle'

export type ParsedZellePaymentEmail = {
  amount: number | null
  recipient: string | null
  /** YYYY-MM-DD (이메일 Date, 보통 입장권 체크인일 또는 전날) */
  paymentDateYmd: string | null
  /** paymentDateYmd + 1일 — 입장권 체크인 후보 */
  nextDateYmd: string | null
  fromAccountLast4: string | null
  confirmationNumber: string | null
  memo: string | null
  rnNumbers: string[]
  /** 메모에 Invoice # / invoice 로 적힌 번호 */
  invoiceNumbers: string[]
}

const ZELLE_SENT_SUBJECT_RE = /you sent money with zelle/i

export function isZellePaymentSentEmail(subject: string | null | undefined): boolean {
  return ZELLE_SENT_SUBJECT_RE.test((subject ?? '').replace(/\s+/g, ' ').trim())
}

export function htmlEmailToPlainTextKeepLines(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:tr|table|div|p|th|li|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : ''
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]{0,80}>/i.test(s) || /&nbsp;|&#\d+;/.test(s)
}

function cleanRecipientName(name: string): string {
  const cut = name.split(/\b(?:date|from account|confirmation number|memo|see zelle)\b/i)[0] ?? name
  return cut
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeTicketRnToken(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/^#+/, '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
}

export function addCalendarDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days))
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function parseUsDateToYmd(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseUsdAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function extractRnNumbersFromMemo(memo: string | null | undefined): string[] {
  const text = String(memo ?? '')
  const found: string[] = []
  const seen = new Set<string>()
  const re = /#\s*([0-9]{3,12})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const token = normalizeTicketRnToken(m[1])
    if (!token || seen.has(token)) continue
    seen.add(token)
    found.push(token)
  }
  if (found.length > 0) return found
  const loose = /(?:^|[\s,;])([0-9]{4,12})(?=$|[\s,;])/g
  while ((m = loose.exec(text))) {
    const token = normalizeTicketRnToken(m[1])
    if (!token || seen.has(token)) continue
    seen.add(token)
    found.push(token)
  }
  return found
}

/** 메모의 Invoice # / invoice / 인보이스 표기에서 번호 추출 */
export function extractInvoiceNumbersFromMemo(memo: string | null | undefined): string[] {
  const text = String(memo ?? '')
  const found: string[] = []
  const seen = new Set<string>()
  const re =
    /(?:invoice|inv\.?|인보이스)\s*(?:no\.?|num(?:ber)?)?\s*[#.:-]?\s*([0-9A-Za-z-]{3,20})/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const token = normalizeTicketRnToken(m[1])
    if (!token || seen.has(token)) continue
    seen.add(token)
    found.push(token)
  }
  return found
}

export function zelleMemoRefTokens(parsed: {
  rnNumbers?: string[] | null | undefined
  invoiceNumbers?: string[] | null | undefined
}): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(parsed.rnNumbers ?? []), ...(parsed.invoiceNumbers ?? [])]) {
    const token = normalizeTicketRnToken(raw)
    if (!token || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function recipientLooksLikeVendor(name: string): boolean {
  const t = name.trim()
  if (t.length < 2 || t.length > 80) return false
  if (/^(date|from|memo|confirmation|account|zelle|wells)$/i.test(t)) return false
  return true
}

export function parseZellePaymentEmail(
  text: string | null | undefined,
  html?: string | null
): ParsedZellePaymentEmail {
  const rawText = (text ?? '').trim()
  const rawHtml = (html ?? '').trim()
  let body = [rawText, rawHtml].filter(Boolean).join('\n')
  if (!body) {
    return {
      amount: null,
      recipient: null,
      paymentDateYmd: null,
      nextDateYmd: null,
      fromAccountLast4: null,
      confirmationNumber: null,
      memo: null,
      rnNumbers: [],
      invoiceNumbers: [],
    }
  }
  if (looksLikeHtml(body)) body = htmlEmailToPlainTextKeepLines(body)
  body = body.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200b\u200c\u200d\ufeff]/g, '')
  body = body.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )

  let amount: number | null = null
  let recipient: string | null = null

  const sentLine =
    body.match(/you sent\s+\$?\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+([^\n<]+)/i) ||
    body.match(/you sent\s+\*\*?\$?\s*([\d,]+(?:\.\d{1,2})?)\*\*?\s+to\s+\*\*?([^\n*]+)/i)
  if (sentLine?.[1]) amount = parseUsdAmount(sentLine[1])
  if (sentLine?.[2]) {
    const name = cleanRecipientName(sentLine[2].replace(/\*/g, ''))
    if (recipientLooksLikeVendor(name)) recipient = name
  }
  if (amount == null) {
    const dollar =
      body.match(/you sent[^$]{0,80}\$\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      body.match(/\$\s*([\d,]+\.\d{2})/) ||
      body.match(/\busd\s*([\d,]+\.\d{2})/i) ||
      body.match(/([\d,]+\.\d{2})\s*usd\b/i)
    if (dollar?.[1]) amount = parseUsdAmount(dollar[1])
  }

  let paymentDateYmd: string | null = null
  const dateLabeled =
    body.match(/\bdate\s*:?\s*(?:<[^>]+>\s*)*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
    body.match(/\bdate\s*:?\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (dateLabeled?.[1]) paymentDateYmd = parseUsDateToYmd(dateLabeled[1])
  if (!paymentDateYmd) {
    const afterSent = body.split(/you sent/i)[1] ?? body
    const head = afterSent.slice(0, 1200)
    const standalone = head.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)
    if (standalone?.[1]) paymentDateYmd = parseUsDateToYmd(standalone[1])
  }

  const last4 =
    body.match(/from account\s*:?\s*\n?\s*\.{0,6}\s*(\d{4})\b/i)?.[1] ??
    body.match(/from account[^\d\n]{0,40}(\d{4})\b/i)?.[1] ??
    null

  const confirmation =
    body.match(/confirmation(?:\s+number)?\s*:?\s*(?:<[^>]+>\s*)*([A-Z0-9]{6,24})/i)?.[1]?.toUpperCase() ??
    body.match(/confirmation(?:\s+number)?\s*:?\s*\n?\s*([A-Z0-9]{6,24})/i)?.[1]?.toUpperCase() ??
    null

  let memo: string | null = null
  const memoLine =
    body.match(/\bmemo\s*:?\s*(?:<[^>]+>\s*)*([^\n<]+)/i) ||
    body.match(/\bmemo\s*:?\s*\n?\s*([^\n]+)/i)
  if (memoLine?.[1]) memo = memoLine[1].trim()

  const afterSent = (body.split(/you sent/i)[1] ?? body).slice(0, 2500)
  let rnNumbers = extractRnNumbersFromMemo(memo)
  if (rnNumbers.length === 0) rnNumbers = extractRnNumbersFromMemo(afterSent)
  let invoiceNumbers = extractInvoiceNumbersFromMemo(memo)
  if (invoiceNumbers.length === 0) invoiceNumbers = extractInvoiceNumbersFromMemo(afterSent)

  return {
    amount,
    recipient,
    paymentDateYmd,
    nextDateYmd: paymentDateYmd ? addCalendarDaysYmd(paymentDateYmd, 1) : null,
    fromAccountLast4: last4,
    confirmationNumber: confirmation,
    memo,
    rnNumbers,
    invoiceNumbers,
  }
}

export function isSeeCanyonZelleRecipient(recipient: string | null | undefined): boolean {
  return /see\s*canyon|seecanyon/i.test(String(recipient ?? ''))
}

/** 메일 본문(텍스트·HTML)에 SEE CANYON이 있는지 */
export function zelleBodyMentionsSeeCanyon(
  text: string | null | undefined,
  html?: string | null
): boolean {
  const blob = `${text ?? ''}\n${html ?? ''}`
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return /see\s*canyon|seecanyon/i.test(blob)
}

export function zelleConfirmationTokens(raw: string | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of String(raw ?? '').split(/[,;/|]+/)) {
    const token = part.trim().toUpperCase()
    if (!token || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

export function mergeZelleConfirmationNumbers(
  existing: string | null | undefined,
  next: string | null | undefined
): string {
  const tokens = zelleConfirmationTokens(
    [existing, next].filter((v) => String(v ?? '').trim()).join(', ')
  )
  return tokens.join(', ')
}

export function zelleConfirmationsOverlap(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const set = new Set(zelleConfirmationTokens(a))
  if (set.size === 0) return false
  return zelleConfirmationTokens(b).some((token) => set.has(token))
}

export function formatZelleConfirmationDisplay(raw: string | null | undefined): string {
  return zelleConfirmationTokens(raw).join(', ')
}

/** SEE CANYON 입장권 현재 단가 (USD) */
export const SEE_CANYON_TICKET_UNIT_USD = 76

/** 본문·받는 사람 기준으로 SEE CANYON LLC 송금인지 판별 */
export function isSeeCanyonZellePayment(
  recipient: string | null | undefined,
  body?: string | null
): boolean {
  if (isSeeCanyonZelleRecipient(recipient)) return true
  if (String(recipient ?? '').trim()) return false
  return /see\s*canyon|seecanyon/i.test(String(body ?? ''))
}

export function zelleRecipientMatchesCompany(
  recipient: string | null | undefined,
  company: string | null | undefined
): boolean {
  const rec = String(recipient ?? '')
    .toLowerCase()
    .replace(/llc|inc|ltd|\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const co = String(company ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (!rec || !co) return true
  const recSee = /see\s*canyon|seecanyon/.test(rec)
  const recDixie = /dixie/.test(rec)
  const recX = /antelope\s*x|\bx\s*canyon/.test(rec)
  const recMei = /mei\s*tour|meitour/.test(rec)
  const recKens = /\bkens\b|ken'?s/.test(rec)
  if (recSee) return /see\s*canyon/.test(co)
  if (recDixie) return /dixie/.test(co)
  if (recX) return /antelope\s*x|\bx\b/.test(co)
  if (recMei) return /mei/.test(co)
  if (recKens) return /ken/.test(co)
  const tokens = rec.split(' ').filter((t) => t.length >= 3)
  if (tokens.length === 0) return true
  return tokens.some((t) => co.includes(t))
}
