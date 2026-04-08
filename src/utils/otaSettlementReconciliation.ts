import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'

export const OTA_RECONCILE_EPS = 0.02

/** CSV/TSV 한 줄 파싱 (쌍따옴표 지원) */
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur.trim())
  return result
}

export function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  return tabs > commas ? '\t' : ','
}

export function parseTextToTable(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = detectDelimiter(lines[0])
  return lines.map((line) => parseDelimitedLine(line, delimiter))
}

/** $, 콤마, 통화 기호 제거 후 숫자 */
export function parseMoneyCell(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/[€£¥]/g, '').replace(/\s+/g, '')
  const paren = /^\(([\d,.-]+)\)$/.exec(s)
  if (paren) {
    const n = parseMoneyCell(paren[1])
    return n == null ? null : -Math.abs(n)
  }
  s = s.replace(/USD|KRW|us\s*\$/gi, '').replace(/^\$+/, '').replace(/\$$/, '')
  s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

const RN_HEADER_HINT =
  /booking|reference|confirm|reservation|itinerary|ref\.?\s*no|locator|record\s*loc|^rn$|channel\s*rn|order\s*id|product\s*id|예약|확정/i
const AMT_HEADER_HINT =
  /settlement|payout|net\s*pay|payable|supplier|receive|amount\s*due|payment|gross|total|net\s*amount|정산|금액|지급/i
const AMT_HEADER_AVOID = /pax|guest|count|qty|quantity|adult|child|infant|인원|수량|#|number\s*of/i

function headerScore(h: string, hint: RegExp, avoid: RegExp): number {
  if (!h.trim()) return -999
  if (avoid.test(h)) return -50
  return hint.test(h) ? 20 : 0
}

export function guessRnAndAmountColumnIndexes(headers: string[]): {
  rnIndex: number | null
  amountIndex: number | null
} {
  if (!headers.length) return { rnIndex: null, amountIndex: null }
  let bestRn = -1
  let bestRnScore = -1
  let bestAmt = -1
  let bestAmtScore = -1
  headers.forEach((h, i) => {
    const rnS = headerScore(h, RN_HEADER_HINT, /amount|total\s*price|price|usd|\$/i)
    if (rnS > bestRnScore) {
      bestRnScore = rnS
      bestRn = i
    }
    const amS = headerScore(h, AMT_HEADER_HINT, AMT_HEADER_AVOID)
    if (amS > bestAmtScore) {
      bestAmtScore = amS
      bestAmt = i
    }
  })
  return {
    rnIndex: bestRn >= 0 && bestRnScore >= 10 ? bestRn : null,
    amountIndex: bestAmt >= 0 && bestAmtScore >= 10 ? bestAmt : null,
  }
}

export function variantSetForRn(rn: string): Set<string> {
  const set = new Set<string>()
  for (const v of expandChannelRnMatchVariants(rn)) {
    set.add(v.toLowerCase())
  }
  return set
}

export function channelRnsCompatible(a: string, b: string): boolean {
  const sa = variantSetForRn(a)
  const sb = variantSetForRn(b)
  for (const x of sa) {
    if (sb.has(x)) return true
  }
  return false
}

export type SystemReservationForOta = {
  id: string
  channelRN: string
  channelSettlementAmount?: number | null
  status: string
}

export type OtaFileRow = {
  rn: string
  amount: number | null
  rowIndex: number
}

export type ReconcileRowStatus =
  | 'match'
  | 'mismatch'
  | 'ota_only'
  | 'system_only'
  | 'no_amount'
  | 'duplicate_ota'
  | 'system_no_settlement'

export type ReconcileResultRow = {
  key: string
  otaRn: string
  otaAmount: number | null
  reservationId?: string
  systemRn?: string
  systemAmount: number | null
  status: ReconcileRowStatus
  diff: number | null
}

function normalizeStatus(st: string): string {
  return String(st || '').toLowerCase().trim()
}

export function extractOtaRowsFromTable(
  table: string[][],
  rnCol: number,
  amountCol: number,
  headerRowIndex = 0
): OtaFileRow[] {
  const maxIdx = Math.max(rnCol, amountCol)
  const out: OtaFileRow[] = []
  for (let r = headerRowIndex + 1; r < table.length; r++) {
    let row = table[r]
    if (!row || row.every((c) => !String(c || '').trim())) continue
    if (row.length <= maxIdx) {
      row = [...row, ...Array(maxIdx + 1 - row.length).fill('')]
    }
    const rnRaw = row[rnCol] != null ? String(row[rnCol]).trim() : ''
    const amtRaw = row[amountCol] != null ? row[amountCol] : ''
    out.push({
      rn: rnRaw,
      amount: parseMoneyCell(String(amtRaw)),
      rowIndex: r + 1,
    })
  }
  return out.filter((x) => x.rn.length > 0)
}

/** PDF 등에서 줄 단위로 RN + 금액 후보 추출 (휴리스틱) */
export function extractOtaRowsFromLooseText(text: string): OtaFileRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out: OtaFileRow[] = []
  let idx = 0
  for (const line of lines) {
    idx++
    const rnMatch =
      line.match(/\b(BR-\d+)\b/i) ||
      line.match(/\b(\d{9,})\b/) ||
      line.match(/\b([A-Z]{2,3}-[A-Z0-9]{4,})\b/i)
    if (!rnMatch) continue
    const moneyMatch =
      line.match(/\$\s*([\d,]+\.\d{2})\b/) ||
      line.match(/\b([\d,]+\.\d{2})\s*(?:USD|usd)?\b/)
    const amt = moneyMatch ? parseMoneyCell(moneyMatch[1]) : null
    out.push({ rn: rnMatch[1].trim(), amount: amt, rowIndex: idx })
  }
  return out
}

export function reconcileOtaAgainstSystem(
  otaRows: OtaFileRow[],
  systemRows: SystemReservationForOta[]
): ReconcileResultRow[] {
  const usedSystemIds = new Set<string>()
  const results: ReconcileResultRow[] = []
  const rnFirstSeen = new Map<string, number>()

  for (let i = 0; i < otaRows.length; i++) {
    const orow = otaRows[i]
    const dupKey = orow.rn.trim().toLowerCase()
    const duplicateOta = rnFirstSeen.has(dupKey)
    if (!duplicateOta) rnFirstSeen.set(dupKey, i)

    let matched: SystemReservationForOta | undefined
    for (const s of systemRows) {
      if (usedSystemIds.has(s.id)) continue
      if (!s.channelRN?.trim()) continue
      if (channelRnsCompatible(orow.rn, s.channelRN)) {
        matched = s
        break
      }
    }

    if (duplicateOta) {
      results.push({
        key: `dup-${i}-${orow.rn}`,
        otaRn: orow.rn,
        otaAmount: orow.amount,
        status: 'duplicate_ota',
        diff: null,
      })
      continue
    }

    if (!matched) {
      results.push({
        key: `ota-only-${i}-${orow.rn}`,
        otaRn: orow.rn,
        otaAmount: orow.amount,
        status: 'ota_only',
        diff: null,
      })
      continue
    }

    usedSystemIds.add(matched.id)

    const sysAmt = matched.channelSettlementAmount
    const sysAmtN = sysAmt != null && Number.isFinite(Number(sysAmt)) ? Number(sysAmt) : null
    const st = normalizeStatus(matched.status)

    if (orow.amount == null) {
      results.push({
        key: `no-amt-${matched.id}`,
        otaRn: orow.rn,
        otaAmount: null,
        reservationId: matched.id,
        systemRn: matched.channelRN,
        systemAmount: sysAmtN,
        status: 'no_amount',
        diff: null,
      })
      continue
    }

    if (sysAmtN == null) {
      results.push({
        key: `no-sys-${matched.id}`,
        otaRn: orow.rn,
        otaAmount: orow.amount,
        reservationId: matched.id,
        systemRn: matched.channelRN,
        systemAmount: null,
        status: 'system_no_settlement',
        diff: orow.amount,
      })
      continue
    }

    const diff = Math.round((orow.amount - sysAmtN) * 100) / 100
    const isMatch = Math.abs(diff) <= OTA_RECONCILE_EPS
    results.push({
      key: matched.id,
      otaRn: orow.rn,
      otaAmount: orow.amount,
      reservationId: matched.id,
      systemRn: matched.channelRN,
      systemAmount: sysAmtN,
      status: isMatch ? 'match' : 'mismatch',
      diff: isMatch ? null : diff,
    })
  }

  for (const s of systemRows) {
    if (usedSystemIds.has(s.id)) continue
    const st = normalizeStatus(s.status)
    if (st === 'deleted' || st === 'cancelled' || st === 'canceled') continue
    const sysAmtN =
      s.channelSettlementAmount != null && Number.isFinite(Number(s.channelSettlementAmount))
        ? Number(s.channelSettlementAmount)
        : null
    results.push({
      key: `only-sys-${s.id}`,
      otaRn: '—',
      otaAmount: null,
      reservationId: s.id,
      systemRn: s.channelRN,
      systemAmount: sysAmtN,
      status: 'system_only',
      diff: null,
    })
  }

  return results
}
