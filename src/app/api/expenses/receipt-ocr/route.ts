import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { recognize } from 'tesseract.js'

export const runtime = 'nodejs'
export const maxDuration = 120

type ReceiptOcrCandidates = {
  paid_to: string
  amount: number | null
  date: string | null
  payment_method_text: string
  card_last4: string
  paid_for: string
}

const CATEGORY_KEYWORDS: Array<{ paidFor: string; keywords: string[] }> = [
  { paidFor: 'Gas', keywords: ['gas', 'fuel', 'shell', 'chevron', 'arco', 'exxon', 'mobil', '76', 'circle k', 'speedway'] },
  { paidFor: 'Meals', keywords: ['restaurant', 'cafe', 'diner', 'burger', 'pizza', 'grill', 'kitchen', 'mcdonald', 'subway', 'starbucks'] },
  { paidFor: 'Entrance Fee', keywords: ['admission', 'entrance', 'ticket', 'park fee', 'canyon', 'national park'] },
  { paidFor: 'Parking', keywords: ['parking'] },
]

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

function extractAmount(lines: string[]): number | null {
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

function extractPaidTo(lines: string[]): string {
  const ignored = /^(receipt|invoice|sale|customer|merchant|store|date|time|tel|phone|address|thank|welcome|\d+|www\.|http)/i
  const candidate = lines.find((line) => {
    const normalized = normalizeWhitespace(line)
    if (normalized.length < 3 || normalized.length > 48) return false
    if (ignored.test(normalized)) return false
    if (/\$?\s*\d+(?:\.\d{2})/.test(normalized)) return false
    return /[a-zA-Z]/.test(normalized)
  })
  return candidate ? normalizeWhitespace(candidate) : ''
}

function extractPayment(text: string): { payment_method_text: string; card_last4: string } {
  const cardMatch =
    text.match(/(?:visa|mastercard|amex|discover|card|acct|account)[^\n\r]{0,30}(?:\*{2,}|x{2,}|ending\s+in\s+)?\s*(\d{4})/i) ||
    text.match(/(?:\*{2,}|x{2,})\s*(\d{4})\b/i)
  const cardBrand = text.match(/\b(visa|mastercard|amex|discover)\b/i)?.[1] || ''

  return {
    payment_method_text: cardBrand,
    card_last4: cardMatch?.[1] || ''
  }
}

function inferPaidFor(text: string): string {
  const lower = text.toLowerCase()
  return CATEGORY_KEYWORDS.find((category) =>
    category.keywords.some((keyword) => lower.includes(keyword))
  )?.paidFor || ''
}

function buildCandidates(rawText: string): ReceiptOcrCandidates {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .filter(Boolean)

  const payment = extractPayment(rawText)

  return {
    paid_to: extractPaidTo(lines),
    amount: extractAmount(lines),
    date: extractDate(rawText),
    payment_method_text: payment.payment_method_text,
    card_last4: payment.card_last4,
    paid_for: inferPaidFor(rawText),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Could not fetch receipt image (${imageResponse.status})` },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const result = await recognize(imageBuffer, 'eng')
    const text = result.data.text || ''

    return NextResponse.json({
      text,
      candidates: buildCandidates(text)
    })
  } catch (error) {
    console.error('Receipt OCR failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Receipt OCR failed' },
      { status: 500 }
    )
  }
}
