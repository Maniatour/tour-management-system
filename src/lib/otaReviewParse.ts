import type { OtaReviewSource } from '@/lib/reviewSources'

export type ParsedOtaReviewRow = {
  authorName: string | null
  rating: number | null
  comment: string | null
  reviewCreatedAt: string | null
  productHint: string | null
  reservationNumber?: string | null
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

export function parseOtaReviewText(text: string): ParsedOtaReviewRow[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const delimited = parseDelimitedRows(trimmed)
  if (delimited.length > 0) {
    return delimited
  }

  return parseBlockFormat(trimmed)
}

/** 단건 붙여넣기용 — 첫 번째 파싱 결과만 반환 */
export function parseSingleOtaReviewText(text: string): ParsedOtaReviewRow | null {
  const rows = parseOtaReviewText(text)
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
