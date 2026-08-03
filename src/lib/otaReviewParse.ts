import type { OtaReviewSource } from '@/lib/reviewSources'

export type ParsedOtaReviewRow = {
  authorName: string | null
  rating: number | null
  comment: string | null
  reviewCreatedAt: string | null
  productHint: string | null
  reservationNumber?: string | null
  /** GetYourGuide Travel date — YYYY-MM-DD */
  tourDate?: string | null
  /** Internal product_id (e.g. MDGCSUNRISE) */
  productId?: string | null
  /** Explicit tour to link on import */
  tourId?: string | null
  lineNumber?: number
}

type ColumnKey = 'author' | 'rating' | 'comment' | 'date' | 'product' | 'reservation'

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  author: ['author', 'reviewer', 'name', 'guest', 'customer', 'traveler', 'user', '작성자', '고객'],
  rating: ['rating', 'stars', 'score', 'star', '별점', '평점'],
  comment: [
    'comment',
    'review',
    'text',
    'content',
    'message',
    'body',
    'feedback',
    'description',
    '리뷰',
    '내용',
    '코멘트',
  ],
  date: ['date', 'review_date', 'created', 'created_at', 'reviewed_at', 'submitted', '날짜', '작성일'],
  product: ['product', 'tour', 'activity', 'product_name', 'tour_name', '상품', '투어'],
  reservation: [
    'reservation',
    'reservation_number',
    'booking',
    'booking_ref',
    'booking_reference',
    'channel_rn',
    'reference',
    'order_id',
    '예약번호',
    '예약',
    '예약번호rn',
  ],
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function detectDelimiter(line: string): ',' | '\t' | '|' | ';' {
  const counts: Array<',' | '\t' | '|' | ';'> = [',', '\t', '|', ';']
  let best: ',' | '\t' | '|' | ';' = ','
  let bestCount = 0
  for (const delim of counts) {
    const count = line.split(delim).length - 1
    if (count > bestCount) {
      bestCount = count
      best = delim
    }
  }
  return best
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

function mapHeaders(headers: string[]): Partial<Record<ColumnKey, number>> {
  const mapping: Partial<Record<ColumnKey, number>> = {}
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as Array<[ColumnKey, string[]]>) {
      if (aliases.some((alias) => normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias)))) {
        if (mapping[key] === undefined) {
          mapping[key] = index
        }
      }
    }
  })
  return mapping
}

function parseRating(value: string | undefined | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const starMatch = trimmed.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|stars?|★|⭐)?/i)
  if (starMatch?.[1]) {
    const rating = Number.parseFloat(starMatch[1])
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      return Math.round(rating)
    }
  }
  const digits = trimmed.match(/^(\d)$/)
  if (digits?.[1]) {
    const rating = Number.parseInt(digits[1], 10)
    if (rating >= 1 && rating <= 5) return rating
  }
  return null
}

function parseDate(value: string | undefined | null): string | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value.trim())
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function rowFromCells(
  cells: string[],
  mapping: Partial<Record<ColumnKey, number>>,
  lineNumber?: number
): ParsedOtaReviewRow | null {
  const get = (key: ColumnKey) => {
    const index = mapping[key]
    return index === undefined ? undefined : cells[index]
  }

  const authorName = get('author')?.trim() || null
  const rating = parseRating(get('rating'))
  const comment = get('comment')?.trim() || null
  const reviewCreatedAt = parseDate(get('date'))
  const productHint = get('product')?.trim() || null
  const reservationNumber = get('reservation')?.trim() || null

  if (!authorName && !comment && rating === null && !reservationNumber) {
    return null
  }

  const result: ParsedOtaReviewRow = {
    authorName,
    rating,
    comment,
    reviewCreatedAt,
    productHint,
    reservationNumber,
  }
  if (lineNumber !== undefined) {
    result.lineNumber = lineNumber
  }
  return result
}

function parseDelimitedRows(text: string): ParsedOtaReviewRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0] ?? '')
  const firstCells = parseCsvLine(lines[0] ?? '', delimiter)
  const headerMapping = mapHeaders(firstCells)
  const hasHeader = Object.keys(headerMapping).length >= 2

  const dataLines = hasHeader ? lines.slice(1) : lines
  const mapping = hasHeader
    ? headerMapping
    : ({
        author: 0,
        rating: 1,
        comment: 2,
        date: 3,
        product: 4,
        reservation: 5,
      } satisfies Partial<Record<ColumnKey, number>>)

  const rows: ParsedOtaReviewRow[] = []
  dataLines.forEach((line, index) => {
    const cells = parseCsvLine(line, delimiter)
    const row = rowFromCells(cells, mapping, hasHeader ? index + 2 : index + 1)
    if (row) rows.push(row)
  })

  return rows
}

function parseBlockFormat(text: string): ParsedOtaReviewRow[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  const rows: ParsedOtaReviewRow[] = []

  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) return

    let authorName: string | null = null
    let rating: number | null = null
    let reviewCreatedAt: string | null = null
    const commentLines: string[] = []

    for (const line of lines) {
      const ratingFromLine = parseRating(line)
      if (rating === null && ratingFromLine !== null) {
        rating = ratingFromLine
        continue
      }

      const dateFromLine = parseDate(line)
      if (!reviewCreatedAt && dateFromLine && line.length < 40) {
        reviewCreatedAt = dateFromLine
        continue
      }

      if (!authorName && line.length < 80 && !line.includes('.') && ratingFromLine === null) {
        authorName = line
        continue
      }

      commentLines.push(line)
    }

    const comment = commentLines.join('\n').trim() || null
    if (!authorName && !comment && rating === null) return

    rows.push({
      authorName,
      rating,
      comment,
      reviewCreatedAt,
      productHint: null,
      lineNumber: blockIndex + 1,
    })
  })

  return rows
}

export function parseOtaReviewText(text: string, source?: OtaReviewSource | null): ParsedOtaReviewRow[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (source === 'getyourguide' || isGetYourGuideScrapedText(trimmed)) {
    const gyg = parseGetYourGuideScrapedText(trimmed)
    if (gyg) return [gyg]
  }

  const delimited = parseDelimitedRows(trimmed)
  if (delimited.length > 0) {
    return delimited
  }

  return parseBlockFormat(trimmed)
}

/** GetYourGuide 관리자 화면에서 복사한 리뷰 본문인지 */
export function isGetYourGuideScrapedText(text: string): boolean {
  const sample = text.trim()
  if (!sample) return false
  return (
    /booking\s*reference/i.test(sample) ||
    (/travel\s*date/i.test(sample) && /getyourguide\s*traveler/i.test(sample)) ||
    /\bGYG[A-Z0-9]{6,}\b/.test(sample)
  )
}

const GYG_GENERIC_AUTHORS = new Set([
  'getyourguide traveler',
  'getyourguide',
  'traveler',
  'g',
])

const GYG_BODY_PRODUCT_MAP: Array<{ pattern: RegExp; productId: string; productName: string }> = [
  {
    pattern: /Zion\s*Bryce\s*Grand\s*Canyon|Las\s*Vegas\s*>\s*Zion\s*Bryce|Zion\s*Bryce\s*&?\s*Antelope/i,
    productId: 'MNGC1N',
    productName: '그랜드서클 1박 2일 투어',
  },
  {
    pattern: /Grand\s*Canyon\s*Sunrise|Las\s*Vegas\s*[:>]?\s*Grand\s*Canyon\s*Sunrise/i,
    productId: 'MDGCSUNRISE',
    productName: '밤도깨비 그랜드캐년 일출 투어',
  },
  {
    pattern:
      /Grand\s*Canyon[\s\S]{0,300}?Antelope[\s\S]{0,300}?Horseshoe[\s\S]{0,300}?Lake\s*Powell/i,
    productId: 'MDGC1D',
    productName: '그랜드서클 당일 투어',
  },
]

export function mapGetYourGuideProduct(text: string): {
  productId: string
  productName: string
} | null {
  const source = text.trim()
  if (!source) return null
  for (const entry of GYG_BODY_PRODUCT_MAP) {
    if (entry.pattern.test(source)) {
      return { productId: entry.productId, productName: entry.productName }
    }
  }
  return null
}

function parseGyGLabelValue(text: string, label: string): string | null {
  const pattern = new RegExp(
    `${label}\\s*\\n\\s*([^\\n]+)`,
    'i'
  )
  const match = text.match(pattern)
  return match?.[1]?.trim() || null
}

function parseGyGDateLine(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value.trim())
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function parseGyGDateToYmd(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value.trim())
  if (!Number.isFinite(parsed)) return null
  const d = new Date(parsed)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function extractGyGProductLine(text: string): string | null {
  const labeled = parseGyGLabelValue(text, 'Option')
  if (labeled && !labeled.toLowerCase().startsWith('default')) {
    return labeled
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^las\s+vegas\s*[:>]/i.test(line) && /grand\s+canyon/i.test(line)) {
      return line.replace(/\s*(hide\s+details|option)$/i, '').trim()
    }
  }

  const inline = text.match(
    /(Las\s+Vegas\s*[:>]\s*Grand\s+Canyon[^\n]*(?:Antelope|Horseshoe)[^\n]*)/i
  )
  return inline?.[1]?.trim() || null
}

function extractGyGComment(lines: string[]): string | null {
  const stopPatterns = [
    /^replied\s+on\b/i,
    /^translate$/i,
    /^hide\s+details$/i,
    /^option$/i,
    /^booking\s+reference$/i,
    /^travel\s+date$/i,
    /^las\s+vegas\s*[:>]/i,
    /^default\s*\|/i,
  ]

  const commentLines: string[] = []
  let inComment = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inComment && commentLines.length > 0) break
      continue
    }

    if (!inComment) {
      if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(trimmed)) {
        inComment = true
      }
      continue
    }

    if (stopPatterns.some((pattern) => pattern.test(trimmed))) {
      break
    }

    commentLines.push(trimmed)
  }

  const comment = commentLines.join('\n').trim()
  return comment || null
}

function extractGyGReviewDate(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(trimmed)) {
      return parseGyGDateLine(trimmed)
    }
  }
  return null
}

function extractGyGAuthor(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i]?.trim() ?? ''
    if (/getyourguide\s+traveler/i.test(trimmed)) {
      return null
    }
    if (
      trimmed &&
      trimmed.length < 80 &&
      !/^\d$/.test(trimmed) &&
      !/out of \d stars/i.test(trimmed) &&
      !/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(trimmed) &&
      !trimmed.startsWith('–') &&
      !trimmed.startsWith('-') &&
      !GYG_GENERIC_AUTHORS.has(trimmed.toLowerCase())
    ) {
      const next = lines[i + 1]?.trim() ?? ''
      if (/^[-–]/.test(next) || /^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(next)) {
        return null
      }
    }
  }
  return null
}

/** GetYourGuide 사이트에서 복사한 리뷰 블록 파싱 */
export function parseGetYourGuideScrapedText(text: string): ParsedOtaReviewRow | null {
  const trimmed = text.trim()
  if (!trimmed || !isGetYourGuideScrapedText(trimmed)) return null

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim())

  let rating: number | null = null
  for (const line of lines) {
    if (/^(\d)\s*$/.test(line)) {
      rating = Number.parseInt(line, 10)
      break
    }
    const starsMatch = line.match(/(\d)\s*out\s*of\s*5\s*stars?/i)
    if (starsMatch?.[1]) {
      rating = Number.parseInt(starsMatch[1], 10)
      break
    }
  }

  const bookingRef =
    parseGyGLabelValue(trimmed, 'Booking reference') ||
    trimmed.match(/\b(GYG[A-Z0-9]{6,})\b/)?.[1]?.trim() ||
    null

  const travelDateRaw = parseGyGLabelValue(trimmed, 'Travel date')
  const tourDate = parseGyGDateToYmd(travelDateRaw)
  const reviewCreatedAt = extractGyGReviewDate(lines)
  const productLine = extractGyGProductLine(trimmed)
  const mappedProduct = mapGetYourGuideProduct(productLine ?? trimmed)
  const comment = extractGyGComment(lines)
  const authorName = extractGyGAuthor(lines)

  if (
    rating === null &&
    !comment &&
    !bookingRef &&
    !tourDate &&
    !productLine
  ) {
    return null
  }

  return {
    authorName,
    rating,
    comment,
    reviewCreatedAt,
    productHint: mappedProduct?.productName ?? productLine,
    reservationNumber: bookingRef,
    tourDate,
    productId: mappedProduct?.productId ?? null,
    tourId: null,
    lineNumber: 1,
  }
}

export function parseSingleOtaReviewText(
  text: string,
  source?: OtaReviewSource | null
): ParsedOtaReviewRow | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (source === 'getyourguide' || isGetYourGuideScrapedText(trimmed)) {
    const gyg = parseGetYourGuideScrapedText(trimmed)
    if (gyg) return gyg
  }

  const rows = parseOtaReviewText(trimmed)
  return rows[0] ?? null
}

export function parseOtaReviewCsv(text: string): ParsedOtaReviewRow[] {
  return parseDelimitedRows(text)
}

export function validateParsedOtaRows(
  rows: ParsedOtaReviewRow[],
  options?: { ratingOnly?: boolean }
): {
  valid: ParsedOtaReviewRow[]
  invalid: Array<{ row: ParsedOtaReviewRow; reason: string }>
} {
  const valid: ParsedOtaReviewRow[] = []
  const invalid: Array<{ row: ParsedOtaReviewRow; reason: string }> = []
  const ratingOnly = options?.ratingOnly ?? false

  rows.forEach((row) => {
    if (row.rating === null || row.rating < 1 || row.rating > 5) {
      invalid.push({ row, reason: 'invalid_rating' })
      return
    }
    if (ratingOnly) {
      valid.push(row)
      return
    }
    if (!row.comment?.trim() && !row.authorName?.trim()) {
      invalid.push({ row, reason: 'missing_content' })
      return
    }
    valid.push(row)
  })

  return { valid, invalid }
}

export type OtaCsvTemplateHint = {
  source: OtaReviewSource
  columnsKo: string
  columnsEn: string
}

export const OTA_CSV_TEMPLATE_HINTS: Record<OtaReviewSource, OtaCsvTemplateHint> = {
  getyourguide: {
    source: 'getyourguide',
    columnsKo: 'author, rating, comment, date, reservation_number, product',
    columnsEn: 'author, rating, comment, date, reservation_number, product',
  },
  viator: {
    source: 'viator',
    columnsKo: 'reviewer, rating, review, date, tour',
    columnsEn: 'reviewer, rating, review, date, tour',
  },
  tripadvisor: {
    source: 'tripadvisor',
    columnsKo: 'author, rating, review, date',
    columnsEn: 'author, rating, review, date',
  },
  klook: {
    source: 'klook',
    columnsKo: 'customer, score, comment, date, product',
    columnsEn: 'customer, score, comment, date, product',
  },
  kkday: {
    source: 'kkday',
    columnsKo: 'author, rating, comment, date',
    columnsEn: 'author, rating, comment, date',
  },
  tripcom: {
    source: 'tripcom',
    columnsKo: 'author, rating, comment, date',
    columnsEn: 'author, rating, comment, date',
  },
  other: {
    source: 'other',
    columnsKo: 'author, rating, comment, date (또는 탭/| 구분)',
    columnsEn: 'author, rating, comment, date (or tab/pipe separated)',
  },
}
