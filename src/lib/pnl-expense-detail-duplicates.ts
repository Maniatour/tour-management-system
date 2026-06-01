import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
} from '@/lib/statement-bulk-company-duplicate-check'
import { expenseDuplicatePairHasDifferentLinkedTours } from '@/lib/expense-unified-duplicate-scan'
import type { PnlDetailLine } from '@/components/reports/PnlUnifiedExpenseDetailDialog'

export function pnlDetailLineKey(line: { source: string; id: string }): string {
  return `${line.source}:${line.id}`
}

function comparableYmd(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim()
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

function calendarDayDiffAbs(ymdA: string, ymdB: string): number {
  if (ymdA.length !== 10 || ymdB.length !== 10) return 999
  const [ya, ma, da] = ymdA.split('-').map(Number)
  const [yb, mb, db] = ymdB.split('-').map(Number)
  const ta = Date.UTC(ya, ma - 1, da)
  const tb = Date.UTC(yb, mb - 1, db)
  return Math.round(Math.abs(ta - tb) / 86400000)
}

function normalizeLinkId(id: string | null | undefined): string {
  return String(id ?? '').trim()
}

function normalizeRnNumber(rn: string | null | undefined): string {
  return String(rn ?? '').trim()
}

/** PNL «연결 ID» 열과 동일 — tour → res → RN 우선 */
function pnlDetailConnectionKey(line: PnlDetailLine): string | null {
  const tour = normalizeLinkId(line.tour_id)
  if (tour) return `tour:${tour}`
  const res = normalizeLinkId(line.reservation_id)
  if (res) return `res:${res}`
  const rn = normalizeRnNumber(line.rn_number)
  if (rn) return `rn:${rn}`
  return null
}

const ENTRANCE_FEE_LABEL = /^entrance\s*fee$/i

function isPnlEntranceFeeLine(line: PnlDetailLine): boolean {
  const pf = (line.paid_for ?? '').trim()
  const cat = (line.category ?? '').trim()
  return ENTRANCE_FEE_LABEL.test(pf) || ENTRANCE_FEE_LABEL.test(cat)
}

/** tour / res / RN 중 둘 다 값이 있고 서로 다르면 true */
function pnlDetailLinkFieldsDiffer(a: PnlDetailLine, b: PnlDetailLine): boolean {
  const tourA = normalizeLinkId(a.tour_id)
  const tourB = normalizeLinkId(b.tour_id)
  if (tourA && tourB && tourA !== tourB) return true

  const resA = normalizeLinkId(a.reservation_id)
  const resB = normalizeLinkId(b.reservation_id)
  if (resA && resB && resA !== resB) return true

  const rnA = normalizeRnNumber(a.rn_number)
  const rnB = normalizeRnNumber(b.rn_number)
  if (rnA && rnB && rnA !== rnB) return true

  return false
}

function pnlDetailDuplicatePairShouldExclude(a: PnlDetailLine, b: PnlDetailLine): boolean {
  if (expenseDuplicatePairHasDifferentLinkedTours(a, b)) return true
  if (pnlDetailLinkFieldsDiffer(a, b)) return true
  /** Entrance Fee — 연결 ID(투어·예약·RN)가 같지 않으면 같은 금액·날짜여도 중복 후보 제외 */
  if (isPnlEntranceFeeLine(a) && isPnlEntranceFeeLine(b)) {
    return pnlDetailConnectionKey(a) !== pnlDetailConnectionKey(b)
  }
  return false
}

function clusterKeysFromPairs(pairs: [string, string][]): string[][] {
  const nodes = new Set<string>()
  for (const [a, b] of pairs) {
    nodes.add(a)
    nodes.add(b)
  }
  const parent = new Map<string, string>()
  for (const id of nodes) parent.set(id, id)
  function find(x: string): string {
    let p = parent.get(x)!
    if (p !== x) {
      p = find(p)
      parent.set(x, p)
    }
    return p
  }
  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const [a, b] of pairs) union(a, b)
  const buckets = new Map<string, string[]>()
  for (const id of nodes) {
    const r = find(id)
    if (!buckets.has(r)) buckets.set(r, [])
    buckets.get(r)!.push(id)
  }
  return [...buckets.values()].filter((g) => g.length >= 2)
}

/**
 * 통합 PNL 지출 상세 — 명세 대조 중복 점검과 동일한 금액·등록일(±) 규칙.
 * 연결 tour_id(또는 reservation_id·RN#)가 둘 다 있고 서로 다르면 중복에서 제외.
 * Entrance Fee는 연결 ID(투어·예약·RN)가 같지 않으면 같은 금액·날짜여도 중복에서 제외.
 * dismissedKeys(중복 아님 처리된 source:id)는 탐지에서 제외한다.
 */
export function findPnlDetailDuplicateGroups(
  lines: PnlDetailLine[],
  dismissedKeys?: Set<string>
): string[][] {
  const indexed = lines
    .map((line) => ({ line, key: pnlDetailLineKey(line), ymd: comparableYmd(line.submit_on) }))
    .filter((x) => x.ymd.length === 10 && Number.isFinite(x.line.amount) && Math.abs(x.line.amount) > 0.005)
    .filter((x) => !dismissedKeys || !dismissedKeys.has(x.key))
    .sort((a, b) => {
      if (a.ymd !== b.ymd) return a.ymd.localeCompare(b.ymd)
      return a.key.localeCompare(b.key)
    })

  const pairs: [string, string][] = []
  for (let i = 0; i < indexed.length; i++) {
    const a = indexed[i]!
    for (let j = i + 1; j < indexed.length; j++) {
      const b = indexed[j]!
      if (calendarDayDiffAbs(a.ymd, b.ymd) > BULK_COMPANY_DUP_DAY_WINDOW) {
        if (b.ymd > a.ymd) break
        continue
      }
      if (Math.abs(a.line.amount - b.line.amount) > BULK_COMPANY_DUP_AMOUNT_EPS) continue
      if (pnlDetailDuplicatePairShouldExclude(a.line, b.line)) continue
      pairs.push([a.key, b.key])
    }
  }
  return clusterKeysFromPairs(pairs)
}

function pickKeeperLine(group: PnlDetailLine[]): PnlDetailLine {
  const reconciled = group.filter((l) => l.statementReconciled)
  if (reconciled.length === 1) return reconciled[0]!
  const sorted = [...group].sort((a, b) => {
    const da = comparableYmd(a.submit_on)
    const db = comparableYmd(b.submit_on)
    if (da !== db) return da.localeCompare(db)
    return pnlDetailLineKey(a).localeCompare(pnlDetailLineKey(b))
  })
  return sorted[0]!
}

export type PnlDupGroupStyle = {
  groupIndex: number
  groupLabel: string
  rowClass: string
  badgeClass: string
}

/** 중복 그룹별 행·뱃지 색 (같은 그룹 = 동일 색) */
const PNL_DUP_GROUP_PALETTE: ReadonlyArray<{ row: string; badge: string }> = [
  { row: 'bg-amber-50/95 border-l-[3px] border-l-amber-500', badge: 'bg-amber-100 text-amber-950 border-amber-300' },
  { row: 'bg-sky-50/95 border-l-[3px] border-l-sky-500', badge: 'bg-sky-100 text-sky-950 border-sky-300' },
  { row: 'bg-violet-50/95 border-l-[3px] border-l-violet-500', badge: 'bg-violet-100 text-violet-950 border-violet-300' },
  { row: 'bg-lime-50/95 border-l-[3px] border-l-lime-600', badge: 'bg-lime-100 text-lime-950 border-lime-400' },
  { row: 'bg-rose-50/95 border-l-[3px] border-l-rose-500', badge: 'bg-rose-100 text-rose-950 border-rose-300' },
  { row: 'bg-teal-50/95 border-l-[3px] border-l-teal-600', badge: 'bg-teal-100 text-teal-950 border-teal-300' },
  { row: 'bg-orange-50/95 border-l-[3px] border-l-orange-500', badge: 'bg-orange-100 text-orange-950 border-orange-300' },
  { row: 'bg-indigo-50/95 border-l-[3px] border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-950 border-indigo-300' },
]

export function buildDuplicateGroupStyleByKey(groups: string[][]): Map<string, PnlDupGroupStyle> {
  const out = new Map<string, PnlDupGroupStyle>()
  groups.forEach((memberKeys, i) => {
    const palette = PNL_DUP_GROUP_PALETTE[i % PNL_DUP_GROUP_PALETTE.length]!
    const style: PnlDupGroupStyle = {
      groupIndex: i,
      groupLabel: `중복 ${i + 1}`,
      rowClass: palette.row,
      badgeClass: `border ${palette.badge}`,
    }
    for (const k of memberKeys) out.set(k, style)
  })
  return out
}

/** 그룹마다 1건을 남기고 나머지 키(중복 삭제 후보) */
export function duplicateExtraKeysToSelect(
  lines: PnlDetailLine[],
  groups: string[][]
): string[] {
  const byKey = new Map(lines.map((l) => [pnlDetailLineKey(l), l]))
  const out: string[] = []
  for (const g of groups) {
    const rows = g.map((k) => byKey.get(k)).filter((x): x is PnlDetailLine => Boolean(x))
    if (rows.length < 2) continue
    const keep = pnlDetailLineKey(pickKeeperLine(rows))
    for (const k of g) {
      if (k !== keep) out.push(k)
    }
  }
  return out
}
