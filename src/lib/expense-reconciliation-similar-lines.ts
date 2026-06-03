import type { SupabaseClient } from '@supabase/supabase-js'
import { formatStatementLineDescription } from '@/lib/statement-display'
import { softDeleteExpenseRecord, type ExpenseSoftDeleteTable } from '@/lib/expense-soft-delete'

/** 명세 대조 화면의 운영 원장 «수동 후보»와 동일한 거래일 ±일 */
export const RECON_EXPENSE_LEDGER_DAY_WINDOW = 4

/** 입장권 부킹 상세 — 체크인·등록일 기준 명세 후보 조회 ±일 */
export const TICKET_BOOKING_STATEMENT_DAY_WINDOW = 3

export type ExpenseReconSourceTable =
  | 'payment_records'
  | 'reservation_expenses'
  | 'company_expenses'
  | 'tour_expenses'
  | 'ticket_bookings'
  | 'tour_hotel_bookings'
  | 'cash_transactions'

export type ExpenseStatementReconContext = {
  sourceTable: ExpenseReconSourceTable
  sourceId: string
  dateYmd: string
  amount: number
  direction: 'inflow' | 'outflow'
  /**
   * 입장권 부킹: 체크인·등록일 각 ±dayWindow 구간의 명세 줄 전체(출금·입금, 금액 필터 없음).
   * financialAccountId가 있으면 해당 통장 계정 import만 조회.
   */
  ticketBookingDateProbe?: {
    submitYmd?: string | null
    checkInYmd?: string | null
    dayWindow?: number
    financialAccountId?: string | null
  }
}

function ymdToUtcDayNumber(raw: string): number {
  const s = String(raw ?? '').trim()
  const ymd = s.length >= 10 ? s.slice(0, 10) : s
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return Number.NaN
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = Date.UTC(y, mo - 1, d)
  if (Number.isNaN(t)) return Number.NaN
  return Math.floor(t / 86400000)
}

function dayDiffFromYmd(iso: string, ymd: string): number {
  const a = ymdToUtcDayNumber(iso)
  const b = ymdToUtcDayNumber(ymd)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b)
}

export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const core = ymd.trim().slice(0, 10)
  const parts = core.split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return core
  const [yy, mm, dd] = parts
  const d = new Date(yy, mm - 1, dd)
  if (Number.isNaN(d.getTime())) return core
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type StatementImportRow = {
  id: string
  financial_account_id: string
  period_start: string
  period_end: string
}

export type SimilarStatementLineRow = {
  id: string
  financial_account_id: string
  financial_account_name: string
  posted_date: string
  direction: string
  amount: number
  description: string
  matched_status: string
  amount_diff: number
  day_diff: number
  score: number
  existing_matches: { source_table: string; source_id: string }[]
  /** 같은 명세 줄에 연결된 `matched_amount` 합계(표시용). 없으면 0 */
  allocated_sum: number
}

/** 원장·명세 금액 차이 허용(반올림 등). 금액 동기화 체크박스는 이 범위 안에서만 허용 */
export function expenseReconciliationAmountTolerance(absLedgerAmount: number): number {
  return Math.max(5, absLedgerAmount * 0.05)
}

export async function syncStatementLineMatchedStatus(supabase: SupabaseClient, lineId: string): Promise<void> {
  const { data: lineRow } = await supabase.from('statement_lines').select('amount').eq('id', lineId).maybeSingle()
  const lineAbs = Math.abs(Number((lineRow as { amount?: unknown } | null)?.amount ?? 0))

  const { data: matchRows } = await supabase
    .from('reconciliation_matches')
    .select('matched_amount')
    .eq('statement_line_id', lineId)

  const rows = (matchRows || []) as { matched_amount: number | string | null }[]
  if (rows.length === 0) {
    await supabase.from('statement_lines').update({ matched_status: 'unmatched' }).eq('id', lineId)
    return
  }

  let sum = 0
  for (const r of rows) {
    if (r.matched_amount != null && r.matched_amount !== '') {
      sum += Number(r.matched_amount)
    } else {
      // 레거시: null이면 해당 매칭이 줄 전액을 쓴다고 가정(과거 단일 연결)
      sum += lineAbs
    }
  }

  const tol = Math.max(0.5, lineAbs * 0.001)
  let status: 'unmatched' | 'partial' | 'matched'
  if (Math.abs(sum - lineAbs) <= tol) {
    status = 'matched'
  } else if (sum < lineAbs - tol) {
    status = 'partial'
  } else {
    status = 'matched'
  }

  await supabase.from('statement_lines').update({ matched_status: status }).eq('id', lineId)
}

/** 명세 대조 «미대조만» 필터·후보: reconciliation_matches 없으면 미대조, 있으면 partial만 미대조 */
export function isStatementLineShownAsUnmatched(
  matchedStatus: string | null | undefined,
  activeMatchCount: number
): boolean {
  if (activeMatchCount <= 0) return true
  return String(matchedStatus ?? '') === 'partial'
}

/** 매칭은 없는데 matched/partial로 남은 명세 줄 id */
export function findStaleStatementLineMatchedStatusIds(
  lines: { id: string; matched_status: string }[],
  matches: { statement_line_id: string }[]
): string[] {
  const matchCountByLine = new Map<string, number>()
  for (const m of matches) {
    const lid = String(m.statement_line_id ?? '').trim()
    if (!lid) continue
    matchCountByLine.set(lid, (matchCountByLine.get(lid) ?? 0) + 1)
  }
  const staleIds: string[] = []
  for (const line of lines) {
    const n = matchCountByLine.get(line.id) ?? 0
    if (n === 0 && (line.matched_status === 'matched' || line.matched_status === 'partial')) {
      staleIds.push(line.id)
    }
  }
  return staleIds
}

export function patchStatementLinesUnmatchedStatus<T extends { id: string; matched_status: string }>(
  lines: T[],
  staleIds: string[]
): T[] {
  if (staleIds.length === 0) return lines
  const staleSet = new Set(staleIds)
  return lines.map((l) => (staleSet.has(l.id) ? { ...l, matched_status: 'unmatched' } : l))
}

/** 매칭은 없는데 matched/partial로 남은 명세 줄 — DB·메모리 복구용 */
export async function repairStaleStatementLineMatchedStatuses(
  supabase: SupabaseClient,
  lines: { id: string; matched_status: string }[],
  matches: { statement_line_id: string }[]
): Promise<string[]> {
  const staleIds = findStaleStatementLineMatchedStatusIds(lines, matches)
  if (staleIds.length === 0) return []
  const CHUNK = 100
  for (let i = 0; i < staleIds.length; i += CHUNK) {
    const chunk = staleIds.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('statement_lines')
      .update({ matched_status: 'unmatched' })
      .in('id', chunk)
    if (error) throw error
  }
  return staleIds
}

export type SimilarStatementLinesMatchMode = 'dateProximity' | 'amountOnly'

const AMOUNT_ONLY_IMPORT_LIMIT = 120
const AMOUNT_ONLY_IMPORT_CHUNK = 12

function amountTolerance(absRowAmt: number): number {
  return Math.max(5, absRowAmt * 0.05)
}

/** 원장 금액과 명세 줄 금액이 «같은 건으로 볼 수 있는지» 또는 «한 통장에 묶인 분할 후보인지» */
function lineQualifiesForExpense(absLine: number, absExpense: number, tol: number): boolean {
  const diff = Math.abs(absLine - absExpense)
  if (diff <= tol) return true
  return absLine + 1e-9 >= absExpense - tol && diff > tol
}

async function attachExistingMatches(
  supabase: SupabaseClient,
  candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[]
): Promise<SimilarStatementLineRow[]> {
  const lineIds = candidates.map((c) => c.id)
  type M = { source_table: string; source_id: string; matched_amount: number | string | null }
  const matchByLine = new Map<string, M[]>()
  for (let i = 0; i < lineIds.length; i += 80) {
    const chunk = lineIds.slice(i, i + 80)
    const { data: mrows } = await supabase
      .from('reconciliation_matches')
      .select('statement_line_id,source_table,source_id,matched_amount')
      .in('statement_line_id', chunk)
    for (const m of (mrows || []) as {
      statement_line_id: string
      source_table: string
      source_id: string
      matched_amount: number | string | null
    }[]) {
      const lid = m.statement_line_id
      if (!matchByLine.has(lid)) matchByLine.set(lid, [])
      matchByLine.get(lid)!.push({
        source_table: m.source_table,
        source_id: m.source_id,
        matched_amount: m.matched_amount
      })
    }
  }
  return candidates.map((c) => {
    const ms = matchByLine.get(c.id) ?? []
    const lineAbs = Math.abs(c.amount)
    let allocated = 0
    for (const x of ms) {
      if (x.matched_amount != null && x.matched_amount !== '') {
        allocated += Number(x.matched_amount)
      } else if (ms.length === 1) {
        allocated += lineAbs
      }
    }
    return {
      ...c,
      existing_matches: ms.map(({ source_table, source_id }) => ({ source_table, source_id })),
      allocated_sum: allocated
    }
  })
}

export type LinkedStatementLinesForSource = {
  rows: SimilarStatementLineRow[]
  /** statement_line_id → 이 원장 행에 배정된 금액 */
  allocatedByLineId: Map<string, number>
}

/** 이 원장 행에 연결된 명세 줄 — 유사 후보와 무관하게 항상 조회 */
export async function fetchLinkedStatementLineRowsForExpenseSource(
  supabase: SupabaseClient,
  params: {
    sourceTable: ExpenseReconSourceTable
    sourceId: string
    dateYmd: string
    ledgerAmount: number
  }
): Promise<LinkedStatementLinesForSource> {
  const { sourceTable, sourceId, dateYmd, ledgerAmount } = params
  const absLedger = Math.abs(ledgerAmount)
  const tol = amountTolerance(absLedger)

  type MatchRow = { id: string; statement_line_id: string; matched_amount: number | string | null }
  const matches: MatchRow[] = []

  const { data: matchRows, error: matchErr } = await supabase
    .from('reconciliation_matches')
    .select('id, statement_line_id, matched_amount')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
  if (matchErr) throw matchErr
  for (const row of (matchRows || []) as MatchRow[]) {
    const lid = String(row.statement_line_id ?? '').trim()
    if (lid) matches.push(row)
  }

  if (EXPENSE_TABLES_WITH_STATEMENT_LINE_ID.includes(sourceTable)) {
    const { data: legacyRow } = await supabase
      .from(sourceTable)
      .select('statement_line_id')
      .eq('id', sourceId)
      .maybeSingle()
    const legacyLineId = String((legacyRow as { statement_line_id?: string | null } | null)?.statement_line_id ?? '').trim()
    if (
      legacyLineId &&
      !matches.some((m) => m.statement_line_id === legacyLineId)
    ) {
      matches.push({ id: '', statement_line_id: legacyLineId, matched_amount: null })
    }
  }

  if (matches.length === 0) {
    return { rows: [], allocatedByLineId: new Map() }
  }

  const allocatedByLineId = new Map<string, number>()
  const lineIds = [...new Set(matches.map((m) => m.statement_line_id))]
  const lineAmtById = new Map<string, number>()

  type LineRow = {
    id: string
    statement_import_id: string | null
    posted_date: string | null
    amount: number | string | null
    direction: string | null
    description: string | null
    merchant: string | null
    matched_status: string | null
  }
  const lineById = new Map<string, LineRow>()
  for (let i = 0; i < lineIds.length; i += 80) {
    const chunk = lineIds.slice(i, i + 80)
    const { data, error } = await supabase
      .from('statement_lines')
      .select(
        'id, statement_import_id, posted_date, amount, direction, description, merchant, matched_status'
      )
      .in('id', chunk)
    if (error) throw error
    for (const line of (data || []) as LineRow[]) {
      if (line.id) {
        lineById.set(line.id, line)
        lineAmtById.set(line.id, Math.abs(Number(line.amount ?? 0)))
      }
    }
  }

  for (const m of matches) {
    const lid = m.statement_line_id
    let alloc = 0
    if (m.matched_amount != null && m.matched_amount !== '') {
      alloc = Math.abs(Number(m.matched_amount))
    } else {
      alloc = lineAmtById.get(lid) ?? absLedger
    }
    allocatedByLineId.set(lid, alloc)
  }

  const importIds = [
    ...new Set(
      [...lineById.values()]
        .map((l) => String(l.statement_import_id ?? '').trim())
        .filter(Boolean)
    ),
  ]
  const importToAccount = new Map<string, string>()
  for (let i = 0; i < importIds.length; i += 80) {
    const chunk = importIds.slice(i, i + 80)
    const { data } = await supabase
      .from('statement_imports')
      .select('id, financial_account_id')
      .in('id', chunk)
    for (const im of (data || []) as { id: string; financial_account_id: string | null }[]) {
      if (im.id && im.financial_account_id) {
        importToAccount.set(im.id, String(im.financial_account_id))
      }
    }
  }

  const accountIds = [...new Set([...importToAccount.values()])]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 80) {
    const chunk = accountIds.slice(i, i + 80)
    const { data } = await supabase.from('financial_accounts').select('id, name').in('id', chunk)
    for (const a of (data || []) as { id: string; name: string | null }[]) {
      if (a.id) accountNameById.set(a.id, String(a.name ?? '').trim() || a.id)
    }
  }

  const candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[] = []
  for (const m of matches) {
    const line = lineById.get(m.statement_line_id)
    if (!line) continue
    const lineAmount = Number(line.amount ?? 0)
    const absLine = Math.abs(lineAmount)
    const amountDiff = Math.abs(absLine - absLedger)
    const posted = String(line.posted_date ?? '').slice(0, 10)
    const dayDiff = dayDiffFromYmd(posted, dateYmd)
    const importId = String(line.statement_import_id ?? '')
    const accountId = importToAccount.get(importId) || ''
    candidates.push({
      id: String(line.id),
      financial_account_id: accountId,
      financial_account_name: accountNameById.get(accountId) || accountId || '—',
      posted_date: posted,
      direction: String(line.direction ?? ''),
      amount: lineAmount,
      description: formatStatementLineDescription(
        line.description == null ? null : String(line.description),
        line.merchant == null ? null : String(line.merchant)
      ),
      matched_status: String(line.matched_status ?? ''),
      amount_diff: amountDiff,
      day_diff: dayDiff,
      score: 10_000 - amountDiff * 10 - dayDiff,
    })
  }

  const rows = await attachExistingMatches(supabase, candidates)
  rows.sort((a, b) => a.posted_date.localeCompare(b.posted_date) || a.id.localeCompare(b.id))
  return { rows, allocatedByLineId }
}

export function mergeLinkedAndCandidateRows(
  linked: SimilarStatementLineRow[],
  candidates: SimilarStatementLineRow[]
): SimilarStatementLineRow[] {
  if (linked.length === 0) return candidates
  const linkedIds = new Set(linked.map((r) => r.id))
  return [...linked, ...candidates.filter((r) => !linkedIds.has(r.id))]
}

/**
 * 업로드된 명세 중 기간이 겹치는 import의 줄만 조회합니다.
 * 이미 다른 원장과 연결된 명세 줄도 포함합니다(재매칭용).
 *
 * `amountOnly`: 최근 명세 파일에서 **거래일 범위를 쓰지 않고** 금액·방향만으로 후보를 찾습니다.
 */
function ticketBookingDateAnchors(submitYmd?: string | null, checkInYmd?: string | null): string[] {
  const out: string[] = []
  for (const raw of [submitYmd, checkInYmd]) {
    const y = String(raw ?? '').trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(y)) out.push(y)
  }
  return [...new Set(out)]
}

function mergedYmdWindowForAnchors(
  anchors: string[],
  pad: number
): { startYmd: string; endYmd: string } | null {
  if (anchors.length === 0) return null
  let startYmd = addCalendarDaysYmd(anchors[0]!, -pad)
  let endYmd = addCalendarDaysYmd(anchors[0]!, pad)
  for (const a of anchors.slice(1)) {
    const s = addCalendarDaysYmd(a, -pad)
    const e = addCalendarDaysYmd(a, pad)
    if (s < startYmd) startYmd = s
    if (e > endYmd) endYmd = e
  }
  return { startYmd, endYmd }
}

function minDayDiffToAnchors(postedYmd: string, anchors: string[]): number {
  let best = Number.POSITIVE_INFINITY
  for (const a of anchors) {
    const d = dayDiffFromYmd(postedYmd, a)
    if (d < best) best = d
  }
  return best
}

/** 입금(환불) 후보: 동일 기간 출금 중 «출금 − 입금 ≈ 원장 지출»이 성립하면 우선 */
function ticketBookingInflowAmountDiff(
  inflowAbs: number,
  ledgerAbs: number | null,
  outflowAbsAmounts: number[],
  tol: number
): number {
  if (ledgerAbs == null || inflowAbs <= 0) return inflowAbs
  for (const outAbs of outflowAbsAmounts) {
    if (Math.abs(outAbs - inflowAbs - ledgerAbs) <= tol) return 0
  }
  return Math.min(inflowAbs, Math.abs(inflowAbs - ledgerAbs))
}

/**
 * 입장권 부킹 상세: 체크인·등록일 각 ±dayWindow 일의 명세 줄을 모두 가져옵니다(금액 필터 없음).
 * direction 생략 시 출금·입금 모두 포함(부분 환불 입금액 매칭용).
 */
export async function fetchStatementLinesForTicketBookingDateProbe(
  supabase: SupabaseClient,
  params: {
    submitYmd?: string | null
    checkInYmd?: string | null
    /** 생략 시 출금·입금 모두 조회 */
    direction?: 'inflow' | 'outflow' | null
    dayWindow?: number
    financialAccountId?: string | null
    /** 정렬·표시용 — 후보에서 제외하지 않음 */
    ledgerAmount?: number | null
    limit?: number
  }
): Promise<SimilarStatementLineRow[]> {
  const pad = params.dayWindow ?? TICKET_BOOKING_STATEMENT_DAY_WINDOW
  const anchors = ticketBookingDateAnchors(params.submitYmd, params.checkInYmd)
  const range = mergedYmdWindowForAnchors(anchors, pad)
  if (!range) return []

  const { startYmd, endYmd } = range
  const ledgerAbs =
    params.ledgerAmount != null && Number.isFinite(Number(params.ledgerAmount))
      ? Math.abs(Number(params.ledgerAmount))
      : null
  const ledgerTol = ledgerAbs != null ? amountTolerance(ledgerAbs) : 0
  const directionFilter = params.direction ?? null

  const { data: rawImports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id,financial_account_id,period_start,period_end')
    .order('period_start', { ascending: false })
    .limit(400)
  if (impErr) throw impErr

  const faFilter = String(params.financialAccountId ?? '').trim()
  const imports = ((rawImports || []) as StatementImportRow[]).filter((im) => {
    const ps = String(im.period_start ?? '').slice(0, 10)
    const pe = String(im.period_end ?? '').slice(0, 10)
    if (!(ps <= endYmd && pe >= startYmd)) return false
    if (faFilter && String(im.financial_account_id ?? '') !== faFilter) return false
    return true
  })
  if (imports.length === 0) return []

  const accountIds = [...new Set(imports.map((i) => i.financial_account_id).filter(Boolean))]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 80) {
    const chunk = accountIds.slice(i, i + 80)
    const { data: accs } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      accountNameById.set(a.id, a.name)
    }
  }

  const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
  const importIds = imports.map((im) => im.id)
  const rawLines: Record<string, unknown>[] = []
  for (let i = 0; i < importIds.length; i += 80) {
    const chunk = importIds.slice(i, i + 80)
    let query = supabase
      .from('statement_lines')
      .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
      .in('statement_import_id', chunk)
      .gte('posted_date', startYmd)
      .lte('posted_date', endYmd)
    if (directionFilter) query = query.eq('direction', directionFilter)
    const { data, error } = await query
    if (error) throw error
    rawLines.push(...((data || []) as Record<string, unknown>[]))
  }

  const outflowAbsAmounts = rawLines
    .filter((line) => String(line.direction ?? '').toLowerCase() === 'outflow')
    .map((line) => Math.abs(Number(line.amount ?? 0)))
    .filter((n) => n > 0)

  const candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[] = []
  for (const line of rawLines) {
    const lineAmount = Number(line.amount ?? 0)
    const absLine = Math.abs(lineAmount)
    const posted = String(line.posted_date ?? '').slice(0, 10)
    const dayDiff = minDayDiffToAnchors(posted, anchors)
    const isInflow = String(line.direction ?? '').toLowerCase() === 'inflow'
    const amountDiff =
      ledgerAbs != null
        ? isInflow
          ? ticketBookingInflowAmountDiff(absLine, ledgerAbs, outflowAbsAmounts, ledgerTol)
          : Math.abs(absLine - ledgerAbs)
        : absLine
    const importId = String(line.statement_import_id ?? '')
    const accountId = importToAccount.get(importId) || ''
    const scoreBase = isInflow ? 92 : 100
    candidates.push({
      id: String(line.id),
      financial_account_id: accountId,
      financial_account_name: accountNameById.get(accountId) || accountId || '—',
      posted_date: posted,
      direction: String(line.direction ?? ''),
      amount: lineAmount,
      description: formatStatementLineDescription(
        line.description == null ? null : String(line.description),
        line.merchant == null ? null : String(line.merchant)
      ),
      matched_status: String(line.matched_status ?? ''),
      amount_diff: amountDiff,
      day_diff: dayDiff,
      score: scoreBase - dayDiff * 4 - (ledgerAbs != null ? amountDiff * 2 : 0)
    })
  }

  const out = await attachExistingMatches(supabase, candidates)
  out.sort((a, b) => {
    const aUn = a.matched_status === 'unmatched' ? 1 : 0
    const bUn = b.matched_status === 'unmatched' ? 1 : 0
    if (aUn !== bUn) return bUn - aUn
    if (a.day_diff !== b.day_diff) return a.day_diff - b.day_diff
    if (ledgerAbs != null && a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    if (a.posted_date !== b.posted_date) return a.posted_date < b.posted_date ? 1 : -1
    return b.score - a.score
  })
  const limit = params.limit ?? 300
  return sliceTicketBookingProbeCandidates(out, limit)
}

/** 입장권 날짜 탐색: 상한 적용 시 입금(환불) 후보가 출금에 밀려 빠지지 않도록 분할 */
function sliceTicketBookingProbeCandidates(
  sorted: SimilarStatementLineRow[],
  limit: number
): SimilarStatementLineRow[] {
  if (sorted.length <= limit) return sorted
  const inflows = sorted.filter((r) => String(r.direction).toLowerCase() === 'inflow')
  const outflows = sorted.filter((r) => String(r.direction).toLowerCase() !== 'inflow')
  const inflowCap = Math.min(inflows.length, Math.max(60, Math.floor(limit * 0.35)))
  const outflowCap = Math.min(outflows.length, limit - inflowCap)
  const keepIds = new Set<string>([
    ...outflows.slice(0, outflowCap).map((r) => r.id),
    ...inflows.slice(0, inflowCap).map((r) => r.id),
  ])
  return sorted.filter((r) => keepIds.has(r.id))
}

export async function fetchSimilarStatementLinesForExpenseRow(
  supabase: SupabaseClient,
  params: {
    dateYmd: string
    amount: number
    direction: 'inflow' | 'outflow'
    limit?: number
    matchMode?: SimilarStatementLinesMatchMode
  }
): Promise<SimilarStatementLineRow[]> {
  const { dateYmd, amount, direction, limit = 100, matchMode = 'dateProximity' } = params
  if (!dateYmd || dateYmd.length < 10) return []

  const absRowAmt = Math.abs(amount)
  const tol = amountTolerance(absRowAmt)

  if (matchMode === 'amountOnly') {
    const { data: rawImports, error: impErr } = await supabase
      .from('statement_imports')
      .select('id,financial_account_id,period_start,period_end')
      .order('period_start', { ascending: false })
      .limit(AMOUNT_ONLY_IMPORT_LIMIT)
    if (impErr) throw impErr
    const imports = (rawImports || []) as StatementImportRow[]
    if (imports.length === 0) return []

    const accountIds = [...new Set(imports.map((i) => i.financial_account_id).filter(Boolean))]
    const accountNameById = new Map<string, string>()
    for (let i = 0; i < accountIds.length; i += 80) {
      const chunk = accountIds.slice(i, i + 80)
      const { data: accs } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
      for (const a of (accs || []) as { id: string; name: string }[]) {
        accountNameById.set(a.id, a.name)
      }
    }

    const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
    const importIds = imports.map((im) => im.id)
    const negLo = -absRowAmt - tol
    const negHi = -absRowAmt + tol
    const posLo = absRowAmt - tol
    const posHi = absRowAmt + tol
    const amountOr = `and(amount.gte.${negLo},amount.lte.${negHi}),and(amount.gte.${posLo},amount.lte.${posHi})`

    const rawLines: Record<string, unknown>[] = []
    const seenLine = new Set<string>()
    for (let i = 0; i < importIds.length; i += AMOUNT_ONLY_IMPORT_CHUNK) {
      const chunk = importIds.slice(i, i + AMOUNT_ONLY_IMPORT_CHUNK)
      let data: Record<string, unknown>[] | null = null
      let error: { message?: string } | null = null
      const res = await supabase
        .from('statement_lines')
        .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
        .in('statement_import_id', chunk)
        .eq('direction', direction)
        .or(amountOr)
      data = (res.data || []) as Record<string, unknown>[]
      error = res.error

      if (error) {
        const resWide = await supabase
          .from('statement_lines')
          .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
          .in('statement_import_id', chunk)
          .eq('direction', direction)
          .limit(4000)
        if (resWide.error) throw resWide.error
        data = ((resWide.data || []) as Record<string, unknown>[]).filter((line) => {
          const lineAmount = Number(line.amount ?? 0)
          return lineQualifiesForExpense(Math.abs(lineAmount), absRowAmt, tol)
        })
      }

      for (const line of data || []) {
        const id = String(line.id ?? '')
        if (!id || seenLine.has(id)) continue
        seenLine.add(id)
        rawLines.push(line)
      }
    }

    const candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[] = []
    for (const line of rawLines) {
      const lineAmount = Number(line.amount ?? 0)
      const absLine = Math.abs(lineAmount)
      if (!lineQualifiesForExpense(absLine, absRowAmt, tol)) continue
      const amountDiff = Math.abs(absLine - absRowAmt)
      const isSplit = amountDiff > tol
      const posted = String(line.posted_date ?? '').slice(0, 10)
      const dayDiff = dayDiffFromYmd(posted, dateYmd)
      const importId = String(line.statement_import_id ?? '')
      const accountId = importToAccount.get(importId) || ''
      const exactBonus = !isSplit && amountDiff < 0.02 ? 40 : 0
      const splitPenalty = isSplit ? 35 : 0
      candidates.push({
        id: String(line.id),
        financial_account_id: accountId,
        financial_account_name: accountNameById.get(accountId) || accountId || '—',
        posted_date: posted,
        direction: String(line.direction ?? ''),
        amount: lineAmount,
        description: formatStatementLineDescription(
          line.description == null ? null : String(line.description),
          line.merchant == null ? null : String(line.merchant)
        ),
        matched_status: String(line.matched_status ?? ''),
        amount_diff: amountDiff,
        day_diff: dayDiff,
        score: 100 + exactBonus - splitPenalty - amountDiff * (isSplit ? 0.08 : 10) - dayDiff * 0.15
      })
    }

    const out = await attachExistingMatches(supabase, candidates)
    out.sort((a, b) => {
      const aUn = a.matched_status === 'unmatched' ? 1 : 0
      const bUn = b.matched_status === 'unmatched' ? 1 : 0
      if (aUn !== bUn) return bUn - aUn
      if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
      if (a.day_diff !== b.day_diff) return a.day_diff - b.day_diff
      return b.score - a.score
    })
    return out.slice(0, limit)
  }

  const dayWindow = RECON_EXPENSE_LEDGER_DAY_WINDOW
  const startYmd = addCalendarDaysYmd(dateYmd, -dayWindow)
  const endYmd = addCalendarDaysYmd(dateYmd, dayWindow)

  const { data: rawImports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id,financial_account_id,period_start,period_end')
    .order('period_start', { ascending: false })
    .limit(400)
  if (impErr) throw impErr

  const imports = ((rawImports || []) as StatementImportRow[]).filter((im) => {
    const ps = String(im.period_start ?? '').slice(0, 10)
    const pe = String(im.period_end ?? '').slice(0, 10)
    return ps <= endYmd && pe >= startYmd
  })
  if (imports.length === 0) return []

  const accountIds = [...new Set(imports.map((i) => i.financial_account_id).filter(Boolean))]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 80) {
    const chunk = accountIds.slice(i, i + 80)
    const { data: accs } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      accountNameById.set(a.id, a.name)
    }
  }

  const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
  const importIds = imports.map((im) => im.id)
  const rawLines: Record<string, unknown>[] = []
  for (let i = 0; i < importIds.length; i += 80) {
    const chunk = importIds.slice(i, i + 80)
    const { data, error } = await supabase
      .from('statement_lines')
      .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
      .in('statement_import_id', chunk)
      .gte('posted_date', startYmd)
      .lte('posted_date', endYmd)
      .eq('direction', direction)
    if (error) throw error
    rawLines.push(...((data || []) as Record<string, unknown>[]))
  }

  const candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[] = []
  for (const line of rawLines) {
    const lineAmount = Number(line.amount ?? 0)
    const absLine = Math.abs(lineAmount)
    if (!lineQualifiesForExpense(absLine, absRowAmt, tol)) continue
    const amountDiff = Math.abs(absLine - absRowAmt)
    const isSplit = amountDiff > tol
    const posted = String(line.posted_date ?? '').slice(0, 10)
    const dayDiff = dayDiffFromYmd(posted, dateYmd)
    const importId = String(line.statement_import_id ?? '')
    const accountId = importToAccount.get(importId) || ''
    const exactBonus = !isSplit && amountDiff < 0.02 ? 40 : 0
    const splitPenalty = isSplit ? 35 : 0
    candidates.push({
      id: String(line.id),
      financial_account_id: accountId,
      financial_account_name: accountNameById.get(accountId) || accountId || '—',
      posted_date: posted,
      direction: String(line.direction ?? ''),
      amount: lineAmount,
      description: formatStatementLineDescription(
        line.description == null ? null : String(line.description),
        line.merchant == null ? null : String(line.merchant)
      ),
      matched_status: String(line.matched_status ?? ''),
      amount_diff: amountDiff,
      day_diff: dayDiff,
      score: 100 + exactBonus - splitPenalty - amountDiff * (isSplit ? 0.08 : 10) - dayDiff * 3
    })
  }

  const out = await attachExistingMatches(supabase, candidates)

  out.sort((a, b) => {
    const aUn = a.matched_status === 'unmatched' ? 1 : 0
    const bUn = b.matched_status === 'unmatched' ? 1 : 0
    if (aUn !== bUn) return bUn - aUn
    if (b.score !== a.score) return b.score - a.score
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    return a.day_diff - b.day_diff
  })
  return out.slice(0, limit)
}

const STATEMENT_SEARCH_IMPORT_LIMIT = 500
const STATEMENT_SEARCH_IMPORT_CHUNK = 40

function sanitizeStatementSearchQuery(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\x00-\x1f]/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

/**
 * 최근 업로드된 명세(기본 최대 500개 파일) 안에서, 내용·가맹점·거래일·계정명과 일치하는 줄을 찾습니다.
 * 유사 후보(날짜·금액)와 별도로 전체 검색용입니다.
 */
export async function searchStatementLinesAcrossImports(
  supabase: SupabaseClient,
  params: {
    query: string
    /** 생략 시 출금·입금 모두 검색 */
    direction?: 'inflow' | 'outflow' | null
    limit?: number
  }
): Promise<SimilarStatementLineRow[]> {
  const limit = params.limit ?? 200
  const q = sanitizeStatementSearchQuery(params.query)
  if (!q) return []

  const { data: rawImports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id,financial_account_id,period_start,period_end')
    .order('period_start', { ascending: false })
    .limit(STATEMENT_SEARCH_IMPORT_LIMIT)
  if (impErr) throw impErr
  const imports = (rawImports || []) as StatementImportRow[]
  if (imports.length === 0) return []

  const accountIds = [...new Set(imports.map((i) => i.financial_account_id).filter(Boolean))]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 80) {
    const chunk = accountIds.slice(i, i + 80)
    const { data: accs } = await supabase.from('financial_accounts').select('id,name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      accountNameById.set(a.id, a.name)
    }
  }

  const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
  const importIds = imports.map((im) => im.id)

  const innerQuoted = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const orParts = [`description.ilike."%${innerQuoted}%"`, `merchant.ilike."%${innerQuoted}%"`]
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    orParts.push(`posted_date.eq.${q}`)
  }
  // 금액 검색: "$1,234.56" / "1234.56" / "1234" 형태를 금액(양수·음수 모두)으로 매칭
  const amountToken = String(params.query ?? '').trim().replace(/[$,\s]/g, '')
  if (/^\d+(?:\.\d+)?$/.test(amountToken)) {
    const n = Number(amountToken)
    if (Number.isFinite(n) && n > 0) {
      const eps = 0.005
      const posLo = (n - eps).toFixed(3)
      const posHi = (n + eps).toFixed(3)
      const negLo = (-n - eps).toFixed(3)
      const negHi = (-n + eps).toFixed(3)
      orParts.push(`and(amount.gte.${posLo},amount.lte.${posHi})`)
      orParts.push(`and(amount.gte.${negLo},amount.lte.${negHi})`)
    }
  }
  const orClause = orParts.join(',')

  const seen = new Set<string>()
  const rawLines: Record<string, unknown>[] = []

  for (let i = 0; i < importIds.length; i += STATEMENT_SEARCH_IMPORT_CHUNK) {
    if (seen.size >= limit) break
    const chunk = importIds.slice(i, i + STATEMENT_SEARCH_IMPORT_CHUNK)
    let query = supabase
      .from('statement_lines')
      .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
      .in('statement_import_id', chunk)
      .or(orClause)
    if (params.direction) query = query.eq('direction', params.direction)
    const { data, error } = await query
    if (error) throw error
    for (const line of (data || []) as Record<string, unknown>[]) {
      const id = String(line.id ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      rawLines.push(line)
      if (seen.size >= limit) break
    }
  }

  const qLower = q.toLowerCase()
  const importIdsByAccountName = imports
    .filter((im) => (accountNameById.get(im.financial_account_id) || '').toLowerCase().includes(qLower))
    .map((im) => im.id)

  if (importIdsByAccountName.length > 0 && seen.size < limit) {
    for (let i = 0; i < importIdsByAccountName.length; i += STATEMENT_SEARCH_IMPORT_CHUNK) {
      if (seen.size >= limit) break
      const chunk = importIdsByAccountName.slice(i, i + STATEMENT_SEARCH_IMPORT_CHUNK)
      let accountQuery = supabase
        .from('statement_lines')
        .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
        .in('statement_import_id', chunk)
        .limit(120)
      if (params.direction) accountQuery = accountQuery.eq('direction', params.direction)
      const { data, error } = await accountQuery
      if (error) throw error
      for (const line of (data || []) as Record<string, unknown>[]) {
        const id = String(line.id ?? '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        rawLines.push(line)
        if (seen.size >= limit) break
      }
    }
  }

  const candidates: Omit<SimilarStatementLineRow, 'existing_matches' | 'allocated_sum'>[] = []
  for (const line of rawLines) {
    const lineAmount = Number(line.amount ?? 0)
    const posted = String(line.posted_date ?? '').slice(0, 10)
    const importId = String(line.statement_import_id ?? '')
    const accountId = importToAccount.get(importId) || ''
    candidates.push({
      id: String(line.id),
      financial_account_id: accountId,
      financial_account_name: accountNameById.get(accountId) || accountId || '—',
      posted_date: posted,
      direction: String(line.direction ?? ''),
      amount: lineAmount,
      description: formatStatementLineDescription(
        line.description == null ? null : String(line.description),
        line.merchant == null ? null : String(line.merchant)
      ),
      matched_status: String(line.matched_status ?? ''),
      amount_diff: 0,
      day_diff: 0,
      score: 0
    })
  }

  candidates.sort((a, b) => (a.posted_date < b.posted_date ? 1 : a.posted_date > b.posted_date ? -1 : 0))
  const trimmed = candidates.slice(0, limit)
  const out = await attachExistingMatches(supabase, trimmed)

  out.sort((a, b) => {
    const aUn = a.matched_status === 'unmatched' ? 1 : 0
    const bUn = b.matched_status === 'unmatched' ? 1 : 0
    if (aUn !== bUn) return bUn - aUn
    if (a.posted_date !== b.posted_date) return a.posted_date < b.posted_date ? 1 : -1
    return 0
  })
  return out
}

function normalizeLedgerAmountForSource(sourceTable: ExpenseReconSourceTable, statementLineAmount: number): number {
  // 지출 원장값은 양수 저장이 기본이므로(입금 원장은 제외) 절대값으로 맞춥니다.
  if (sourceTable === 'payment_records') return statementLineAmount
  if (sourceTable === 'cash_transactions') return Math.abs(statementLineAmount)
  return Math.abs(statementLineAmount)
}

const EXPENSE_TABLES_WITH_STATEMENT_LINE_ID: ExpenseReconSourceTable[] = [
  'company_expenses',
  'tour_expenses',
  'reservation_expenses',
  'ticket_bookings',
]

function isSoftDeletableExpenseSource(table: string): table is ExpenseSoftDeleteTable {
  return (
    table === 'company_expenses' ||
    table === 'tour_expenses' ||
    table === 'reservation_expenses' ||
    table === 'ticket_bookings'
  )
}

async function clearLegacyStatementLineIdOnSource(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceId: string,
  statementLineId: string
): Promise<void> {
  if (!EXPENSE_TABLES_WITH_STATEMENT_LINE_ID.includes(sourceTable as ExpenseReconSourceTable)) return
  await supabase
    .from(sourceTable)
    .update({ statement_line_id: null })
    .eq('id', sourceId)
    .eq('statement_line_id', statementLineId)
}

export type StatementLineConflictResolution = 'unlinkOthers' | 'unlinkAndDeleteOthers'

/**
 * 선택한 명세 줄에 다른 원장이 연결되어 있을 때: 기존 연결만 해제하거나, 지출 행을 삭제(soft)한 뒤 이 원장 연결을 진행합니다.
 */
export async function resolveStatementLineConflictsBeforeLink(
  supabase: SupabaseClient,
  params: {
    statementLineId: string
    keepSourceTable: ExpenseReconSourceTable
    keepSourceId: string
    resolution: StatementLineConflictResolution
    actorEmail?: string | null
  }
): Promise<{ unlinkedCount: number; deletedCount: number; skippedDeleteCount: number }> {
  const { statementLineId, keepSourceTable, keepSourceId, resolution, actorEmail } = params

  const { data: matches, error } = await supabase
    .from('reconciliation_matches')
    .select('id, source_table, source_id')
    .eq('statement_line_id', statementLineId)
  if (error) throw error

  const others = (matches || []).filter(
    (m) =>
      !(
        String(m.source_table) === keepSourceTable &&
        String(m.source_id) === keepSourceId
      )
  )

  let unlinkedCount = 0
  let deletedCount = 0
  let skippedDeleteCount = 0

  for (const m of others) {
    const table = String(m.source_table ?? '')
    const sourceId = String(m.source_id ?? '')
    if (!table || !sourceId) continue

    if (resolution === 'unlinkAndDeleteOthers' && isSoftDeletableExpenseSource(table)) {
      await softDeleteExpenseRecord(supabase, table, sourceId, actorEmail ?? null)
      deletedCount += 1
    } else {
      const { error: delErr } = await supabase.from('reconciliation_matches').delete().eq('id', m.id)
      if (delErr) throw delErr
      await clearLegacyStatementLineIdOnSource(supabase, table, sourceId, statementLineId)
      unlinkedCount += 1
      if (resolution === 'unlinkAndDeleteOthers' && !isSoftDeletableExpenseSource(table)) {
        skippedDeleteCount += 1
      }
    }
  }

  await syncStatementLineMatchedStatus(supabase, statementLineId)
  return { unlinkedCount, deletedCount, skippedDeleteCount }
}

/** 명세 줄에 이미 배정된 금액(레거시 null·단일 연결 규칙은 attachExistingMatches와 동일) */
export function sumAllocatedOnStatementLine(
  matches: { matched_amount: number | string | null }[],
  lineAbs: number
): number {
  if (matches.length === 0) return 0
  let allocated = 0
  for (const x of matches) {
    if (x.matched_amount != null && x.matched_amount !== '') {
      allocated += Math.abs(Number(x.matched_amount))
    } else if (matches.length === 1) {
      allocated += lineAbs
    }
  }
  return allocated
}

/** 한 원장 행(지출·부킹 등)에 걸린 모든 명세 대조 연결 해제 */
export async function unlinkExpenseReconciliationMatchesForSource(
  supabase: SupabaseClient,
  sourceTable: ExpenseReconSourceTable,
  sourceId: string
): Promise<{ unlinkedCount: number }> {
  const { data: oldForSource, error } = await supabase
    .from('reconciliation_matches')
    .select('id, statement_line_id')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
  if (error) throw error

  const rows = (oldForSource || []) as { id: string; statement_line_id: string }[]
  const lineIds = new Set<string>()

  for (const row of rows) {
    const { error: delErr } = await supabase.from('reconciliation_matches').delete().eq('id', row.id)
    if (delErr) throw delErr
    const lid = String(row.statement_line_id ?? '').trim()
    if (lid) {
      lineIds.add(lid)
      await clearLegacyStatementLineIdOnSource(supabase, sourceTable, sourceId, lid)
    }
  }

  for (const lineId of lineIds) {
    await syncStatementLineMatchedStatus(supabase, lineId)
  }

  if (EXPENSE_TABLES_WITH_STATEMENT_LINE_ID.includes(sourceTable)) {
    await supabase.from(sourceTable).update({ statement_line_id: null }).eq('id', sourceId)
  }

  return { unlinkedCount: rows.length }
}

/**
 * 원장 행의 명세 연결 한 건 해제. `matchId`가 있으면 해당 행만, 없으면 `statementLineId`로 찾거나 전체 해제.
 */
export async function unlinkExpenseReconciliationMatch(
  supabase: SupabaseClient,
  params: {
    sourceTable: ExpenseReconSourceTable
    sourceId: string
    matchId?: string | null
    statementLineId?: string | null
  }
): Promise<{ unlinkedCount: number }> {
  const { sourceTable, sourceId, matchId, statementLineId } = params
  const mid = String(matchId ?? '').trim()
  if (mid) {
    const { data: row, error } = await supabase
      .from('reconciliation_matches')
      .select('id, statement_line_id, source_table, source_id')
      .eq('id', mid)
      .maybeSingle()
    if (error) throw error
    if (!row) return { unlinkedCount: 0 }
    const lineId = String(row.statement_line_id ?? '').trim()
    const { error: delErr } = await supabase.from('reconciliation_matches').delete().eq('id', mid)
    if (delErr) throw delErr
    if (lineId) {
      await clearLegacyStatementLineIdOnSource(
        supabase,
        String(row.source_table ?? sourceTable),
        String(row.source_id ?? sourceId),
        lineId
      )
      await syncStatementLineMatchedStatus(supabase, lineId)
    }
    return { unlinkedCount: 1 }
  }

  const lid = String(statementLineId ?? '').trim()
  if (lid) {
    const { data: rows, error } = await supabase
      .from('reconciliation_matches')
      .select('id')
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
      .eq('statement_line_id', lid)
    if (error) throw error
    let count = 0
    for (const r of rows || []) {
      const id = String((r as { id: string }).id ?? '').trim()
      if (!id) continue
      const { error: delErr } = await supabase.from('reconciliation_matches').delete().eq('id', id)
      if (delErr) throw delErr
      count += 1
    }
    await clearLegacyStatementLineIdOnSource(supabase, sourceTable, sourceId, lid)
    await syncStatementLineMatchedStatus(supabase, lid)
    if (count === 0 && EXPENSE_TABLES_WITH_STATEMENT_LINE_ID.includes(sourceTable)) {
      await supabase
        .from(sourceTable)
        .update({ statement_line_id: null })
        .eq('id', sourceId)
        .eq('statement_line_id', lid)
      count = 1
    }
    return { unlinkedCount: count }
  }

  return unlinkExpenseReconciliationMatchesForSource(supabase, sourceTable, sourceId)
}

/** 선택한 명세 줄들의 모든 대조 연결 해제(명세 줄 자체는 삭제하지 않음) */
export async function unlinkAllMatchesOnStatementLines(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<{ unlinkedCount: number }> {
  const unique = [...new Set(lineIds.map((id) => id.trim()).filter(Boolean))]
  let unlinkedCount = 0
  for (const lineId of unique) {
    const { data: matches, error } = await supabase
      .from('reconciliation_matches')
      .select('id, source_table, source_id')
      .eq('statement_line_id', lineId)
    if (error) throw error
    for (const m of matches || []) {
      const { error: delErr } = await supabase.from('reconciliation_matches').delete().eq('id', m.id)
      if (delErr) throw delErr
      await clearLegacyStatementLineIdOnSource(
        supabase,
        String(m.source_table ?? ''),
        String(m.source_id ?? ''),
        lineId
      )
      unlinkedCount += 1
    }
    await syncStatementLineMatchedStatus(supabase, lineId)
  }
  return { unlinkedCount }
}

/**
 * 한 지출(원장) 행에 이미 명세에 배정된 «순» 금액. 출금은 더하고 입금(환불)은 차감합니다.
 * 예: 출금 $500 + 입금(환불) $200 연결 → 배정 합 $300.
 * `matched_amount`가 null인 레거시 행은 해당 명세 줄 절대금액으로 간주합니다.
 */
export async function sumMatchedAmountAllocatedToSource(
  supabase: SupabaseClient,
  sourceTable: ExpenseReconSourceTable,
  sourceId: string
): Promise<number> {
  const { data: rows, error } = await supabase
    .from('reconciliation_matches')
    .select('matched_amount, statement_line_id')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
  if (error || !rows?.length) return 0

  const typedRows = rows as { matched_amount: unknown; statement_line_id: string }[]
  const lineInfoById = new Map<string, { abs: number; isInflow: boolean }>()
  const ids = [...new Set(typedRows.map((r) => r.statement_line_id).filter(Boolean))]
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60)
    const { data: lines } = await supabase
      .from('statement_lines')
      .select('id, amount, direction')
      .in('id', chunk)
    for (const l of (lines || []) as { id: string; amount?: unknown; direction?: unknown }[]) {
      lineInfoById.set(String(l.id), {
        abs: Math.abs(Number(l.amount ?? 0)),
        isInflow: String(l.direction ?? '').toLowerCase() === 'inflow',
      })
    }
  }

  let sum = 0
  for (const r of typedRows) {
    const info = lineInfoById.get(r.statement_line_id)
    const amt =
      r.matched_amount != null && r.matched_amount !== ''
        ? Math.abs(Number(r.matched_amount))
        : info?.abs ?? 0
    sum += info?.isInflow ? -amt : amt
  }
  return sum
}

/**
 * 이 원장 행을 선택한 명세 줄에 연결합니다.
 * `replace`(기본): 이 원장에 걸려 있던 명세 연결을 모두 지운 뒤 한 줄에만 다시 연결합니다.
 * `append`: 기존 연결을 유지하고, **다른 명세 줄**에 이 원장 금액의 일부를 추가로 배정합니다(통장이 여러 줄로 나뉜 경우).
 * 같은 명세 줄의 다른 원장 연결은 유지됩니다(한 줄·여러 지출 분할).
 */
export async function replaceExpenseReconciliationMatch(
  supabase: SupabaseClient,
  params: {
    actorEmail: string
    sourceTable: ExpenseReconSourceTable
    sourceId: string
    statementLineId: string
    statementLineAmount: number
    /** 이 원장이 이 명세 줄에서 차지하는 금액(분할 시 원장 금액). 생략 시 명세 줄 금액(기존 1:1 동작) */
    matchedAmount?: number | null
    syncSourceAmountToStatement?: boolean
    linkMode?: 'replace' | 'append'
    /** append 시 원장 총액(절대값) — 이미 명세에 배정된 합을 빼고 남은 금액만 추가 허용 */
    ledgerCapAmount?: number | null
  }
): Promise<void> {
  const {
    actorEmail,
    sourceTable,
    sourceId,
    statementLineId,
    statementLineAmount,
    matchedAmount: matchedAmountParam,
    syncSourceAmountToStatement = false,
    linkMode = 'replace',
    ledgerCapAmount = null
  } = params

  if (linkMode === 'replace') {
    const { data: oldForSource } = await supabase
      .from('reconciliation_matches')
      .select('id,statement_line_id')
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)

    for (const row of oldForSource || []) {
      await supabase.from('reconciliation_matches').delete().eq('id', row.id)
      await syncStatementLineMatchedStatus(supabase, row.statement_line_id)
    }
  }

  const { data: lineRow } = await supabase
    .from('statement_lines')
    .select('amount, direction')
    .eq('id', statementLineId)
    .maybeSingle()
  const lineAbs = Math.abs(Number((lineRow as { amount?: unknown } | null)?.amount ?? 0))
  const lineIsInflow =
    String((lineRow as { direction?: unknown } | null)?.direction ?? '').toLowerCase() === 'inflow'

  let ledgerShare =
    matchedAmountParam != null && Number.isFinite(Number(matchedAmountParam))
      ? Math.abs(Number(matchedAmountParam))
      : Math.abs(Number(statementLineAmount))

  // 입금(환불) 줄은 «순» 배정을 줄이므로 가드 대상에서 제외 — 줄 자체 한도(아래)만 적용
  if (linkMode === 'append' && !lineIsInflow) {
    const cap = ledgerCapAmount != null && Number.isFinite(Number(ledgerCapAmount)) ? Math.abs(Number(ledgerCapAmount)) : ledgerShare
    const allocated = await sumMatchedAmountAllocatedToSource(supabase, sourceTable, sourceId)
    const remaining = cap - allocated
    const capTol = Math.max(0.5, cap * 0.001)
    if (remaining <= capTol) {
      throw new Error(
        `이 원장 금액($${cap.toFixed(2)})은 이미 명세에 모두 배정된 것으로 보입니다. 추가 연결을 하려면 기존 대조를 먼저 해제하거나 금액을 확인하세요.`
      )
    }
    if (ledgerShare > remaining + capTol) {
      throw new Error(
        `이 원장에 추가로 배정 가능한 금액은 약 $${Math.max(0, remaining).toFixed(2)}입니다. (이미 배정: $${allocated.toFixed(2)})`
      )
    }
  }

  const { data: existingOnLine } = await supabase
    .from('reconciliation_matches')
    .select('matched_amount')
    .eq('statement_line_id', statementLineId)

  const existingRows = (existingOnLine || []) as { matched_amount: number | string | null }[]
  const existingSum = sumAllocatedOnStatementLine(existingRows, lineAbs)
  const allocTol = Math.max(0.5, lineAbs * 0.001)
  const lineRoom = Math.max(0, lineAbs - existingSum)

  if (linkMode === 'replace' && lineRoom > allocTol && ledgerShare > lineRoom + allocTol) {
    ledgerShare = lineRoom
  }

  if (lineAbs > 0 && existingSum + ledgerShare > lineAbs + allocTol) {
    throw new Error(
      `명세 금액($${lineAbs.toFixed(2)})에 이미 $${existingSum.toFixed(2)}가 배정되어 있어, 이 원장 $${ledgerShare.toFixed(2)}를 더하면 초과합니다. 기존 연결을 확인하거나 명세 대조 화면에서 조정하세요.`
    )
  }

  const { error: insErr } = await supabase.from('reconciliation_matches').insert({
    statement_line_id: statementLineId,
    source_table: sourceTable,
    source_id: sourceId,
    matched_amount: ledgerShare,
    matched_by: actorEmail
  })
  if (insErr) throw insErr
  await syncStatementLineMatchedStatus(supabase, statementLineId)

  if (syncSourceAmountToStatement && linkMode !== 'append') {
    const ledgerAmount = normalizeLedgerAmountForSource(sourceTable, statementLineAmount)
    if (sourceTable === 'reservation_expenses') {
      const { error: updErr } = await supabase.from('reservation_expenses').update({ amount: ledgerAmount }).eq('id', sourceId)
      if (updErr) throw updErr
    } else if (sourceTable === 'company_expenses') {
      const { error: updErr } = await supabase.from('company_expenses').update({ amount: ledgerAmount }).eq('id', sourceId)
      if (updErr) throw updErr
    } else if (sourceTable === 'tour_expenses') {
      const { error: updErr } = await supabase.from('tour_expenses').update({ amount: ledgerAmount }).eq('id', sourceId)
      if (updErr) throw updErr
    } else if (sourceTable === 'ticket_bookings') {
      const { error: updErr } = await supabase.from('ticket_bookings').update({ expense: ledgerAmount }).eq('id', sourceId)
      if (updErr) throw updErr
    } else if (sourceTable === 'tour_hotel_bookings') {
      const { error: updErr } = await supabase.from('tour_hotel_bookings').update({ total_price: ledgerAmount }).eq('id', sourceId)
      if (updErr) throw updErr
    } else if (sourceTable === 'cash_transactions') {
      const { error: updErr } = await supabase
        .from('cash_transactions')
        .update({ amount: ledgerAmount })
        .eq('id', sourceId)
      if (updErr) throw updErr
    }
  }
}
