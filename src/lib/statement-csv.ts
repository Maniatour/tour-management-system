/** Parse bank/CC CSV exports (common US bank formats). Returns normalized rows for statement_lines. */

export type ParsedStatementRow = {
  postedDate: string // YYYY-MM-DD
  amount: number // absolute value
  direction: 'outflow' | 'inflow'
  description: string
  merchant: string | null
  externalReference: string | null
  raw: Record<string, string>
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseMoney(s: string): number | null {
  const t = s.trim().replace(/[$,]/g, '')
  if (t === '' || t === '-') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? Math.abs(n) : null
}

function parseDateCell(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  // ISO / yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10)
  }
  // mm/dd/yyyy
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const mm = us[1].padStart(2, '0')
    const dd = us[2].padStart(2, '0')
    return `${us[3]}-${mm}-${dd}`
  }
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

export function parseStatementCsvText(csvText: string): ParsedStatementRow[] {
  const text = csvText.replace(/^\uFEFF/, '').trim()
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const firstLine = lines[0]
  let delimiter = ','
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    delimiter = '\t'
  } else if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';'
  }
  const splitLine = (line: string) => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQ = !inQ
      } else if (!inQ && (c === delimiter || c === '\t')) {
        out.push(cur)
        cur = ''
      } else {
        cur += c
      }
    }
    out.push(cur)
    return out.map((c) => c.replace(/^"|"$/g, '').trim())
  }

  const headers = splitLine(lines[0]).map(normalizeHeader)
  const dateIdx = headers.findIndex((h) =>
    [
      'date',
      'transaction_date',
      'posted_date',
      'posting_date',
      'trans_date',
      'value_date',
      'booking_date',
      '거래일자',
      '거래일',
      '승인일자',
      '매입일자'
    ].includes(h)
  )
  const amountIdx = headers.findIndex((h) =>
    ['amount', 'transaction_amount', 'amt', '거래금액', '금액', '청구금액'].includes(h)
  )
  const debitIdx = headers.findIndex((h) =>
    ['debit', 'withdrawals', 'withdrawal', '출금', '출금금액'].includes(h)
  )
  const creditIdx = headers.findIndex((h) =>
    ['credit', 'deposits', 'deposit', '입금', '입금금액'].includes(h)
  )
  const descIdx = headers.findIndex((h) =>
    ['description', 'memo', 'details', 'narrative', 'name', '적요', '내용', '상세', '가맹점명'].includes(h)
  )
  const merchantIdx = headers.findIndex((h) => ['merchant', 'payee'].includes(h))
  const refIdx = headers.findIndex((h) =>
    ['reference', 'ref', 'transaction_id', 'fitid', 'id'].includes(h)
  )

  const rows: ParsedStatementRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    if (cells.every((c) => !c)) continue

    const raw: Record<string, string> = {}
    headers.forEach((h, j) => {
      raw[h] = cells[j] ?? ''
    })

    let posted: string | null = null
    if (dateIdx >= 0) posted = parseDateCell(cells[dateIdx] ?? '')
    if (!posted) continue

    let amount: number | null = null
    let direction: 'outflow' | 'inflow' = 'outflow'

    if (amountIdx >= 0) {
      const rawAmt = cells[amountIdx] ?? ''
      const n = parseMoney(rawAmt)
      if (n != null) {
        amount = n
        const neg = rawAmt.trim().startsWith('(') || rawAmt.trim().startsWith('-')
        direction = neg ? 'outflow' : 'inflow'
        if (!neg && n > 0) {
          const low = rawAmt.toLowerCase()
          if (!low.includes('-')) direction = 'inflow'
        }
      }
    }

    if (amount == null && debitIdx >= 0 && creditIdx >= 0) {
      const d = parseMoney(cells[debitIdx] ?? '') ?? 0
      const c = parseMoney(cells[creditIdx] ?? '') ?? 0
      if (d > 0) {
        amount = d
        direction = 'outflow'
      } else if (c > 0) {
        amount = c
        direction = 'inflow'
      }
    }
    if (amount == null && debitIdx >= 0 && creditIdx < 0) {
      const d = parseMoney(cells[debitIdx] ?? '')
      if (d != null && d > 0) {
        amount = d
        direction = 'outflow'
      }
    }
    if (amount == null && creditIdx >= 0 && debitIdx < 0) {
      const c = parseMoney(cells[creditIdx] ?? '')
      if (c != null && c > 0) {
        amount = c
        direction = 'inflow'
      }
    }

    if (amount == null || amount === 0) continue

    const description =
      descIdx >= 0 ? (cells[descIdx] ?? '').trim() : headers.map((h, j) => `${h}:${cells[j]}`).join(' | ')
    const merchant = merchantIdx >= 0 ? (cells[merchantIdx] ?? '').trim() || null : null
    const externalReference = refIdx >= 0 ? (cells[refIdx] ?? '').trim() || null : null

    rows.push({
      postedDate: posted,
      amount,
      direction,
      description: description || '(no description)',
      merchant,
      externalReference,
      raw
    })
  }

  return rows
}

export function makeDedupeKey(
  statementImportId: string,
  row: ParsedStatementRow,
  lineIndex: number
): string {
  const base = `${row.postedDate}|${row.amount}|${row.direction}|${row.description}|${row.externalReference ?? ''}|${lineIndex}`
  let h = 0
  for (let i = 0; i < base.length; i++) h = Math.imul(31, h) + base.charCodeAt(i)
  return `${statementImportId.slice(0, 8)}_${(h >>> 0).toString(16)}_${lineIndex}`
}
