import type { SupabaseClient } from '@supabase/supabase-js'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  addCalendarDaysYmd,
  expenseReconciliationAmountTolerance,
  replaceExpenseReconciliationMatch,
  type ExpenseReconSourceTable,
} from '@/lib/expense-reconciliation-similar-lines'

/** 예약·회사·투어 지출 명세 자동 매칭 — 등록일 기준 ±N일 */
export const EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW = 10
/** 합산 매칭: 같은 가맹점 그룹 안 명세 거래일 최대 간격(일) */
export const EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN = 10
/** 한 번에 자동 매칭 미리보기를 만들 지출 상한 */
export const EXPENSE_STATEMENT_AUTO_MATCH_MAX_EXPENSES = 300
/** 지출당 표시할 후보 수 */
export const EXPENSE_STATEMENT_AUTO_MATCH_CANDIDATE_LIMIT = 6
/** 합산 후보 — 한 그룹에서 묶을 최대 줄 수 */
const AGGREGATE_MAX_LINES_PER_COMBO = 6
/** 금액 «정확 일치» 부동소수 허용 */
const AMOUNT_EQUAL_EPS = 0.02
const ACCOUNT_MATCH_BONUS = 14
const ACCOUNT_MISMATCH_PENALTY = 8
const TEXT_BONUS_MAX = 12

export type ExpenseAutoMatchInputRow = {
  id: string
  submit_on: string
  amount: number
  paid_to: string
  paid_for: string
  payment_method: string | null
  /** 출처별 일괄 적용 — 생략 시 apply 호출 시 sourceTable 사용 */
  sourceTable?: ExpenseReconSourceTable
}

export type ExpenseStatementAutoMatchLine = {
  id: string
  financial_account_id: string
  financial_account_name: string
  posted_date: string
  amount: number
  description: string
  merchant_key: string
  merchant_label: string
  matched_status: string
  allocated_sum: number
  matchable_amount: number
  day_diff: number
}

export type ExpenseStatementAutoMatchCandidate = {
  key: string
  kind: 'single' | 'aggregate'
  line_ids: string[]
  lines: ExpenseStatementAutoMatchLine[]
  total_amount: number
  amount_diff: number
  max_day_span: number
  score: number
  merchant_label: string
  label: string
}

export type ExpenseStatementAutoMatchProposal = {
  expense_id: string
  submit_on: string
  amount: number
  paid_to: string
  paid_for: string
  candidates: ExpenseStatementAutoMatchCandidate[]
}

type RawStatementLine = {
  id: string
  statement_import_id: string
  posted_date: string
  amount: number
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string
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

function daySpanAmongDates(dates: string[]): number {
  if (dates.length <= 1) return 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const d of dates) {
    const n = ymdToUtcDayNumber(d)
    if (!Number.isFinite(n)) continue
    min = Math.min(min, n)
    max = Math.max(max, n)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return Number.POSITIVE_INFINITY
  return max - min
}

function autoMatchTextTokenSet(raw: string): Set<string> {
  const norm = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
  if (!norm) return new Set()
  const out = new Set<string>()
  for (const t of norm.split(/\s+/)) {
    if (t.length >= 2) out.add(t)
  }
  return out
}

function textOverlapBonus(lineTokens: Set<string>, expenseText: string): number {
  if (lineTokens.size === 0) return 0
  const expTokens = autoMatchTextTokenSet(expenseText)
  if (expTokens.size === 0) return 0
  let shared = 0
  for (const t of expTokens) if (lineTokens.has(t)) shared += 1
  if (shared === 0) return 0
  return Math.min(TEXT_BONUS_MAX, 4 + shared * 4)
}

/** 가맹점·적요를 «같은 곳» 그룹 키로 정규화 */
export function normalizeStatementMerchantKey(merchant: string | null | undefined, description: string | null | undefined): string {
  const raw = String(merchant ?? '').trim() || String(description ?? '').trim()
  if (!raw) return '__unknown__'
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

function merchantDisplayLabel(merchant: string | null | undefined, description: string | null | undefined): string {
  const m = String(merchant ?? '').trim()
  if (m) return m
  const d = String(description ?? '').trim()
  return d.length > 48 ? `${d.slice(0, 45)}…` : d || '—'
}

function lineTokensFromRaw(merchant: string | null | undefined, description: string | null | undefined): Set<string> {
  return autoMatchTextTokenSet(`${merchant ?? ''} ${description ?? ''}`)
}

function isLineMatchable(matchedStatus: string, matchableAmount: number): boolean {
  if (matchableAmount <= AMOUNT_EQUAL_EPS) return false
  const st = String(matchedStatus ?? '').toLowerCase()
  return st === 'unmatched' || st === 'partial'
}

function candidateLabel(candidate: Omit<ExpenseStatementAutoMatchCandidate, 'label' | 'key'>): string {
  if (candidate.kind === 'single') {
    const line = candidate.lines[0]
    return `${line.posted_date} · $${candidate.total_amount.toFixed(2)} · ${line.description}`
  }
  const dates = candidate.lines.map((l) => l.posted_date).sort()
  const range =
    dates.length > 1 && dates[0] !== dates[dates.length - 1]
      ? `${dates[0]}~${dates[dates.length - 1]}`
      : dates[0] ?? ''
  return `합산 ${candidate.lines.length}건 · $${candidate.total_amount.toFixed(2)} · ${candidate.merchant_label} · ${range}`
}

function scoreCandidate(params: {
  amountDiff: number
  maxDayDiff: number
  maxDaySpan: number
  kind: 'single' | 'aggregate'
  textBonus: number
  accountAdj: number
}): number {
  const { amountDiff, maxDayDiff, maxDaySpan, kind, textBonus, accountAdj } = params
  const exactBonus = amountDiff < AMOUNT_EQUAL_EPS ? 18 : 0
  const aggregatePenalty = kind === 'aggregate' ? 6 + params.maxDaySpan * 0.4 : 0
  const base = Math.max(
    1,
    100 - maxDayDiff * 4 - amountDiff * 2 - maxDaySpan * 1.5 - aggregatePenalty + exactBonus
  )
  return Math.max(1, Math.round(base + textBonus + accountAdj))
}

function findAggregateCombos(
  lines: ExpenseStatementAutoMatchLine[],
  targetAmount: number,
  tol: number
): ExpenseStatementAutoMatchLine[][] {
  if (lines.length < 2) return []
  const sorted = [...lines].sort((a, b) => a.posted_date.localeCompare(b.posted_date))
  const seen = new Set<string>()
  const out: ExpenseStatementAutoMatchLine[][] = []

  for (let i = 0; i < sorted.length; i++) {
    let sum = 0
    const combo: ExpenseStatementAutoMatchLine[] = []
    for (let j = i; j < sorted.length; j++) {
      const span = dayDiffFromYmd(sorted[i].posted_date, sorted[j].posted_date)
      if (span > EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN) break
      combo.push(sorted[j])
      sum += sorted[j].matchable_amount
      if (combo.length < 2) continue
      if (combo.length > AGGREGATE_MAX_LINES_PER_COMBO) break
      if (Math.abs(sum - targetAmount) > tol) continue
      const key = combo
        .map((l) => l.id)
        .sort()
        .join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push([...combo])
    }
  }
  return out
}

async function loadPaymentMethodFinancialAccountMap(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, financial_account_id')
  if (error) throw error
  for (const row of (data || []) as { id: string; financial_account_id: string | null }[]) {
    const fa = String(row.financial_account_id ?? '').trim()
    if (row.id && fa) map.set(row.id, fa)
  }
  return map
}

async function fetchStatementPoolForExpenses(
  supabase: SupabaseClient,
  expenses: ExpenseAutoMatchInputRow[]
): Promise<ExpenseStatementAutoMatchLine[]> {
  const ymds = expenses
    .map((e) => (e.submit_on ? e.submit_on.slice(0, 10) : ''))
    .filter((d) => d.length >= 10)
  if (ymds.length === 0) return []

  let minYmd = ymds[0]!
  let maxYmd = ymds[0]!
  for (const d of ymds) {
    if (d < minYmd) minYmd = d
    if (d > maxYmd) maxYmd = d
  }
  const startYmd = addCalendarDaysYmd(minYmd, -EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW)
  const endYmd = addCalendarDaysYmd(maxYmd, EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW)

  const { data: rawImports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id, financial_account_id, period_start, period_end')
    .order('period_start', { ascending: false })
    .limit(500)
  if (impErr) throw impErr

  const imports = ((rawImports || []) as { id: string; financial_account_id: string; period_start: string; period_end: string }[]).filter(
    (im) => {
      const ps = String(im.period_start ?? '').slice(0, 10)
      const pe = String(im.period_end ?? '').slice(0, 10)
      return ps <= endYmd && pe >= startYmd
    }
  )
  if (imports.length === 0) return []

  const accountIds = [...new Set(imports.map((i) => i.financial_account_id).filter(Boolean))]
  const accountNameById = new Map<string, string>()
  for (let i = 0; i < accountIds.length; i += 80) {
    const chunk = accountIds.slice(i, i + 80)
    const { data: accs } = await supabase.from('financial_accounts').select('id, name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      accountNameById.set(a.id, a.name)
    }
  }

  const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
  const importIds = imports.map((im) => im.id)
  const rawLines: RawStatementLine[] = []

  for (let i = 0; i < importIds.length; i += 80) {
    const chunk = importIds.slice(i, i + 80)
    const { data, error } = await supabase
      .from('statement_lines')
      .select('id, statement_import_id, posted_date, amount, direction, description, merchant, matched_status')
      .in('statement_import_id', chunk)
      .gte('posted_date', startYmd)
      .lte('posted_date', endYmd)
      .eq('direction', 'outflow')
      .eq('exclude_from_pnl', false)
    if (error) throw error
    for (const line of (data || []) as Record<string, unknown>[]) {
      rawLines.push({
        id: String(line.id),
        statement_import_id: String(line.statement_import_id ?? ''),
        posted_date: String(line.posted_date ?? '').slice(0, 10),
        amount: Number(line.amount ?? 0),
        direction: String(line.direction ?? ''),
        description: line.description == null ? null : String(line.description),
        merchant: line.merchant == null ? null : String(line.merchant),
        matched_status: String(line.matched_status ?? ''),
      })
    }
  }

  const lineIds = rawLines.map((l) => l.id)
  const allocByLine = new Map<string, number>()
  for (let i = 0; i < lineIds.length; i += 80) {
    const chunk = lineIds.slice(i, i + 80)
    const { data: mrows } = await supabase
      .from('reconciliation_matches')
      .select('statement_line_id, matched_amount')
      .in('statement_line_id', chunk)
    for (const m of (mrows || []) as { statement_line_id: string; matched_amount: number | string | null }[]) {
      const lid = m.statement_line_id
      const prev = allocByLine.get(lid) ?? 0
      if (m.matched_amount != null && m.matched_amount !== '') {
        allocByLine.set(lid, prev + Math.abs(Number(m.matched_amount)))
      }
    }
  }

  const pool: ExpenseStatementAutoMatchLine[] = []
  for (const line of rawLines) {
    const lineAbs = Math.abs(line.amount)
    const allocated = allocByLine.get(line.id) ?? 0
    const matchable = Math.max(0, lineAbs - allocated)
    if (!isLineMatchable(line.matched_status, matchable)) continue
    const importId = line.statement_import_id
    const accountId = importToAccount.get(importId) || ''
    pool.push({
      id: line.id,
      financial_account_id: accountId,
      financial_account_name: accountNameById.get(accountId) || accountId || '—',
      posted_date: line.posted_date,
      amount: line.amount,
      description: formatStatementLineDescription(line.description, line.merchant),
      merchant_key: normalizeStatementMerchantKey(line.merchant, line.description),
      merchant_label: merchantDisplayLabel(line.merchant, line.description),
      matched_status: line.matched_status,
      allocated_sum: allocated,
      matchable_amount: matchable,
      day_diff: 0,
    })
  }
  return pool
}

function buildCandidatesForExpense(
  expense: ExpenseAutoMatchInputRow,
  pool: ExpenseStatementAutoMatchLine[],
  paymentMethodFinancialAccountId: string | null
): ExpenseStatementAutoMatchCandidate[] {
  const submitYmd = expense.submit_on ? expense.submit_on.slice(0, 10) : ''
  if (!submitYmd) return []

  const absAmt = Math.abs(Number(expense.amount ?? 0))
  const tol = expenseReconciliationAmountTolerance(absAmt)
  const expenseText = `${expense.paid_to ?? ''} ${expense.paid_for ?? ''}`

  const near = pool
    .map((line) => ({
      ...line,
      day_diff: dayDiffFromYmd(line.posted_date, submitYmd),
    }))
    .filter((line) => line.day_diff <= EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW)

  const candidates: ExpenseStatementAutoMatchCandidate[] = []
  const usedLineSets = new Set<string>()

  for (const line of near) {
    const amountDiff = Math.abs(line.matchable_amount - absAmt)
    if (amountDiff > tol) continue
    const tokens = lineTokensFromRaw(line.merchant_label, line.description)
    const accountAdj =
      paymentMethodFinancialAccountId && line.financial_account_id
        ? paymentMethodFinancialAccountId === line.financial_account_id
          ? ACCOUNT_MATCH_BONUS
          : -ACCOUNT_MISMATCH_PENALTY
        : 0
    const partial: Omit<ExpenseStatementAutoMatchCandidate, 'key' | 'label'> = {
      kind: 'single',
      line_ids: [line.id],
      lines: [line],
      total_amount: line.matchable_amount,
      amount_diff: amountDiff,
      max_day_span: 0,
      merchant_label: line.merchant_label,
      score: scoreCandidate({
        amountDiff,
        maxDayDiff: line.day_diff,
        maxDaySpan: 0,
        kind: 'single',
        textBonus: textOverlapBonus(tokens, expenseText),
        accountAdj,
      }),
    }
    const key = `single:${line.id}`
    if (!usedLineSets.has(key)) {
      usedLineSets.add(key)
      candidates.push({
        ...partial,
        key,
        label: candidateLabel(partial),
      })
    }
  }

  const byMerchantAccount = new Map<string, ExpenseStatementAutoMatchLine[]>()
  for (const line of near) {
    const gk = `${line.merchant_key}|${line.financial_account_id}`
    const arr = byMerchantAccount.get(gk) ?? []
    arr.push(line)
    byMerchantAccount.set(gk, arr)
  }

  for (const [, groupLines] of byMerchantAccount) {
    if (groupLines.length < 2) continue
    const combos = findAggregateCombos(groupLines, absAmt, tol)
    for (const combo of combos) {
      const lineIds = combo.map((l) => l.id).sort()
      const setKey = lineIds.join('|')
      if (usedLineSets.has(setKey)) continue
      usedLineSets.add(setKey)

      const total = combo.reduce((s, l) => s + l.matchable_amount, 0)
      const amountDiff = Math.abs(total - absAmt)
      const dates = combo.map((l) => l.posted_date)
      const maxDaySpan = daySpanAmongDates(dates)
      const maxDayDiff = Math.max(...combo.map((l) => l.day_diff))
      const tokens = lineTokensFromRaw(combo[0]?.merchant_label, combo[0]?.description)
      const accountAdj =
        paymentMethodFinancialAccountId && combo[0]?.financial_account_id
          ? paymentMethodFinancialAccountId === combo[0].financial_account_id
            ? ACCOUNT_MATCH_BONUS
            : -ACCOUNT_MISMATCH_PENALTY
          : 0
      const partial: Omit<ExpenseStatementAutoMatchCandidate, 'key' | 'label'> = {
        kind: 'aggregate',
        line_ids: lineIds,
        lines: combo,
        total_amount: Math.round(total * 100) / 100,
        amount_diff: amountDiff,
        max_day_span: maxDaySpan,
        merchant_label: combo[0]?.merchant_label ?? '—',
        score: scoreCandidate({
          amountDiff,
          maxDayDiff,
          maxDaySpan,
          kind: 'aggregate',
          textBonus: textOverlapBonus(tokens, expenseText),
          accountAdj,
        }),
      }
      candidates.push({
        ...partial,
        key: `agg:${setKey}`,
        label: candidateLabel(partial),
      })
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    if (a.kind !== b.kind) return a.kind === 'single' ? -1 : 1
    const dayA = Math.max(...a.lines.map((l) => l.day_diff))
    const dayB = Math.max(...b.lines.map((l) => l.day_diff))
    return dayA - dayB
  })

  return candidates.slice(0, EXPENSE_STATEMENT_AUTO_MATCH_CANDIDATE_LIMIT)
}

/** 미연결 지출 목록에 대한 자동 매칭 미리보기 */
export async function prepareExpenseStatementAutoMatchProposals(
  supabase: SupabaseClient,
  expenses: ExpenseAutoMatchInputRow[],
  opts?: { excludeExpenseIds?: Set<string> }
): Promise<{
  proposals: ExpenseStatementAutoMatchProposal[]
  poolSize: number
  skippedNoDate: number
}> {
  const exclude = opts?.excludeExpenseIds ?? new Set<string>()
  const targets = expenses
    .filter((e) => e.id && !exclude.has(e.id))
    .slice(0, EXPENSE_STATEMENT_AUTO_MATCH_MAX_EXPENSES)

  const pool = await fetchStatementPoolForExpenses(supabase, targets)
  const pmFaMap = await loadPaymentMethodFinancialAccountMap(supabase)

  const proposals: ExpenseStatementAutoMatchProposal[] = []
  let skippedNoDate = 0

  for (const expense of targets) {
    const submitYmd = expense.submit_on ? expense.submit_on.slice(0, 10) : ''
    if (!submitYmd) {
      skippedNoDate += 1
      continue
    }
    const pmId = String(expense.payment_method ?? '').trim()
    const faId = pmId ? pmFaMap.get(pmId) ?? null : null
    const candidates = buildCandidatesForExpense(expense, pool, faId)
    if (candidates.length === 0) continue
    proposals.push({
      expense_id: expense.id,
      submit_on: submitYmd,
      amount: Math.abs(Number(expense.amount ?? 0)),
      paid_to: expense.paid_to ?? '',
      paid_for: expense.paid_for ?? '',
      candidates,
    })
  }

  return { proposals, poolSize: pool.length, skippedNoDate }
}

/** 미리보기에서 선택한 건을 DB에 저장 */
export async function applyExpenseStatementAutoMatchProposals(
  supabase: SupabaseClient,
  params: {
    actorEmail: string
    sourceTable: ExpenseReconSourceTable
    items: {
      expense_id: string
      candidate: ExpenseStatementAutoMatchCandidate
      ledger_amount: number
      sourceTable?: ExpenseReconSourceTable
    }[]
  }
): Promise<{ applied: number; skippedConflict: number; skippedInvalid: number }> {
  const usedLineIds = new Set<string>()
  let applied = 0
  let skippedConflict = 0
  let skippedInvalid = 0

  for (const item of params.items) {
    const candidate = item.candidate
    if (!candidate?.line_ids?.length) {
      skippedInvalid += 1
      continue
    }
    if (candidate.line_ids.some((id) => usedLineIds.has(id))) {
      skippedConflict += 1
      continue
    }

    const ledgerCap = Math.abs(Number(item.ledger_amount ?? 0))
    try {
      for (let i = 0; i < candidate.lines.length; i++) {
        const line = candidate.lines[i]!
        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: params.actorEmail,
          sourceTable: item.sourceTable ?? params.sourceTable,
          sourceId: item.expense_id,
          statementLineId: line.id,
          statementLineAmount: line.amount,
          matchedAmount: line.matchable_amount,
          linkMode: i === 0 ? 'replace' : 'append',
          ledgerCapAmount: ledgerCap,
        })
        usedLineIds.add(line.id)
      }
      applied += 1
    } catch {
      skippedInvalid += 1
    }
  }

  return { applied, skippedConflict, skippedInvalid }
}

/** 일괄 미리보기 기본 선택 — 명세 줄이 겹치지 않게 높은 점수부터 배정 */
export function pickDefaultExpenseAutoMatchSelections(
  proposals: ExpenseStatementAutoMatchProposal[]
): { selectedExpenseIds: Set<string>; candidateKeyByExpenseId: Record<string, string> } {
  const ranked = proposals
    .map((p) => ({
      p,
      best: p.candidates[0],
      score: p.candidates[0]?.score ?? 0,
    }))
    .sort((a, b) => b.score - a.score)

  const selectedExpenseIds = new Set<string>()
  const candidateKeyByExpenseId: Record<string, string> = {}
  const usedLineIds = new Set<string>()

  for (const { p, best } of ranked) {
    if (!best) continue
    if (best.line_ids.some((id) => usedLineIds.has(id))) continue
    selectedExpenseIds.add(p.expense_id)
    candidateKeyByExpenseId[p.expense_id] = best.key
    for (const id of best.line_ids) usedLineIds.add(id)
  }

  return { selectedExpenseIds, candidateKeyByExpenseId }
}
