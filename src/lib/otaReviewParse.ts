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
    'reviews',
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
  date: [
    'date',
    'review_date',
    'revieweddate',
    'reviewed',
    'created',
    'created_at',
    'reviewed_at',
    'submitted',
    '날짜',
    '작성일',
  ],
  product: ['product', 'tour', 'activity', 'product_name', 'tour_name', '상품', '투어'],
  reservation: [
    'reservation',
    'reservation_number',
    'booking',
    'booking_ref',
    'booking_reference',
    'bookingreference',
    'bookingreferenceid',
    'bookingid',
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

/** Quoted fields may contain newlines — parse full text into row/cell matrix. */
function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1
      }
      currentRow.push(currentCell.trim())
      currentCell = ''
      if (currentRow.some((cell) => cell.length > 0)) {
        records.push(currentRow)
      }
      currentRow = []
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((cell) => cell.length > 0)) {
      records.push(currentRow)
    }
  }

  return records
}

function detectDelimiterFromText(text: string): ',' | '\t' | '|' | ';' {
  const sampleLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5)
  const tabScore = sampleLines.reduce((sum, line) => sum + (line.match(/\t/g)?.length ?? 0), 0)
  if (tabScore >= 2) return '\t'
  return detectDelimiter(sampleLines[0] ?? text)
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
  const trimmed = text.trim().replace(/^\uFEFF/, '')
  if (!trimmed) return []

  const delimiter = detectDelimiterFromText(trimmed)
  const records = parseDelimitedRecords(trimmed, delimiter)
  if (records.length === 0) return []

  const firstCells = records[0] ?? []
  const headerMapping = mapHeaders(firstCells)
  const hasHeader = Object.keys(headerMapping).length >= 2

  const dataRecords = hasHeader ? records.slice(1) : records
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
  dataRecords.forEach((cells, index) => {
    const row = rowFromCells(cells, mapping, hasHeader ? index + 2 : index + 1)
    if (row) rows.push(row)
  })

  return rows
}

const KLOOK_HEADER_WORDS = new Set([
  'booking',
  'reference',
  'reviewed',
  'date',
  'stars',
  'star',
  'reviews',
  'review',
])

function isLikelyKlookBookingRef(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length < 6) return false
  if (KLOOK_HEADER_WORDS.has(trimmed.toLowerCase())) return false
  if (/^[A-Z]{1,6}\d{4,}[A-Z0-9]*$/i.test(trimmed)) return true
  if (/^\d{8,}$/.test(trimmed)) return true
  if (/^[A-Z]{2,4}\d{5,}$/i.test(trimmed)) return true
  return false
}

function mapKlookHeaders(headers: string[]): Partial<Record<ColumnKey, number>> | null {
  const normalized = headers.map(normalizeHeader)
  const findIndex = (predicate: (header: string) => boolean) =>
    normalized.findIndex(predicate)

  const reservation = findIndex(
    (header) =>
      header.includes('bookingreference') ||
      header.includes('bookingid') ||
      header.includes('예약번호') ||
      header === 'reference'
  )
  const date = findIndex(
    (header) =>
      header.includes('revieweddate') ||
      header.includes('reviewdate') ||
      (header.includes('reviewed') && header.includes('date')) ||
      header.includes('작성일')
  )
  const rating = findIndex(
    (header) => header === 'stars' || header === 'star' || header.includes('별점') || header.includes('평점')
  )
  const product = findIndex(
    (header) =>
      header.includes('activity') ||
      header.includes('product') ||
      header.includes('tour') ||
      header.includes('package') ||
      header.includes('상품') ||
      header.includes('투어')
  )
  const comment = findIndex(
    (header) =>
      header === 'reviews' ||
      header === 'review' ||
      header.includes('리뷰') ||
      header.includes('내용') ||
      header.includes('comment')
  )

  if (reservation < 0 && rating < 0 && comment < 0) return null

  const mapping: Partial<Record<ColumnKey, number>> = {}
  if (reservation >= 0) mapping.reservation = reservation
  if (date >= 0) mapping.date = date
  if (rating >= 0) mapping.rating = rating
  if (comment >= 0) mapping.comment = comment
  if (product >= 0) mapping.product = product
  return mapping
}

/**
 * Excel/시트 붙여넣기: 탭 행은 새 리뷰, 줄바꿈만 있는 줄은 이전 리뷰 본문에 이어붙임.
 */
function buildKlookRecordsFromPaste(text: string): string[][] {
  const lines = text.split(/\r?\n/)
  const records: string[][] = []
  let current: string[] | null = null

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim()) continue

    const tabCells = line.split('\t').map((cell) => cell.trim())
    const firstCell = tabCells[0] ?? ''

    if (isKlookHeaderRow(tabCells) || /booking\s*reference/i.test(line)) {
      if (current) {
        records.push(current)
        current = null
      }
      records.push(tabCells)
      continue
    }

    if (isLikelyKlookBookingRef(firstCell)) {
      if (current) records.push(current)
      current = tabCells
      continue
    }

    if (current) {
      const lastIdx = Math.max(current.length - 1, 0)
      current[lastIdx] = [current[lastIdx], line.trim()].filter(Boolean).join('\n')
      continue
    }

    const refIdx = tabCells.findIndex((cell) => isLikelyKlookBookingRef(cell))
    if (refIdx >= 0 && tabCells.length >= 3) {
      records.push(tabCells)
    }
  }

  if (current) records.push(current)

  return records
}

function mergeKlookRow(
  cells: string[],
  headerMapping: Partial<Record<ColumnKey, number>> | null,
  lineNumber: number
): ParsedOtaReviewRow | null {
  const heuristic = parseKlookDataRow(cells)
  if (!headerMapping || Object.keys(headerMapping).length < 2) {
    return heuristic ? { ...heuristic, lineNumber } : null
  }

  const mapped = rowFromCells(cells, headerMapping, lineNumber)
  if (!heuristic) return mapped

  return {
    authorName: mapped?.authorName ?? null,
    rating: heuristic.rating ?? mapped?.rating ?? null,
    comment: heuristic.comment ?? mapped?.comment ?? null,
    reviewCreatedAt: heuristic.reviewCreatedAt ?? mapped?.reviewCreatedAt ?? null,
    productHint:
      (headerMapping.product !== undefined
        ? cells[headerMapping.product]?.trim()
        : null) ||
      mapped?.productHint ||
      heuristic.productHint ||
      null,
    reservationNumber: heuristic.reservationNumber ?? mapped?.reservationNumber ?? null,
    lineNumber,
  }
}

function isKlookHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase()
  return (
    /booking\s*reference/i.test(joined) ||
    (/reviewed\s*date/i.test(joined) && /\bstars\b/i.test(joined))
  )
}

/** Klook 관리자/엑셀에서 복사한 리뷰 테이블인지 */
export function isKlookTableText(text: string): boolean {
  const sample = text.trim()
  if (!sample) return false
  if (/booking\s*reference\s*id/i.test(sample) && /reviewed\s*date/i.test(sample)) {
    return true
  }
  if (/\bstars\b/i.test(sample) && /\breviews\b/i.test(sample) && /booking/i.test(sample)) {
    return true
  }

  const lines = sample.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let refCount = 0
  for (const line of lines.slice(0, 25)) {
    if (/booking\s*reference/i.test(line)) continue
    const delimiter = detectDelimiter(line)
    const cells = parseCsvLine(line, delimiter)
    if (cells.some((cell) => isLikelyKlookBookingRef(cell.trim()))) {
      refCount += 1
    }
  }
  return refCount >= 2
}

function parseKlookDataRow(cells: string[]): ParsedOtaReviewRow | null {
  let reservationNumber: string | null = null
  let reviewCreatedAt: string | null = null
  let rating: number | null = null
  let comment: string | null = null
  let longestText = ''

  for (const raw of cells) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    if (!reservationNumber && isLikelyKlookBookingRef(trimmed)) {
      reservationNumber = trimmed.toUpperCase()
      continue
    }
    if (
      !reviewCreatedAt &&
      ( /^\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(trimmed) ||
        (trimmed.length < 40 && parseDate(trimmed)))
    ) {
      reviewCreatedAt = parseDate(trimmed)
      continue
    }
    if (rating === null && /^[1-5]$/.test(trimmed)) {
      rating = Number.parseInt(trimmed, 10)
      continue
    }
    if (trimmed.length > longestText.length) {
      longestText = trimmed
    }
  }

  comment = longestText || null

  if (!reservationNumber && rating === null && !comment) {
    return null
  }

  return {
    authorName: null,
    rating,
    comment,
    reviewCreatedAt,
    productHint: null,
    reservationNumber,
  }
}

/** Klook 리뷰 테이블(엑셀/시트 복사) — 여러 행 파싱 */
export function parseKlookTableText(text: string): ParsedOtaReviewRow[] {
  const trimmed = text.trim().replace(/^\uFEFF/, '')
  if (!trimmed) return []

  const records = buildKlookRecordsFromPaste(trimmed)
  if (records.length === 0) return []

  let startIndex = 0
  let headerMapping = mapKlookHeaders(records[0] ?? [])
  if (headerMapping && isKlookHeaderRow(records[0] ?? [])) {
    startIndex = 1
  } else {
    headerMapping = null
  }

  const rows: ParsedOtaReviewRow[] = []
  for (let i = startIndex; i < records.length; i += 1) {
    const cells = records[i] ?? []
    if (isKlookHeaderRow(cells)) continue
    if (cells.every((cell) => !cell.trim())) continue

    const row = mergeKlookRow(cells, headerMapping, i + 1)
    if (row && (row.reservationNumber || row.rating !== null || row.comment?.trim())) {
      rows.push(row)
    }
  }

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
  const trimmed = text.trim().replace(/^\uFEFF/, '')
  if (!trimmed) return []

  const isKlook = source === 'klook' || isKlookTableText(trimmed)
  if (isKlook) {
    const klookRows = parseKlookTableText(trimmed)
    if (klookRows.length > 0) return klookRows
    const delimited = parseDelimitedRows(trimmed)
    if (delimited.length > 0) return delimited
    return []
  }

  if (source === 'getyourguide' || isGetYourGuideScrapedText(trimmed)) {
    const gyg = parseGetYourGuideScrapedText(trimmed)
    if (gyg) return [gyg]
  }

  if (source === 'viator' || isViatorScrapedText(trimmed)) {
    const viatorRows = parseViatorScrapedReviews(trimmed)
    if (viatorRows.length > 0) return viatorRows
  }

  if (source === 'kkday' || isKkdayScrapedText(trimmed)) {
    const kkdayRows = parseKkdayScrapedReviews(trimmed)
    if (kkdayRows.length > 0) return kkdayRows
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
  {
    pattern: /Night\s*City\s*Tour|Las\s*Vegas\s*[:>]\s*Night\s*City/i,
    productId: 'MDLVN',
    productName: '라스베가스 야경투어',
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
    if (/^las\s+vegas\s*[:>]/i.test(line) && /grand\s+canyon|night\s+city\s+tour/i.test(line)) {
      return line.replace(/\s*(hide\s+details|option)$/i, '').trim()
    }
  }

  const inline = text.match(
    /(Las\s+Vegas\s*[:>]\s*(?:Grand\s+Canyon[^\n]*(?:Antelope|Horseshoe)|Night\s+City\s+Tour)[^\n]*)/i
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

const KKDAY_RN_PATTERN = /\d{2}KK\d{8,}/i

const KKDAY_BODY_PRODUCT_MAP: Array<{ pattern: RegExp; productId: string; productName: string }> = [
  {
    pattern: /그랜드\s*캐년\s*일출|일출부터\s*별|밤도깨비|Grand\s*Canyon\s*Sunrise/i,
    productId: 'MDGCSUNRISE',
    productName: '밤도깨비 그랜드캐년 일출 투어',
  },
  {
    pattern: /Zion\s*Bryce|자이언\s*브라이스|시온.{0,40}브라이스|그랜드서클\s*1박/i,
    productId: 'MNGC1N',
    productName: '그랜드서클 1박 2일 투어',
  },
  {
    pattern: /그랜드서클\s*당일|앤텔로프.{0,80}호스슈|Antelope.{0,80}Horseshoe/i,
    productId: 'MDGC1D',
    productName: '그랜드서클 당일 투어',
  },
]

const KKDAY_SKIP_COMMENT_LINE =
  /^(번역\s*보기|번역보기|translate|see translation|view translation|查看翻譯|查看翻译|顯示翻譯|显示翻译)$/i

const KKDAY_LABEL_LINE =
  /^(상품명|옵션|등급점수|예약자|예약번호|商品名稱|商品名称|方案|選項|选项|評分|评分|預訂者|预订者|訂單編號|订单编号|product\s*name|option|rating|score|booker|booking\s*(?:no|number|id))\s*[：:]/i

function parseKkdayLabelValue(text: string, labels: string[]): string | null {
  const label = labels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const sameLine = text.match(new RegExp(`(?:${label})\\s*[：:]\\s*([^\\n]+)`, 'i'))
  const sameValue = sameLine?.[1]?.trim() ?? ''
  if (sameValue) return sameValue

  const nextLine = text.match(new RegExp(`(?:${label})\\s*[：:]\\s*\\n\\s*([^\\n]+)`, 'i'))
  const nextValue = nextLine?.[1]?.trim() ?? ''
  if (nextValue && !KKDAY_LABEL_LINE.test(nextValue) && !KKDAY_SKIP_COMMENT_LINE.test(nextValue)) {
    return nextValue
  }
  return null
}

function parseKkdayStarRating(value: string): number | null {
  const stars = value.match(/[★⭐]/g)
  const emptyStars = value.match(/[☆]/g)
  if (stars && stars.length >= 1 && stars.length <= 5 && (!emptyStars || stars.length + emptyStars.length <= 5)) {
    return stars.length
  }
  return null
}

function parseKkdayRatingValue(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const fromStars = parseKkdayStarRating(trimmed)
  if (fromStars !== null) return fromStars

  const scored = trimmed.match(/^([1-5](?:\.\d+)?)\s*(?:\/\s*5|점|stars?|★|⭐)?$/i)
  if (scored?.[1]) {
    const rating = Number.parseFloat(scored[1])
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      return Math.round(rating)
    }
  }
  return null
}

function parseKkdayReviewDate(text: string): string | null {
  const match = text.match(
    /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\((GMT[+-]\d{1,2}(?::\d{2})?)\))?/i
  )
  if (!match) return null

  const date = match[1]
  const time = match[2].length === 5 ? `${match[2]}:00` : match[2]
  const tz = match[3]
  let offset = '-08:00'
  const tzMatch = tz?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i)
  if (tzMatch) {
    const hh = tzMatch[2].padStart(2, '0')
    const mm = (tzMatch[3] ?? '00').padStart(2, '0')
    offset = `${tzMatch[1]}${hh}:${mm}`
  }
  const parsed = Date.parse(`${date}T${time}${offset}`)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function extractKkdayReservationNumber(text: string): string | null {
  const labeled = parseKkdayLabelValue(text, ['예약번호', '訂單編號', '订单编号', 'Booking number', 'Booking no', 'Order number'])
  const fromLabel = labeled?.match(KKDAY_RN_PATTERN)?.[0]
  if (fromLabel) return fromLabel.toUpperCase()
  const fromBody = text.match(KKDAY_RN_PATTERN)?.[0]
  return fromBody ? fromBody.toUpperCase() : null
}

function extractKkdayComment(lines: string[]): string | null {
  const commentLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (KKDAY_SKIP_COMMENT_LINE.test(trimmed)) continue
    if (KKDAY_LABEL_LINE.test(trimmed)) continue
    if (/\d{4}-\d{2}-\d{2}.+(남긴\s*후기|留下)/.test(trimmed)) continue
    if (KKDAY_RN_PATTERN.test(trimmed) && trimmed.replace(/[#\s]/g, '').length <= 18) continue
    commentLines.push(trimmed)
  }
  const comment = commentLines.join('\n').trim()
  return comment || null
}

export function mapKkdayProduct(text: string): {
  productId: string
  productName: string
} | null {
  const source = text.trim()
  if (!source) return null
  for (const entry of KKDAY_BODY_PRODUCT_MAP) {
    if (entry.pattern.test(source)) {
      return { productId: entry.productId, productName: entry.productName }
    }
  }
  return mapGetYourGuideProduct(source)
}

/** KKday 파트너/리뷰 화면에서 복사한 텍스트인지 */
export function isKkdayScrapedText(text: string): boolean {
  const sample = text.trim()
  if (!sample) return false
  const hasRn = KKDAY_RN_PATTERN.test(sample)
  const hasLabels = /(상품명|예약자|등급점수|예약번호|商品名稱|評分|訂單編號)\s*[：:]/.test(sample)
  const hasDate = /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(sample) && /남긴\s*후기|留下/.test(sample)
  return (hasRn && hasLabels) || (hasLabels && hasDate) || (hasRn && hasDate)
}

function splitKkdayReviewBlocks(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed
    .split(/\n(?=(?:상품명|商品名稱|商品名称|Product\s*name)\s*[：:])/i)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : [trimmed]
}

/** KKday 리뷰 화면에서 복사한 1건 파싱 */
export function parseKkdayScrapedText(text: string): ParsedOtaReviewRow | null {
  const trimmed = text.trim()
  if (!trimmed || !isKkdayScrapedText(trimmed)) return null

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim())
  const productName = parseKkdayLabelValue(trimmed, ['상품명', '商品名稱', '商品名称', 'Product name'])
  const optionName = parseKkdayLabelValue(trimmed, ['옵션', '方案', '選項', '选项', 'Option'])
  const authorName = parseKkdayLabelValue(trimmed, ['예약자', '預訂者', '预订者', 'Booker', 'Customer'])
  const rating = parseKkdayRatingValue(
    parseKkdayLabelValue(trimmed, ['등급점수', '評分', '评分', 'Rating', 'Score'])
  )
  const reviewCreatedAt = parseKkdayReviewDate(trimmed)
  const reservationNumber = extractKkdayReservationNumber(trimmed)
  const comment = extractKkdayComment(lines)
  const mappedProduct = mapKkdayProduct([productName, optionName].filter(Boolean).join('\n'))

  if (!comment && !authorName && !reservationNumber && rating === null) {
    return null
  }

  return {
    authorName,
    rating,
    comment,
    reviewCreatedAt,
    productHint: mappedProduct?.productName ?? productName,
    reservationNumber,
    productId: mappedProduct?.productId ?? null,
    tourId: null,
    lineNumber: 1,
  }
}

export function parseKkdayScrapedReviews(text: string): ParsedOtaReviewRow[] {
  const rows: ParsedOtaReviewRow[] = []
  for (const [index, block] of splitKkdayReviewBlocks(text).entries()) {
    const row = parseKkdayScrapedText(block)
    if (!row) continue
    rows.push({ ...row, lineNumber: index + 1 })
  }
  return rows
}

const VIATOR_MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const VIATOR_DATE_LINE =
  /^(?:reviewed(?:\s+on)?[:\s]+)?([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/i

const VIATOR_PRODUCT_LINE =
  /^(Tripadvisor|Viator|GetYourGuide|Klook|KKday)?\s*review:\s*(.+)$/i

const VIATOR_SKIP_LINE =
  /^(response\s+(?:published|unpublished)|no\s+response|reply|replied|translate|see translation|show original|view (?:review|details)|hide details|published|unpublished)$/i

const VIATOR_BODY_PRODUCT_MAP: Array<{ pattern: RegExp; productId: string; productName: string }> = [
  {
    pattern: /Zion\s*Bryce|2\s*Day.*Zion|Zion.{0,40}Bryce.{0,40}2\s*[Dd]ay/i,
    productId: 'MNGC1N',
    productName: '그랜드서클 1박 2일 투어',
  },
  {
    pattern: /Grand\s*Canyon\s*Sunrise|밤도깨비|Midnight\s*Goblin/i,
    productId: 'MDGCSUNRISE',
    productName: '밤도깨비 그랜드캐년 일출 투어',
  },
  {
    pattern: /Grand\s*Canyon.{0,80}Antelope.{0,80}Horseshoe.{0,40}Lake\s*Powell/i,
    productId: 'MDGC1D',
    productName: '그랜드서클 당일 투어',
  },
  {
    pattern: /Grand\s*Canyon.{0,80}Antelope.{0,80}Horseshoe(?:\s*Bend)?(?:\s*Tour)?(?:\s*from\s*Las\s*Vegas)?/i,
    productId: 'MDGCSUNRISE',
    productName: '밤도깨비 그랜드캐년 일출 투어',
  },
  {
    pattern: /Night\s*City|Las\s*Vegas\s*City\s*Tour/i,
    productId: 'MDLVN',
    productName: '라스베가스 야경투어',
  },
]

function isViatorDateLine(line: string): boolean {
  return VIATOR_DATE_LINE.test(line.trim())
}

function parseViatorDateParts(line: string): { y: number; m: number; d: number } | null {
  const match = line.trim().match(VIATOR_DATE_LINE)
  if (!match) return null
  const month = VIATOR_MONTH_INDEX[match[1].toLowerCase()]
  const day = Number.parseInt(match[2], 10)
  const year = Number.parseInt(match[3], 10)
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null
  if (day < 1 || day > 31 || year < 2000) return null
  return { y: year, m: month, d: day }
}

function parseViatorDateToIso(line: string): string | null {
  const parts = parseViatorDateParts(line)
  if (!parts) return null
  return new Date(Date.UTC(parts.y, parts.m, parts.d, 12, 0, 0)).toISOString()
}

function parseViatorDateToYmd(line: string): string | null {
  const parts = parseViatorDateParts(line)
  if (!parts) return null
  return `${parts.y}-${String(parts.m + 1).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`
}

function parseViatorProductLine(line: string): string | null {
  const match = line.trim().match(VIATOR_PRODUCT_LINE)
  return match?.[2]?.trim() || null
}

function isViatorSkipLine(line: string): boolean {
  return VIATOR_SKIP_LINE.test(line.trim())
}

export function mapViatorProduct(text: string): {
  productId: string
  productName: string
} | null {
  const source = text.trim()
  if (!source) return null
  for (const entry of VIATOR_BODY_PRODUCT_MAP) {
    if (entry.pattern.test(source)) {
      return { productId: entry.productId, productName: entry.productName }
    }
  }
  return mapGetYourGuideProduct(source)
}

/** Viator 공급자 리뷰 화면에서 복사한 텍스트인지 */
export function isViatorScrapedText(text: string): boolean {
  const sample = text.trim()
  if (!sample) return false
  const hasDate = /(?:^|\n)\s*(?:reviewed(?:\s+on)?[:\s]+)?[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\s*(?:\n|$)/i.test(
    sample
  )
  const hasProductLine = /(tripadvisor|viator)\s+review\s*:/i.test(sample)
  const hasResponse = /response\s+(?:published|unpublished)|no\s+response/i.test(sample)
  return hasDate && (hasProductLine || hasResponse)
}

function splitViatorReviewBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] = []

  const flush = () => {
    const block = current.join('\n').trim()
    if (block) blocks.push(block)
    current = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (isViatorDateLine(line) && current.some((item) => item.trim())) {
      flush()
    }
    current.push(rawLine)
  }
  flush()
  return blocks.length > 0 ? blocks : [text.trim()].filter(Boolean)
}

/** Viator 리뷰 화면에서 복사한 1건 파싱. 별점은 복사되지 않으므로 null일 수 있음. */
export function parseViatorScrapedText(text: string): ParsedOtaReviewRow | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const dateIndex = lines.findIndex((line) => isViatorDateLine(line))
  if (dateIndex < 0) return null

  const dateLine = lines[dateIndex] ?? ''
  const reviewCreatedAt = parseViatorDateToIso(dateLine)
  const tourDate = parseViatorDateToYmd(dateLine)

  let authorName: string | null = null
  let title: string | null = null
  let productLine: string | null = null
  let rating: number | null = null
  const commentLines: string[] = []

  for (const line of lines.slice(dateIndex + 1)) {
    if (isViatorDateLine(line)) break
    if (isViatorSkipLine(line)) continue

    if (rating === null) {
      const fromLine = parseRating(line)
      if (fromLine !== null && (/^[1-5]$/.test(line) || /star/i.test(line) || /[★⭐☆]/.test(line))) {
        rating = fromLine
        continue
      }
    }

    const product = parseViatorProductLine(line)
    if (product) {
      productLine = product
      continue
    }

    if (!authorName) {
      authorName = line
      continue
    }

    if (!title && !productLine && commentLines.length === 0 && line.length <= 120) {
      title = line
      continue
    }

    commentLines.push(line)
  }

  const comment = [title, ...commentLines].filter(Boolean).join('\n').trim() || null
  const mappedProduct = mapViatorProduct(productLine ?? trimmed)

  if (!authorName && !comment && !productLine) {
    return null
  }

  return {
    authorName,
    rating,
    comment,
    reviewCreatedAt,
    productHint: mappedProduct?.productName ?? productLine,
    reservationNumber: null,
    tourDate,
    productId: mappedProduct?.productId ?? null,
    tourId: null,
    lineNumber: 1,
  }
}

export function parseViatorScrapedReviews(text: string): ParsedOtaReviewRow[] {
  const rows: ParsedOtaReviewRow[] = []
  for (const [index, block] of splitViatorReviewBlocks(text).entries()) {
    const row = parseViatorScrapedText(block)
    if (!row) continue
    rows.push({ ...row, lineNumber: index + 1 })
  }
  return rows
}

export function parseSingleOtaReviewText(
  text: string,
  source?: OtaReviewSource | null
): ParsedOtaReviewRow | null {
  const trimmed = text.trim().replace(/^\uFEFF/, '')
  if (!trimmed) return null

  if (source === 'getyourguide' || isGetYourGuideScrapedText(trimmed)) {
    const gyg = parseGetYourGuideScrapedText(trimmed)
    if (gyg) return gyg
  }

  if (source === 'viator' || isViatorScrapedText(trimmed)) {
    const viator = parseViatorScrapedText(trimmed)
    if (viator) return viator
  }

  if (source === 'kkday' || isKkdayScrapedText(trimmed)) {
    const kkday = parseKkdayScrapedText(trimmed)
    if (kkday) return kkday
  }

  if (source === 'klook' || isKlookTableText(trimmed)) {
    const klookRows = parseKlookTableText(trimmed)
    if (klookRows.length > 0) return klookRows[0] ?? null
  }

  const rows = parseOtaReviewText(trimmed, source)
  return rows[0] ?? null
}

export function parseOtaReviewCsv(text: string, source?: OtaReviewSource | null): ParsedOtaReviewRow[] {
  if (source === 'klook' || isKlookTableText(text)) {
    const klookRows = parseKlookTableText(text)
    if (klookRows.length > 0) return klookRows
  }
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
    columnsKo:
      'Viator 리뷰 화면 텍스트 붙여넣기 (작성일 · 고객명 · 제목 · Tripadvisor/Viator review: 상품명) 또는 reviewer, rating, review, date, tour',
    columnsEn:
      'Paste Viator review page text (date, guest, title, Tripadvisor/Viator review: product) or reviewer, rating, review, date, tour',
  },
  tripadvisor: {
    source: 'tripadvisor',
    columnsKo: 'author, rating, review, date',
    columnsEn: 'author, rating, review, date',
  },
  klook: {
    source: 'klook',
    columnsKo:
      'Booking reference ID, Reviewed date, Stars, Reviews (엑셀/시트에서 표 전체 복사·붙여넣기)',
    columnsEn:
      'Booking reference ID, Reviewed date, Stars, Reviews (paste full table from Excel/sheet)',
  },
  kkday: {
    source: 'kkday',
    columnsKo:
      'KKday 리뷰 화면 텍스트 붙여넣기 (상품명 · 옵션 · 등급점수 · 예약자 · 예약번호) 또는 author, rating, comment, date, reservation_number, product',
    columnsEn:
      'Paste KKday review page text (product, option, rating, booker, booking no) or author, rating, comment, date, reservation_number, product',
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
