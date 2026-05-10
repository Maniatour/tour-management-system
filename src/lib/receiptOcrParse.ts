/**
 * 영수증 OCR 원문 → 후보 필드 (서버·클라이언트 공통, Tesseract 없음)
 */

import {
  DEFAULT_RECEIPT_OCR_PARSE_RUNTIME,
  normalizeReceiptBodyForMatch,
  type ReceiptOcrParseRuntime,
} from '@/lib/receiptOcrParseRules'

export type ReceiptOcrCandidates = {
  paid_to: string
  amount: number | null
  date: string | null
  payment_method_text: string
  card_last4: string
  paid_for: string
  /** 본문 매칭 규칙으로 지정된 payment_methods.id (활성 옵션에 있을 때만 반영) */
  payment_method_id?: string | null
}

export type ReceiptOcrParseOptions = {
  /** 생략 시 내장 분류 키워드만 사용 */
  runtime?: ReceiptOcrParseRuntime | null
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/,/g, '')
  const match = normalized.match(/\$?\s*(\d{1,6}(?:\.\d{2})?)\b/)
  if (!match) return null
  const amount = Number.parseFloat(match[1])
  return Number.isFinite(amount) ? amount : null
}

function extractAmount(lines: string[], runtime: ReceiptOcrParseRuntime): number | null {
  if (runtime.amountLineHintRes.length > 0) {
    const hinted = lines.filter((line) => runtime.amountLineHintRes.some((re) => re.test(line)))
    if (hinted.length > 0) {
      const fromHints = hinted
        .map((line) => parseAmount(line))
        .filter((amount): amount is number => amount !== null && amount > 0)
      if (fromHints.length > 0) return Math.max(...fromHints)
    }
  }

  const totalLines = lines.filter((line) => {
    const lower = line.toLowerCase()
    if (!/(grand\s+total|total|amount\s+paid|balance\s+due|sale)/i.test(line)) return false
    if (/(subtotal|sub\s*total|tax|tip|change|cash\s+tendered)/i.test(lower)) return false
    return /\$?\s*\d{1,6}(?:,\d{3})*(?:\.\d{2})\b/.test(line)
  })

  for (const line of totalLines) {
    const amount = parseAmount(line)
    if (amount !== null) return amount
  }

  const allAmounts = lines
    .flatMap((line) => line.match(/\$?\s*\d{1,6}(?:,\d{3})*(?:\.\d{2})\b/g) || [])
    .map(parseAmount)
    .filter((amount): amount is number => amount !== null && amount > 0)

  if (allAmounts.length === 0) return null
  return Math.max(...allAmounts)
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const fullYear = year < 100 ? 2000 + year : year
  if (fullYear < 2000 || fullYear > 2100) return null
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractDate(text: string): string | null {
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if (slash) {
    return toIsoDate(Number.parseInt(slash[3], 10), Number.parseInt(slash[1], 10), Number.parseInt(slash[2], 10))
  }

  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) {
    return toIsoDate(Number.parseInt(iso[1], 10), Number.parseInt(iso[2], 10), Number.parseInt(iso[3], 10))
  }

  return null
}

function extractPaidTo(lines: string[], runtime: ReceiptOcrParseRuntime): string {
  const ignored =
    /^(receipt|invoice|sale|customer|merchant|store|date|time|tel|phone|address|thank|welcome|\d+|www\.|http)/i
  const candidate = lines.find((line) => {
    const normalized = normalizeWhitespace(line)
    if (normalized.length < 3 || normalized.length > 48) return false
    if (ignored.test(normalized)) return false
    if (runtime.paidToSkipRes.some((re) => re.test(normalized))) return false
    if (/\$?\s*\d+(?:\.\d{2})/.test(normalized)) return false
    return /[a-zA-Z]/.test(normalized)
  })
  return candidate ? normalizeWhitespace(candidate) : ''
}

function extractPayment(text: string): { payment_method_text: string; card_last4: string } {
  const cardBrand = text.match(/\b(visa|mastercard|amex|discover)\b/i)?.[1] || ''

  let cardLast4 =
    text
      .match(
        /(?:visa|mastercard|amex|discover|card|acct|account)[^\n\r]{0,40}(?:\*{2,}|x{2,}|ending\s+in\s+)?\s*(\d{4})\b/i
      )
      ?.at(1) ||
    text.match(/(?:\*{2,}|x{2,})\s*(\d{4})\b/i)?.[1] ||
    ''

  // OCR 깨짐: "AXAXKKXXKKK 1335 |" — 문자·K·X 섞인 마스크 뒤 네 자리
  if (!cardLast4) {
    cardLast4 =
      text.match(/\b[A-Z*KX]{6,}\s+(\d{4})(?:\s*\||\s*$|\s*\n)/im)?.[1] ||
      text.match(/\b[A-Z*KX]{6,}\s+(\d{4})\b/i)?.[1] ||
      ''
  }

  // 브랜드(Amex 등) 언급 이후 구간에서 카드 끝 4자리 후보 스캔
  if (!cardLast4 && cardBrand) {
    const brandIdx = text.search(new RegExp(`\\b${cardBrand}\\b`, 'i'))
    if (brandIdx >= 0) {
      const slice = text.slice(brandIdx, brandIdx + 320)
      const four = slice.match(/\b(?!(?:19|20)\d{2}\b)(?<!\d)(\d{4})(?!\d)/g) || []
      const bad = new Set(['8604', '4271', '2256', '6703', '9990', '2026', '8036', '3604'])
      for (const f of four) {
        if (bad.has(f)) continue
        cardLast4 = f
        break
      }
    }
  }

  return {
    payment_method_text: cardBrand,
    card_last4: cardLast4,
  }
}

function inferPaidFor(text: string, runtime: ReceiptOcrParseRuntime): string {
  const lower = text.toLowerCase()
  return (
    runtime.categoryKeywordRows.find((category) =>
      category.keywords.some((keyword) => lower.includes(keyword))
    )?.paidFor || ''
  )
}

/** shared_settings 의 body_match_rules — 본문에 문구가 포함되면 첫 일치만 적용 */
function applyBodyMatchRules(
  rawText: string,
  c: ReceiptOcrCandidates,
  runtime: ReceiptOcrParseRuntime
): ReceiptOcrCandidates {
  if (!runtime.bodyMatchRules.length) return c
  const hay = normalizeReceiptBodyForMatch(rawText)
  for (const rule of runtime.bodyMatchRules) {
    if (!hay.includes(rule.containsNorm)) continue
    const next = { ...c }
    if (rule.paidTo) next.paid_to = rule.paidTo
    if (rule.paidFor) next.paid_for = rule.paidFor
    if (rule.paymentMethodId) next.payment_method_id = rule.paymentMethodId
    if (rule.paymentUseCcLabel && next.card_last4.trim()) {
      next.payment_method_text = 'CC'
    }
    return next
  }
  return c
}

export function buildReceiptOcrCandidates(rawText: string, options?: ReceiptOcrParseOptions): ReceiptOcrCandidates {
  const runtime = options?.runtime ?? DEFAULT_RECEIPT_OCR_PARSE_RUNTIME

  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .filter(Boolean)

  const payment = extractPayment(rawText)

  const base: ReceiptOcrCandidates = {
    paid_to: extractPaidTo(lines, runtime),
    amount: extractAmount(lines, runtime),
    date: extractDate(rawText),
    payment_method_text: payment.payment_method_text,
    card_last4: payment.card_last4,
    paid_for: inferPaidFor(rawText, runtime),
  }

  return applyBodyMatchRules(rawText, base, runtime)
}
