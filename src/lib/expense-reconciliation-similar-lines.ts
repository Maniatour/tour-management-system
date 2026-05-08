import type { SupabaseClient } from '@supabase/supabase-js'
import { formatStatementLineDescription } from '@/lib/statement-display'

/** 명세 대조 화면의 운영 원장 «수동 후보»와 동일한 거래일 ±일 */
export const RECON_EXPENSE_LEDGER_DAY_WINDOW = 4

export type ExpenseReconSourceTable =
  | 'payment_records'
  | 'reservation_expenses'
  | 'company_expenses'
  | 'tour_expenses'
  | 'ticket_bookings'
  | 'tour_hotel_bookings'

export type ExpenseStatementReconContext = {
  sourceTable: ExpenseReconSourceTable
  sourceId: string
  dateYmd: string
  amount: number
  direction: 'inflow' | 'outflow'
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

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
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

/**
 * 업로드된 명세 중 기간이 겹치는 import의 줄만 조회합니다.
 * 이미 다른 원장과 연결된 명세 줄도 포함합니다(재매칭용).
 *
 * `amountOnly`: 최근 명세 파일에서 **거래일 범위를 쓰지 않고** 금액·방향만으로 후보를 찾습니다.
 */
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
    direction: 'inflow' | 'outflow'
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
  const orClause = orParts.join(',')

  const seen = new Set<string>()
  const rawLines: Record<string, unknown>[] = []

  for (let i = 0; i < importIds.length; i += STATEMENT_SEARCH_IMPORT_CHUNK) {
    if (seen.size >= limit) break
    const chunk = importIds.slice(i, i + STATEMENT_SEARCH_IMPORT_CHUNK)
    const { data, error } = await supabase
      .from('statement_lines')
      .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
      .in('statement_import_id', chunk)
      .eq('direction', params.direction)
      .or(orClause)
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
      const { data, error } = await supabase
        .from('statement_lines')
        .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
        .in('statement_import_id', chunk)
        .eq('direction', params.direction)
        .limit(120)
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
  return Math.abs(statementLineAmount)
}

/**
 * 한 지출(원장) 행에 이미 명세에 배정된 금액 합계. `matched_amount`가 null인 레거시 행은 해당 명세 줄 절대금액으로 간주합니다.
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

  const needLineAmount = (rows as { matched_amount: unknown; statement_line_id: string }[]).filter(
    (r) => r.matched_amount == null || r.matched_amount === ''
  )
  const lineAmtById = new Map<string, number>()
  if (needLineAmount.length > 0) {
    const ids = [...new Set(needLineAmount.map((r) => r.statement_line_id).filter(Boolean))]
    for (let i = 0; i < ids.length; i += 60) {
      const chunk = ids.slice(i, i + 60)
      const { data: lines } = await supabase.from('statement_lines').select('id, amount').in('id', chunk)
      for (const l of (lines || []) as { id: string; amount?: unknown }[]) {
        lineAmtById.set(String(l.id), Math.abs(Number(l.amount ?? 0)))
      }
    }
  }

  let sum = 0
  for (const r of rows as { matched_amount: unknown; statement_line_id: string }[]) {
    if (r.matched_amount != null && r.matched_amount !== '') {
      sum += Math.abs(Number(r.matched_amount))
    } else {
      sum += lineAmtById.get(r.statement_line_id) ?? 0
    }
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

  const { data: lineRow } = await supabase.from('statement_lines').select('amount').eq('id', statementLineId).maybeSingle()
  const lineAbs = Math.abs(Number((lineRow as { amount?: unknown } | null)?.amount ?? 0))

  let ledgerShare =
    matchedAmountParam != null && Number.isFinite(Number(matchedAmountParam))
      ? Math.abs(Number(matchedAmountParam))
      : Math.abs(Number(statementLineAmount))

  if (linkMode === 'append') {
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

  let existingSum = 0
  for (const r of (existingOnLine || []) as { matched_amount: number | string | null }[]) {
    existingSum += r.matched_amount != null && r.matched_amount !== '' ? Number(r.matched_amount) : 0
  }
  const allocTol = Math.max(0.5, lineAbs * 0.001)
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
    }
  }
}
