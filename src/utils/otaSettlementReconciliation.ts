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

/**
 * $, 콤마, 통화 기호 제거 후 숫자.
 * OTA CSV에서 흔한 `"- 544.44"`(음수와 숫자 사이 공백), `−544.44`(유니코드 마이너스), `544.44-`(후행 음수) 등 처리.
 */
export function parseMoneyCell(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null

  s = s.replace(/[\u200b-\u200d\ufeff]/g, '')
  s = s.replace(/\u00a0|\u202f|\u2007|\u2060/g, ' ')
  // MINUS SIGN / EN DASH / EM DASH → ASCII hyphen (Number()는 유니코드 마이너스를 숫자로 인식하지 않음)
  s = s.replace(/[\u2212\u2013\u2014]/g, '-')
  s = s.replace(/[€£¥]/g, '')
  s = s.replace(/USD|KRW|us\s*\$/gi, '')
  s = s.replace(/\$/g, '')
  // 음수·통화 제거 후 공백 전부 제거 → "- 544.44" → "-544.44"
  s = s.replace(/\s+/g, '')

  const paren = /^\(([\d,.-]+)\)$/.exec(s)
  if (paren) {
    const n = parseMoneyCell(paren[1])
    return n == null ? null : -Math.abs(n)
  }

  const trailingMinus = /^([\d,.]+)-$/.exec(s)
  if (trailingMinus) {
    const n = parseMoneyCell(trailingMinus[1])
    return n == null ? null : -Math.abs(n)
  }

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
  /** 같은 RN(변형 포함)으로 합친 파일 행 수. 없으면 1 */
  fileLineCount?: number
  /** 합산에 참여한 파일 줄 번호(시트 행 등), 쉼표 구분 */
  fileRowIndices?: string
}

/** 동일 예약 RN(브이에이터 BR-·숫자 변형 등) 묶음 키 */
export function fileRnGroupKey(rn: string): string {
  return [...expandChannelRnMatchVariants(rn.trim())]
    .map((v) => v.toLowerCase())
    .sort()
    .join('\u0001')
}

/**
 * 파일 내 같은 채널 RN(변형 동일)은 1건으로 합치고 금액을 합산.
 * 취소 환불처럼 +행/-행이 갈라진 경우 net 정산에 맞춤.
 */
export function aggregateOtaFileRowsByRn(rows: OtaFileRow[]): OtaFileRow[] {
  const buckets = new Map<string, OtaFileRow[]>()
  for (const row of rows) {
    if (!row.rn.trim()) continue
    const k = fileRnGroupKey(row.rn)
    const list = buckets.get(k) ?? []
    list.push(row)
    buckets.set(k, list)
  }
  const out: OtaFileRow[] = []
  for (const [, group] of buckets) {
    group.sort((a, b) => a.rowIndex - b.rowIndex)
    const representativeRn = group[0].rn
    let sumAmount: number | null = null
    let anyNumeric = false
    for (const g of group) {
      if (g.amount == null || !Number.isFinite(g.amount)) continue
      anyNumeric = true
      sumAmount =
        sumAmount == null ? g.amount : Math.round((sumAmount + g.amount) * 100) / 100
    }
    if (!anyNumeric) sumAmount = null
    const indices = group.map((g) => String(g.rowIndex)).join(', ')
    const n = group.length
    out.push({
      rn: representativeRn,
      amount: sumAmount,
      rowIndex: group[0].rowIndex,
      fileLineCount: n,
      fileRowIndices: n > 1 ? indices : undefined,
    })
  }
  out.sort((a, b) => a.rowIndex - b.rowIndex)
  return out
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
  /** DB reservations.status */
  systemStatus?: string | null
  systemAmount: number | null
  status: ReconcileRowStatus
  diff: number | null
  /** 파일에서 이 RN으로 합친 행 수 */
  otaFileLineCount?: number
  /** 합산 시 파일 줄 번호(쉼표 구분). 1행-only면 비울 수 있음 */
  otaFileRowIndices?: string | null
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

function otaFileMergeMeta(orow: OtaFileRow): Pick<ReconcileResultRow, 'otaFileLineCount' | 'otaFileRowIndices'> {
  const cnt = orow.fileLineCount ?? 1
  return {
    otaFileLineCount: cnt,
    otaFileRowIndices: cnt > 1 ? (orow.fileRowIndices ?? String(orow.rowIndex)) : null,
  }
}

export function reconcileOtaAgainstSystem(
  otaRows: OtaFileRow[],
  systemRows: SystemReservationForOta[]
): ReconcileResultRow[] {
  const usedSystemIds = new Set<string>()
  const results: ReconcileResultRow[] = []

  for (let i = 0; i < otaRows.length; i++) {
    const orow = otaRows[i]
    const mergeMeta = otaFileMergeMeta(orow)

    let matched: SystemReservationForOta | undefined
    for (const s of systemRows) {
      if (usedSystemIds.has(s.id)) continue
      if (!s.channelRN?.trim()) continue
      if (channelRnsCompatible(orow.rn, s.channelRN)) {
        matched = s
        break
      }
    }

    if (!matched) {
      results.push({
        key: `ota-only-${i}-${orow.rn}-${orow.rowIndex}`,
        otaRn: orow.rn,
        otaAmount: orow.amount,
        status: 'ota_only',
        diff: null,
        systemAmount: null,
        ...mergeMeta,
      })
      continue
    }

    usedSystemIds.add(matched.id)

    const sysAmt = matched.channelSettlementAmount
    const sysAmtN = sysAmt != null && Number.isFinite(Number(sysAmt)) ? Number(sysAmt) : null

    if (orow.amount == null) {
      results.push({
        key: `no-amt-${matched.id}`,
        otaRn: orow.rn,
        otaAmount: null,
        reservationId: matched.id,
        systemRn: matched.channelRN,
        systemStatus: matched.status ?? null,
        systemAmount: sysAmtN,
        status: 'no_amount',
        diff: null,
        ...mergeMeta,
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
        systemStatus: matched.status ?? null,
        systemAmount: null,
        status: 'system_no_settlement',
        diff: orow.amount,
        ...mergeMeta,
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
      systemStatus: matched.status ?? null,
      systemAmount: sysAmtN,
      status: isMatch ? 'match' : 'mismatch',
      diff: isMatch ? null : diff,
      ...mergeMeta,
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
      systemStatus: s.status ?? null,
      systemAmount: sysAmtN,
      status: 'system_only',
      diff: null,
      otaFileLineCount: 1,
      otaFileRowIndices: null,
    })
  }

  return results
}
