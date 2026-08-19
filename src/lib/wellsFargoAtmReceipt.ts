import { htmlEmailToPlainTextKeepLines } from '@/lib/zellePaymentEmail'

export const WELLS_FARGO_ATM_PLATFORM_KEY = 'wells-fargo-atm'
export const ATM_RECEIPT_DAY_WINDOW = 3

export type ParsedWellsFargoAtmReceipt = {
  amount: number | null
  depositDateYmd: string | null
  transactionNumber: string | null
  atmId: string | null
  last4: string | null
  toAccount: string | null
}

/** 은행 Deposit에 연결할 ATM 입금 계좌 */
export const TRIP_MANIA_ATM_TO_ACCOUNT = 'Trip Mania X-4007'

const ATM_SUBJECT_RE = /wells fargo atm receipt/i
const ATM_FROM_RE = /notify\.wellsfargo\.com|alerts@.*wellsfargo/i

export function isWellsFargoAtmReceiptEmail(opts: {
  subject?: string | null
  from?: string | null
  platformKey?: string | null
  body?: string | null
}): boolean {
  if ((opts.platformKey ?? '').trim() === WELLS_FARGO_ATM_PLATFORM_KEY) return true
  const subject = (opts.subject ?? '').replace(/\s+/g, ' ').trim()
  if (ATM_SUBJECT_RE.test(subject)) return true
  const from = opts.from ?? ''
  const body = opts.body ?? ''
  if (ATM_FROM_RE.test(from) && /atm\s+(receipt|deposit)|deposit to checking/i.test(`${subject}\n${body}`)) {
    return true
  }
  return /atm deposit|deposit to checking/i.test(body) && /wellsfargo/i.test(`${from}\n${subject}`)
}

function parseUsdAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseAtmDateToYmd(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(raw.trim())
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  let year = Number(m[3])
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function emailPlainText(text: string | null | undefined, html: string | null | undefined): string {
  const htmlRaw = String(html ?? '').trim()
  const textRaw = String(text ?? '').trim()
  if (htmlRaw) return htmlEmailToPlainTextKeepLines(htmlRaw)
  if (/<\/?[a-z][\s\S]{0,80}>/i.test(textRaw)) return htmlEmailToPlainTextKeepLines(textRaw)
  return textRaw
}

export function parseWellsFargoAtmReceipt(
  text: string | null | undefined,
  html?: string | null
): ParsedWellsFargoAtmReceipt {
  const body = emailPlainText(text, html)

  const amountMatch =
    body.match(/\bAmount\s*\$?\s*([\d,]+\.\d{2})/i) ||
    body.match(/\bTotal\s*\$?\s*([\d,]+\.\d{2})/i)
  const dateMatch =
    body.match(/\bDate:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
    body.match(/\bDeposit Credit Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  const txnMatch = body.match(/\bTransaction\s*#:\s*([0-9A-Za-z]+)/i)
  const atmMatch = body.match(/\bATM ID:\s*([0-9A-Za-z]+)/i)
  const last4Match = body.match(/\b(?:Customer Card|Card)[^\n]{0,40}?X+(\d{4})/i)
  const toMatch =
    body.match(/(?:^|\n)\s*To:?\s*(.+)/im) ||
    body.match(/\bTo:?\s*(Trip\s*Mania[^\n]*)/i)

  return {
    amount: amountMatch ? parseUsdAmount(amountMatch[1]) : null,
    depositDateYmd: dateMatch ? parseAtmDateToYmd(dateMatch[1]) : null,
    transactionNumber: txnMatch?.[1] ?? null,
    atmId: atmMatch?.[1] ?? null,
    last4: last4Match?.[1] ?? null,
    toAccount: toMatch?.[1]?.replace(/\s+/g, ' ').trim() || null,
  }
}

export function isTripManiaAtmToAccount(toAccount: string | null | undefined): boolean {
  const s = String(toAccount ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return false
  return /trip\s*mania/i.test(s) && /x[\s-]*4007/i.test(s)
}

export function atmToAccountLinkError(parsed: ParsedWellsFargoAtmReceipt): string | null {
  if (!parsed.toAccount) {
    return `본문에 To: ${TRIP_MANIA_ATM_TO_ACCOUNT} 이 없습니다. 이 메일로는 연결할 수 없습니다.`
  }
  if (!isTripManiaAtmToAccount(parsed.toAccount)) {
    return `입금 계좌가 ${TRIP_MANIA_ATM_TO_ACCOUNT} 이 아닙니다. (To: ${parsed.toAccount})`
  }
  return null
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

export function cashTransactionDateYmd(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim()
  const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (prefix) return prefix[1]
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
