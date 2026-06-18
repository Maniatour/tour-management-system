import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addCalendarDaysYmd,
  expenseReconciliationAmountTolerance,
  RECON_EXPENSE_LEDGER_DAY_WINDOW,
  type ExpenseReconSourceTable,
} from '@/lib/expense-reconciliation-similar-lines'
import { formatStatementLineDescription } from '@/lib/statement-display'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

/** 현금 출금과 대조 가능한 지출 원장 */
export const EXPENSE_CASH_LINK_SOURCE_TABLES = new Set<ExpenseReconSourceTable>([
  'tour_expenses',
  'reservation_expenses',
  'company_expenses',
  'ticket_bookings',
  'tour_hotel_bookings',
])

export function expenseSourceSupportsCashLedgerLink(sourceTable: ExpenseReconSourceTable): boolean {
  return EXPENSE_CASH_LINK_SOURCE_TABLES.has(sourceTable)
}

export type ExpenseCashLinkSourceTable = Extract<
  ExpenseReconSourceTable,
  'tour_expenses' | 'reservation_expenses' | 'company_expenses' | 'ticket_bookings' | 'tour_hotel_bookings'
>

export type ExpenseForCashExternalLink = {
  kind: 'statement' | 'cash'
  ref_id: string
  date: string
  amount: number
  label: string
  account_name: string | null
  /** cash kind — 이 모달에서 연 중인 현금 출금과 동일 */
  is_current_cash: boolean
}

export type SimilarExpenseForCashRow = {
  key: string
  source_table: ExpenseCashLinkSourceTable
  source_id: string
  submit_date: string
  amount: number
  paid_to: string | null
  paid_for: string | null
  detail: string | null
  /** submit_by / submitted_by (이메일) */
  submitter_email: string | null
  amount_diff: number
  day_diff: number
  score: number
  linked_to_this_cash: boolean
  /** 은행 명세·다른 현금 출금 등 기존 대조 */
  external_links: ExpenseForCashExternalLink[]
}

function submitterEmailFromExpenseRow(
  sourceTable: ExpenseCashLinkSourceTable,
  row: Record<string, unknown>
): string | null {
  const raw =
    sourceTable === 'company_expenses'
      ? row.submit_by
      : row.submitted_by
  const s = raw == null ? '' : String(raw).trim()
  return s || null
}

const EXPENSE_TABLES_WITH_LEGACY_STATEMENT_LINE_ID = new Set<ExpenseCashLinkSourceTable>([
  'company_expenses',
  'tour_expenses',
  'reservation_expenses',
  'ticket_bookings',
])

export function expenseForCashHasStatementLink(row: SimilarExpenseForCashRow): boolean {
  return row.external_links.some((l) => l.kind === 'statement')
}

export function expenseForCashHasOtherCashLink(row: SimilarExpenseForCashRow): boolean {
  return row.external_links.some((l) => l.kind === 'cash' && !l.is_current_cash)
}

export function expenseCashLinkRowKey(sourceTable: string, sourceId: string): string {
  return `${sourceTable}:${sourceId}`
}

export function parseExpenseCashLinkRowKey(
  key: string
): { sourceTable: ExpenseCashLinkSourceTable; sourceId: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const sourceTable = key.slice(0, idx) as ExpenseCashLinkSourceTable
  const sourceId = key.slice(idx + 1).trim()
  if (!sourceId || !expenseSourceSupportsCashLedgerLink(sourceTable)) return null
  return { sourceTable, sourceId }
}

export type SimilarCashTransactionRow = {
  id: string
  transaction_date: string
  amount: number
  description: string
  category: string | null
  amount_diff: number
  day_diff: number
  score: number
  linked_to_this_expense: boolean
}

function ymdFromTimestamp(raw: string): string {
  const s = String(raw ?? '').trim()
  if (s.length >= 10) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayDiffFromYmd(iso: string, ymd: string): number {
  const a = ymdFromTimestamp(iso)
  if (!a || !ymd) return Number.POSITIVE_INFINITY
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${ymd.slice(0, 10)}T00:00:00Z`).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY
  return Math.abs(Math.round((da - db) / 86400000))
}

function lineQualifiesForExpense(absLine: number, absLedger: number, tol: number): boolean {
  if (absLedger <= 0) return absLine <= tol
  return Math.abs(absLine - absLedger) <= tol
}

const EXPENSE_CASH_LEDGER_MATCHES_TABLE = 'expense_cash_ledger_matches'

/** 원격 DB에 마이그레이션 미적용 시 PostgREST 404 / PGRST205 — 이후 조회는 건너뜀 */
let expenseCashLedgerMatchesTableUnavailable = false

function isExpenseCashLedgerMatchesTableUnavailable(
  err: { code?: string; message?: string } | null
): boolean {
  if (!err) return false
  if (err.code === 'PGRST205') return true
  const m = (err.message ?? '').toLowerCase()
  return (
    (m.includes('schema cache') || m.includes('could not find')) &&
    m.includes(EXPENSE_CASH_LEDGER_MATCHES_TABLE)
  )
}

function markExpenseCashLedgerMatchesTableUnavailable(
  err: { code?: string; message?: string } | null
): void {
  if (isExpenseCashLedgerMatchesTableUnavailable(err)) {
    expenseCashLedgerMatchesTableUnavailable = true
  }
}

function assertExpenseCashLedgerMatchesTableAvailable(
  err: { code?: string; message?: string } | null
): void {
  if (isExpenseCashLedgerMatchesTableUnavailable(err)) {
    markExpenseCashLedgerMatchesTableUnavailable(err)
    throw new Error(
      'expense_cash_ledger_matches 테이블이 없습니다. supabase/migrations/20260614120000_expense_cash_ledger_matches.sql 마이그레이션을 원격 DB에 적용해 주세요.'
    )
  }
}

export async function fetchCashLedgerMatchedExpenseIds(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceIds: string[]
): Promise<Set<string>> {
  const ids = sourceIds.filter(Boolean)
  if (ids.length === 0 || expenseCashLedgerMatchesTableUnavailable) return new Set()
  const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .select('expense_source_id')
    .eq('expense_source_table', sourceTable)
    .in('expense_source_id', ids)
  if (error) {
    markExpenseCashLedgerMatchesTableUnavailable(error)
    return new Set()
  }
  if (!data) return new Set()
  return new Set(
    (data as { expense_source_id: string }[]).map((r) => String(r.expense_source_id))
  )
}

export async function fetchCashLedgerMatchedExpenseIdsBatched(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceIds: string[],
  chunkSize = 200
): Promise<Set<string>> {
  const ids = [...new Set(sourceIds.filter(Boolean))]
  if (ids.length === 0) return new Set()
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const s = await fetchCashLedgerMatchedExpenseIds(supabase, sourceTable, chunk)
    s.forEach((id) => out.add(id))
  }
  return out
}

export async function fetchLinkedCashTransactionsForExpense(
  supabase: SupabaseClient,
  params: { sourceTable: ExpenseReconSourceTable; sourceId: string }
): Promise<SimilarCashTransactionRow[]> {
  const { sourceTable, sourceId } = params
  if (expenseCashLedgerMatchesTableUnavailable) return []
  const { data: links, error: linkErr } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .select('cash_transaction_id, matched_amount')
    .eq('expense_source_table', sourceTable)
    .eq('expense_source_id', sourceId)
  if (linkErr) {
    markExpenseCashLedgerMatchesTableUnavailable(linkErr)
    if (expenseCashLedgerMatchesTableUnavailable) return []
    throw linkErr
  }
  const cashIds = (links ?? [])
    .map((r: { cash_transaction_id?: string }) => String(r.cash_transaction_id ?? '').trim())
    .filter(Boolean)
  if (cashIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('cash_transactions')
    .select('id,transaction_date,transaction_type,amount,description,category')
    .in('id', cashIds)
  if (error) throw error

  return (rows ?? []).map((row) => {
    const amount = Math.abs(Number(row.amount ?? 0))
    const ymd = ymdFromTimestamp(String(row.transaction_date ?? ''))
    return {
      id: String(row.id),
      transaction_date: ymd,
      amount,
      description: String(row.description ?? '').trim() || '—',
      category: row.category ?? null,
      amount_diff: 0,
      day_diff: 0,
      score: 1000,
      linked_to_this_expense: true,
    }
  })
}

export async function fetchSimilarCashTransactionsForExpense(
  supabase: SupabaseClient,
  params: {
    dateYmd: string
    amount: number
    limit?: number
    /** 이미 이 지출에 연결된 cash id — 목록에 포함(표시용) */
    linkedCashIds?: Set<string>
  }
): Promise<SimilarCashTransactionRow[]> {
  const { dateYmd, amount, limit = 50, linkedCashIds = new Set<string>() } = params
  if (!dateYmd || dateYmd.length < 10) return []

  const absLedger = Math.abs(amount)
  const tol = expenseReconciliationAmountTolerance(absLedger)
  const dayWindow = RECON_EXPENSE_LEDGER_DAY_WINDOW
  const startIso = `${addCalendarDaysYmd(dateYmd, -dayWindow)}T00:00:00.000Z`
  const endIso = `${addCalendarDaysYmd(dateYmd, dayWindow)}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('cash_transactions')
    .select('id,transaction_date,transaction_type,amount,description,category')
    .eq('transaction_type', 'withdrawal')
    .gte('transaction_date', startIso)
    .lte('transaction_date', endIso)
    .order('transaction_date', { ascending: false })
    .limit(400)
  if (error) throw error

  const candidates: SimilarCashTransactionRow[] = []
  for (const row of data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    const lineAmount = Math.abs(Number(row.amount ?? 0))
    if (!lineQualifiesForExpense(lineAmount, absLedger, tol) && !linkedCashIds.has(id)) continue
    const ymd = ymdFromTimestamp(String(row.transaction_date ?? ''))
    const amountDiff = Math.abs(lineAmount - absLedger)
    const dayDiff = dayDiffFromYmd(ymd, dateYmd)
    const exactBonus = amountDiff < 0.02 ? 40 : 0
    candidates.push({
      id,
      transaction_date: ymd,
      amount: lineAmount,
      description: String(row.description ?? '').trim() || '—',
      category: row.category ?? null,
      amount_diff: amountDiff,
      day_diff: dayDiff,
      score: 100 + exactBonus - amountDiff * 10 - dayDiff * 4,
      linked_to_this_expense: linkedCashIds.has(id),
    })
  }

  candidates.sort((a, b) => {
    if (a.linked_to_this_expense !== b.linked_to_this_expense) {
      return a.linked_to_this_expense ? -1 : 1
    }
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    if (a.day_diff !== b.day_diff) return a.day_diff - b.day_diff
    return b.score - a.score
  })

  return candidates.slice(0, limit)
}

function sanitizeCashSearchQuery(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\x00-\x1f]/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .slice(0, 100)
}

/** 검색창 금액 파싱 — $1,234.56 · 1234 · 1234.56 등 */
function parseCashSearchAmount(raw: string): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const noCurrency = s.replace(/^\$+\s*/, '').trim()
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(noCurrency)) {
    const n = Number(noCurrency.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const compact = noCurrency.replace(/[\s,]/g, '')
  if (/^\d+(\.\d+)?$/.test(compact)) {
    const n = Number(compact)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const eu = noCurrency.replace(/\s/g, '')
  if (/^\d+,\d{1,2}$/.test(eu)) {
    const n = Number(eu.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

function isCashSearchAmountOnly(raw: string, parsed: number): boolean {
  const s = String(raw ?? '').trim()
  if (!s || parseCashSearchAmount(s) !== parsed) return false
  const withoutCurrency = s.replace(/^\$+\s*/, '')
  return !/[a-zA-Z가-힣]/.test(withoutCurrency)
}

function filterRawCashPickerRows(
  rows: RawCashSearchRow[],
  params: {
    category?: string | null
    startDateYmd?: string
    endDateYmd?: string
    limit: number
  }
): RawCashSearchRow[] {
  let out = rows
  if (params.category) {
    out = out.filter((r) => (r.category ?? '') === params.category)
  }
  if (params.startDateYmd) {
    const start = params.startDateYmd
    out = out.filter((r) => ymdFromTimestamp(r.transaction_date) >= start)
  }
  if (params.endDateYmd) {
    const end = params.endDateYmd
    out = out.filter((r) => ymdFromTimestamp(r.transaction_date) <= end)
  }
  return out.slice(0, params.limit)
}

/** 금액 검색용 허용 오차 — 명세 대조와 동일(최소 $5 또는 5%) */
function cashSearchAmountTolerance(absAmount: number): number {
  return expenseReconciliationAmountTolerance(absAmount)
}

type RawCashSearchRow = {
  id: string
  transaction_date: string
  amount: number
  description: string | null
  category: string | null
}

function mapRawCashToCandidate(
  row: RawCashSearchRow,
  params: {
    linkedCashIds: Set<string>
    dateYmd: string
    absLedger: number
    targetAmount?: number | null
  }
): SimilarCashTransactionRow {
  const lineAmount = Math.abs(Number(row.amount ?? 0))
  const ymd = ymdFromTimestamp(String(row.transaction_date ?? ''))
  const amountDiff =
    params.targetAmount != null && params.targetAmount > 0
      ? Math.abs(lineAmount - params.targetAmount)
      : params.absLedger > 0
        ? Math.abs(lineAmount - params.absLedger)
        : 0
  const dayDiff = params.dateYmd ? dayDiffFromYmd(ymd, params.dateYmd) : 0
  const exactBonus = amountDiff < 0.02 ? 40 : 0
  return {
    id: row.id,
    transaction_date: ymd,
    amount: lineAmount,
    description: String(row.description ?? '').trim() || '—',
    category: row.category ?? null,
    amount_diff: amountDiff,
    day_diff: dayDiff,
    score: 100 + exactBonus - amountDiff * 10 - dayDiff * 4,
    linked_to_this_expense: params.linkedCashIds.has(row.id),
  }
}

async function fetchCashWithdrawalsByAmountSearch(
  supabase: SupabaseClient,
  targetAmount: number,
  limit: number
): Promise<RawCashSearchRow[]> {
  const tol = cashSearchAmountTolerance(targetAmount)
  const lo = Math.max(0, targetAmount - tol)
  const hi = targetAmount + tol
  const seen = new Set<string>()
  const out: RawCashSearchRow[] = []

  const pushRows = (rows: Record<string, unknown>[] | null, amountTol = tol) => {
    for (const row of rows ?? []) {
      const id = String(row.id ?? '')
      if (!id || seen.has(id)) continue
      const lineAmount = Math.abs(Number(row.amount ?? 0))
      if (Math.abs(lineAmount - targetAmount) > amountTol) continue
      seen.add(id)
      out.push({
        id,
        transaction_date: String(row.transaction_date ?? ''),
        amount: Number(row.amount ?? 0),
        description: row.description == null ? null : String(row.description),
        category: row.category == null ? null : String(row.category),
      })
      if (out.length >= limit) return
    }
  }

  const select = 'id,transaction_date,transaction_type,amount,description,category'
  const base = () =>
    supabase
      .from('cash_transactions')
      .select(select)
      .eq('transaction_type', 'withdrawal')
      .order('transaction_date', { ascending: false })
      .limit(Math.min(limit * 3, 400))

  const [posRes, negRes] = await Promise.all([
    base().gte('amount', lo).lte('amount', hi),
    base().gte('amount', -hi).lte('amount', -lo),
  ])
  if (posRes.error) throw posRes.error
  if (negRes.error) throw negRes.error
  pushRows((posRes.data ?? []) as Record<string, unknown>[])
  pushRows((negRes.data ?? []) as Record<string, unknown>[])

  if (out.length === 0) {
    const wideTol = Math.max(tol * 2, targetAmount * 0.15)
    const wLo = Math.max(0, targetAmount - wideTol)
    const wHi = targetAmount + wideTol
    const [widePos, wideNeg] = await Promise.all([
      base().gte('amount', wLo).lte('amount', wHi),
      base().gte('amount', -wHi).lte('amount', -wLo),
    ])
    if (widePos.error) throw widePos.error
    if (wideNeg.error) throw wideNeg.error
    pushRows((widePos.data ?? []) as Record<string, unknown>[], wideTol)
    pushRows((wideNeg.data ?? []) as Record<string, unknown>[], wideTol)
  }

  return out.slice(0, limit)
}

/** 유사 현금 지출 — 날짜·금액 창 밖에서도 설명·카테고리·거래일·금액·ID로 검색 */
export async function searchCashTransactions(
  supabase: SupabaseClient,
  params: {
    query: string
    limit?: number
    linkedCashIds?: Set<string>
    dateYmd?: string
    ledgerAmount?: number
  }
): Promise<SimilarCashTransactionRow[]> {
  const rawQuery = String(params.query ?? '').trim()
  const q = sanitizeCashSearchQuery(rawQuery)
  if (!q && !rawQuery) return []

  const limit = params.limit ?? 120
  const linkedCashIds = params.linkedCashIds ?? new Set<string>()
  const dateYmd = params.dateYmd?.slice(0, 10) ?? ''
  const absLedger = Math.abs(Number(params.ledgerAmount ?? 0))
  const parsedAmount = parseCashSearchAmount(rawQuery)
  const mapParams = { linkedCashIds, dateYmd, absLedger, targetAmount: parsedAmount }

  const seen = new Set<string>()
  const candidates: SimilarCashTransactionRow[] = []
  const pushCandidate = (c: SimilarCashTransactionRow) => {
    if (seen.has(c.id)) return
    seen.add(c.id)
    candidates.push(c)
  }

  if (parsedAmount != null) {
    const byAmount = await fetchCashWithdrawalsByAmountSearch(supabase, parsedAmount, limit)
    for (const row of byAmount) {
      pushCandidate(mapRawCashToCandidate(row, mapParams))
    }
  }

  const textQ = q.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  if (textQ && (!parsedAmount || textQ.replace(/\s/g, '') !== String(parsedAmount))) {
    const innerQuoted = textQ.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const orParts = [
      `description.ilike."%${innerQuoted}%"`,
      `category.ilike."%${innerQuoted}%"`,
    ]
    if (/^\d{4}-\d{2}-\d{2}$/.test(textQ)) {
      orParts.push(`and(transaction_date.gte.${textQ}T00:00:00.000Z,transaction_date.lte.${textQ}T23:59:59.999Z)`)
    }
    if (/^[a-f0-9-]{6,}$/i.test(textQ.replace(/\s/g, ''))) {
      orParts.push(`id.ilike."%${innerQuoted}%"`)
    }

    const { data, error } = await supabase
      .from('cash_transactions')
      .select('id,transaction_date,transaction_type,amount,description,category')
      .eq('transaction_type', 'withdrawal')
      .or(orParts.join(','))
      .order('transaction_date', { ascending: false })
      .limit(limit)
    if (error) throw error

    for (const row of data ?? []) {
      const id = String(row.id ?? '')
      if (!id) continue
      pushCandidate(
        mapRawCashToCandidate(
          {
            id,
            transaction_date: String(row.transaction_date ?? ''),
            amount: Number(row.amount ?? 0),
            description: row.description == null ? null : String(row.description),
            category: row.category == null ? null : String(row.category),
          },
          { ...mapParams, targetAmount: parsedAmount }
        )
      )
    }
  }

  candidates.sort((a, b) => {
    if (a.linked_to_this_expense !== b.linked_to_this_expense) {
      return a.linked_to_this_expense ? -1 : 1
    }
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    if (a.day_diff !== b.day_diff) return a.day_diff - b.day_diff
    return b.score - a.score
  })

  return candidates.slice(0, limit)
}

export async function fetchCashWithdrawalCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('category')
    .eq('transaction_type', 'withdrawal')
    .not('category', 'is', null)
    .limit(500)
  if (error) throw error
  const set = new Set<string>()
  for (const row of data ?? []) {
    const c = String((row as { category?: string | null }).category ?? '').trim()
    if (c) set.add(c)
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** 현금 관리 출금 내역 — 피커 모달용 전체 테이블 조회 */
export async function fetchCashWithdrawalsForPicker(
  supabase: SupabaseClient,
  params: {
    search?: string
    /** 금액 전용 검색 (예: 100, $97.50) — 기간 필터 없이 금액 일치 우선 */
    amountSearch?: string
    startDateYmd?: string
    endDateYmd?: string
    category?: string | null
    limit?: number
    linkedCashIds?: Set<string>
    ledgerDateYmd?: string
    ledgerAmount?: number
  }
): Promise<SimilarCashTransactionRow[]> {
  const limit = params.limit ?? 300
  const linkedCashIds = params.linkedCashIds ?? new Set<string>()
  const dateYmd = params.ledgerDateYmd?.slice(0, 10) ?? ''
  const absLedger = Math.abs(Number(params.ledgerAmount ?? 0))
  const mapParams = { linkedCashIds, dateYmd, absLedger }

  const mapRawRows = (rawRows: RawCashSearchRow[]): SimilarCashTransactionRow[] => {
    const rows: SimilarCashTransactionRow[] = []
    for (const row of rawRows) {
      const id = String(row.id ?? '')
      if (!id) continue
      rows.push(
        mapRawCashToCandidate(
          {
            id,
            transaction_date: String(row.transaction_date ?? ''),
            amount: Number(row.amount ?? 0),
            description: row.description == null ? null : String(row.description),
            category: row.category == null ? null : String(row.category),
          },
          mapParams
        )
      )
    }
    return rows
  }

  const search = String(params.search ?? '').trim()
  const amountFilterRaw = String(params.amountSearch ?? '').trim()
  const amountFromFilter = amountFilterRaw ? parseCashSearchAmount(amountFilterRaw) : null
  const amountFromSearch = search ? parseCashSearchAmount(search) : null
  const effectiveAmount =
    amountFromFilter ??
    (amountFromSearch != null && isCashSearchAmountOnly(search, amountFromSearch)
      ? amountFromSearch
      : null)

  if (effectiveAmount != null) {
    const skipDateRange =
      amountFromFilter != null ||
      (amountFromSearch != null && isCashSearchAmountOnly(search, amountFromSearch))
    const raw = await fetchCashWithdrawalsByAmountSearch(supabase, effectiveAmount, limit * 4)
    let filtered = filterRawCashPickerRows(raw, {
      category: params.category ?? null,
      ...(skipDateRange
        ? {}
        : {
            ...(params.startDateYmd ? { startDateYmd: params.startDateYmd } : {}),
            ...(params.endDateYmd ? { endDateYmd: params.endDateYmd } : {}),
          }),
      limit,
    })
    if (search && !isCashSearchAmountOnly(search, effectiveAmount)) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          String(r.description ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.category ?? '')
            .toLowerCase()
            .includes(q)
      )
    }
    return mapRawRows(filtered)
  }

  let q = supabase
    .from('cash_transactions')
    .select('id,transaction_date,transaction_type,amount,description,category,notes')
    .eq('transaction_type', 'withdrawal')
    .order('transaction_date', { ascending: false })
    .limit(limit)

  if (params.startDateYmd) {
    q = q.gte('transaction_date', `${params.startDateYmd}T00:00:00.000Z`)
  }
  if (params.endDateYmd) {
    q = q.lte('transaction_date', `${params.endDateYmd}T23:59:59.999Z`)
  }
  if (params.category) {
    q = q.eq('category', params.category)
  }

  if (search) {
    const innerQuoted = search.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const orParts = [
      `description.ilike."%${innerQuoted}%"`,
      `category.ilike."%${innerQuoted}%"`,
      `notes.ilike."%${innerQuoted}%"`,
    ]
    if (/^\d{4}-\d{2}-\d{2}$/.test(search)) {
      orParts.push(`and(transaction_date.gte.${search}T00:00:00.000Z,transaction_date.lte.${search}T23:59:59.999Z)`)
    }
    if (/^[a-f0-9-]{6,}$/i.test(search.replace(/\s/g, ''))) {
      orParts.push(`id.ilike."%${innerQuoted}%"`)
    }
    q = q.or(orParts.join(','))
  }

  const { data, error } = await q
  if (error) throw error

  return mapRawRows((data ?? []) as RawCashSearchRow[])
}

/** 여러 지출 원장을 하나의 현금 출금에 일괄 연결 */
export async function linkExpensesToCashTransaction(
  supabase: SupabaseClient,
  params: {
    actorEmail: string
    cashTransactionId: string
    cashAmount: number
    items: {
      expenseSourceTable: ExpenseReconSourceTable
      expenseSourceId: string
      expenseAmount: number
    }[]
  }
): Promise<{ linked: number; skippedAlreadyLinked: number }> {
  const { actorEmail, cashTransactionId, cashAmount, items } = params
  if (!cashTransactionId || items.length === 0) {
    return { linked: 0, skippedAlreadyLinked: 0 }
  }

  const linkedKeys = await fetchLinkedExpenseKeysForCash(supabase, cashTransactionId)
  const absCash = Math.abs(cashAmount)
  let allocated = 0
  for (const key of linkedKeys) {
    const parsed = parseExpenseCashLinkRowKey(key)
    if (!parsed) continue
    const raw = await fetchExpenseRowByKey(supabase, parsed.sourceTable, parsed.sourceId)
    if (raw) allocated += raw.amount
  }

  let linked = 0
  let skippedAlreadyLinked = 0
  const allocTol = Math.max(0.5, absCash * 0.001)

  for (const item of items) {
    const key = expenseCashLinkRowKey(item.expenseSourceTable, item.expenseSourceId)
    if (linkedKeys.has(key)) {
      skippedAlreadyLinked += 1
      continue
    }
    const expenseAbs = Math.abs(item.expenseAmount)
    const remaining = absCash - allocated
    if (remaining <= allocTol) {
      throw new Error(
        `현금 출금 금액($${absCash.toFixed(2)})에 더 이상 배정할 여유가 없습니다. (이미 연결된 지출 합계: $${allocated.toFixed(2)})`
      )
    }
    const matchedAmount = Math.min(expenseAbs, remaining)
    await replaceExpenseCashLedgerMatch(supabase, {
      actorEmail,
      expenseSourceTable: item.expenseSourceTable,
      expenseSourceId: item.expenseSourceId,
      cashTransactionId,
      matchedAmount,
    })
    linkedKeys.add(key)
    allocated += matchedAmount
    linked += 1
  }

  return { linked, skippedAlreadyLinked }
}

export async function replaceExpenseCashLedgerMatch(
  supabase: SupabaseClient,
  params: {
    actorEmail: string
    expenseSourceTable: ExpenseReconSourceTable
    expenseSourceId: string
    cashTransactionId: string
    matchedAmount?: number | null
  }
): Promise<void> {
  const { actorEmail, expenseSourceTable, expenseSourceId, cashTransactionId } = params
  if (!expenseSourceSupportsCashLedgerLink(expenseSourceTable)) {
    throw new Error('이 원장 유형은 현금 지출 대조를 지원하지 않습니다.')
  }

  const { error: delErr } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .delete()
    .eq('expense_source_table', expenseSourceTable)
    .eq('expense_source_id', expenseSourceId)
  if (delErr) {
    assertExpenseCashLedgerMatchesTableAvailable(delErr)
    throw delErr
  }

  const matchedAmount =
    params.matchedAmount != null && Number.isFinite(Number(params.matchedAmount))
      ? Math.abs(Number(params.matchedAmount))
      : null

  const { error: insErr } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE).insert({
    expense_source_table: expenseSourceTable,
    expense_source_id: expenseSourceId,
    cash_transaction_id: cashTransactionId,
    matched_amount: matchedAmount,
    matched_by: actorEmail || null,
  })
  if (insErr) {
    assertExpenseCashLedgerMatchesTableAvailable(insErr)
    throw insErr
  }
}

export async function unlinkExpenseCashLedgerMatches(
  supabase: SupabaseClient,
  expenseSourceTable: ExpenseReconSourceTable,
  expenseSourceId: string
): Promise<void> {
  const { error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .delete()
    .eq('expense_source_table', expenseSourceTable)
    .eq('expense_source_id', expenseSourceId)
  if (error) {
    assertExpenseCashLedgerMatchesTableAvailable(error)
    throw error
  }
}

export async function fetchCashLedgerMatchedCashTransactionIds(
  supabase: SupabaseClient,
  cashTransactionIds: string[]
): Promise<Set<string>> {
  const ids = cashTransactionIds.filter(Boolean)
  if (ids.length === 0 || expenseCashLedgerMatchesTableUnavailable) return new Set()
  const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .select('cash_transaction_id')
    .in('cash_transaction_id', ids)
  if (error) {
    markExpenseCashLedgerMatchesTableUnavailable(error)
    return new Set()
  }
  return new Set(
    ((data ?? []) as { cash_transaction_id?: string }[])
      .map((r) => String(r.cash_transaction_id ?? '').trim())
      .filter(Boolean)
  )
}

export async function fetchCashLedgerMatchedCashTransactionIdsBatched(
  supabase: SupabaseClient,
  cashTransactionIds: string[],
  chunkSize = 200
): Promise<Set<string>> {
  const ids = [...new Set(cashTransactionIds.filter(Boolean))]
  if (ids.length === 0) return new Set()
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const s = await fetchCashLedgerMatchedCashTransactionIds(supabase, chunk)
    s.forEach((id) => out.add(id))
  }
  return out
}

type RawExpenseCandidate = Omit<
  SimilarExpenseForCashRow,
  'amount_diff' | 'day_diff' | 'score' | 'linked_to_this_cash' | 'external_links'
>

function mapExpenseCandidate(
  row: RawExpenseCandidate,
  params: {
    dateYmd: string
    absCash: number
    linkedKeys: Set<string>
    cashTransactionId: string
    targetAmount?: number | null
  }
): SimilarExpenseForCashRow {
  const amountDiff =
    params.targetAmount != null && params.targetAmount > 0
      ? Math.abs(row.amount - params.targetAmount)
      : params.absCash > 0
        ? Math.abs(row.amount - params.absCash)
        : 0
  const dayDiff = params.dateYmd ? dayDiffFromYmd(row.submit_date, params.dateYmd) : 0
  const exactBonus = amountDiff < 0.02 ? 40 : 0
  const linked = params.linkedKeys.has(row.key)
  return {
    ...row,
    amount_diff: amountDiff,
    day_diff: dayDiff,
    score: 100 + exactBonus - amountDiff * 10 - dayDiff * 4 + (linked ? 500 : 0),
    linked_to_this_cash: linked,
    external_links: [],
  }
}

function sortExpenseCandidates(rows: SimilarExpenseForCashRow[]): SimilarExpenseForCashRow[] {
  return [...rows].sort((a, b) => {
    if (a.linked_to_this_cash !== b.linked_to_this_cash) {
      return a.linked_to_this_cash ? -1 : 1
    }
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    if (a.day_diff !== b.day_diff) return a.day_diff - b.day_diff
    return b.score - a.score
  })
}

async function fetchLinkedExpenseKeysForCash(
  supabase: SupabaseClient,
  cashTransactionId: string
): Promise<Set<string>> {
  if (expenseCashLedgerMatchesTableUnavailable) return new Set()
  const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .select('expense_source_table, expense_source_id')
    .eq('cash_transaction_id', cashTransactionId)
  if (error) {
    markExpenseCashLedgerMatchesTableUnavailable(error)
    return new Set()
  }
  return new Set(
    ((data ?? []) as { expense_source_table?: string; expense_source_id?: string }[])
      .map((r) =>
        expenseCashLinkRowKey(String(r.expense_source_table ?? ''), String(r.expense_source_id ?? ''))
      )
      .filter((k) => k.includes(':') && !k.endsWith(':'))
  )
}

async function fetchExpenseRowByKey(
  supabase: SupabaseClient,
  sourceTable: ExpenseCashLinkSourceTable,
  sourceId: string
): Promise<RawExpenseCandidate | null> {
  switch (sourceTable) {
    case 'company_expenses': {
      const { data } = await supabase
        .from('company_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,description,notes,submit_by')
        .eq('id', sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        key: expenseCashLinkRowKey(sourceTable, sourceId),
        source_table: sourceTable,
        source_id: sourceId,
        submit_date: ymdFromTimestamp(String(data.submit_on ?? '')),
        amount: Math.abs(Number(data.amount ?? 0)),
        paid_to: data.paid_to ?? null,
        paid_for: data.paid_for ?? null,
        detail: data.description ?? data.notes ?? null,
        submitter_email: submitterEmailFromExpenseRow(sourceTable, data as Record<string, unknown>),
      }
    }
    case 'tour_expenses': {
      const { data } = await supabase
        .from('tour_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,note,tour_date,submitted_by')
        .eq('id', sourceId)
        .maybeSingle()
      if (!data) return null
      const submitDate = ymdFromTimestamp(String(data.submit_on ?? data.tour_date ?? ''))
      return {
        key: expenseCashLinkRowKey(sourceTable, sourceId),
        source_table: sourceTable,
        source_id: sourceId,
        submit_date: submitDate,
        amount: Math.abs(Number(data.amount ?? 0)),
        paid_to: data.paid_to ?? null,
        paid_for: data.paid_for ?? null,
        detail: data.note ?? null,
        submitter_email: submitterEmailFromExpenseRow(sourceTable, data as Record<string, unknown>),
      }
    }
    case 'reservation_expenses': {
      const { data } = await supabase
        .from('reservation_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,note,submitted_by')
        .eq('id', sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        key: expenseCashLinkRowKey(sourceTable, sourceId),
        source_table: sourceTable,
        source_id: sourceId,
        submit_date: ymdFromTimestamp(String(data.submit_on ?? '')),
        amount: Math.abs(Number(data.amount ?? 0)),
        paid_to: data.paid_to ?? null,
        paid_for: data.paid_for ?? null,
        detail: data.note ?? null,
        submitter_email: submitterEmailFromExpenseRow(sourceTable, data as Record<string, unknown>),
      }
    }
    case 'ticket_bookings': {
      const { data } = await supabase
        .from('ticket_bookings')
        .select('id,submit_on,check_in_date,expense,company,category,note,submitted_by')
        .eq('id', sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        key: expenseCashLinkRowKey(sourceTable, sourceId),
        source_table: sourceTable,
        source_id: sourceId,
        submit_date: ymdFromTimestamp(String(data.submit_on ?? data.check_in_date ?? '')),
        amount: Math.abs(Number(data.expense ?? 0)),
        paid_to: data.company ?? null,
        paid_for: data.category ?? null,
        detail: data.note ?? null,
        submitter_email: submitterEmailFromExpenseRow(sourceTable, data as Record<string, unknown>),
      }
    }
    case 'tour_hotel_bookings': {
      const { data } = await supabase
        .from('tour_hotel_bookings')
        .select('id,check_in_date,total_price,hotel,reservation_name,city,submitted_by')
        .eq('id', sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        key: expenseCashLinkRowKey(sourceTable, sourceId),
        source_table: sourceTable,
        source_id: sourceId,
        submit_date: ymdFromTimestamp(String(data.check_in_date ?? '')),
        amount: Math.abs(Number(data.total_price ?? 0)),
        paid_to: data.hotel ?? null,
        paid_for: data.reservation_name ?? data.city ?? null,
        detail: data.city ?? null,
        submitter_email: submitterEmailFromExpenseRow(sourceTable, data as Record<string, unknown>),
      }
    }
    default:
      return null
  }
}

export async function fetchLinkedExpensesForCashTransaction(
  supabase: SupabaseClient,
  cashTransactionId: string
): Promise<SimilarExpenseForCashRow[]> {
  const linkedKeys = await fetchLinkedExpenseKeysForCash(supabase, cashTransactionId)
  if (linkedKeys.size === 0) return []
  const rows: SimilarExpenseForCashRow[] = []
  for (const key of linkedKeys) {
    const parsed = parseExpenseCashLinkRowKey(key)
    if (!parsed) continue
    const raw = await fetchExpenseRowByKey(supabase, parsed.sourceTable, parsed.sourceId)
    if (!raw) continue
    rows.push({
      ...raw,
      amount_diff: 0,
      day_diff: 0,
      score: 1000,
      linked_to_this_cash: true,
      external_links: [],
    })
  }
  return sortExpenseCandidates(rows)
}

async function queryExpenseCandidatesFromTable(
  supabase: SupabaseClient,
  sourceTable: ExpenseCashLinkSourceTable,
  params: {
    dateYmd: string
    absCash: number
    tol: number
    matchMode: 'dateProximity' | 'amountOnly'
    limit: number
  }
): Promise<RawExpenseCandidate[]> {
  const dayWindow = RECON_EXPENSE_LEDGER_DAY_WINDOW
  const startIso =
    params.matchMode === 'dateProximity' && params.dateYmd
      ? `${addCalendarDaysYmd(params.dateYmd, -dayWindow)}T00:00:00.000Z`
      : null
  const endIso =
    params.matchMode === 'dateProximity' && params.dateYmd
      ? `${addCalendarDaysYmd(params.dateYmd, dayWindow)}T23:59:59.999Z`
      : null

  const out: RawExpenseCandidate[] = []

  const pushIfQualifies = (row: RawExpenseCandidate) => {
    if (row.amount <= 0) return
    if (!lineQualifiesForExpense(row.amount, params.absCash, params.tol)) return
    out.push(row)
  }

  switch (sourceTable) {
    case 'company_expenses': {
      let q = supabase
        .from('company_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,description,notes,submit_by')
        .order('submit_on', { ascending: false })
        .limit(params.limit)
      if (startIso && endIso) q = q.gte('submit_on', startIso).lte('submit_on', endIso)
      const { data, error } = await q
      if (error) throw error
      for (const row of data ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        pushIfQualifies({
          key: expenseCashLinkRowKey(sourceTable, id),
          source_table: sourceTable,
          source_id: id,
          submit_date: ymdFromTimestamp(String(row.submit_on ?? '')),
          amount: Math.abs(Number(row.amount ?? 0)),
          paid_to: row.paid_to ?? null,
          paid_for: row.paid_for ?? null,
          detail: row.description ?? row.notes ?? null,
          submitter_email: submitterEmailFromExpenseRow(sourceTable, row as Record<string, unknown>),
        })
      }
      break
    }
    case 'tour_expenses': {
      let q = supabase
        .from('tour_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,note,tour_date,submitted_by')
        .order('submit_on', { ascending: false })
        .limit(params.limit)
      if (startIso && endIso) q = q.gte('submit_on', startIso).lte('submit_on', endIso)
      const { data, error } = await q
      if (error) throw error
      for (const row of data ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        pushIfQualifies({
          key: expenseCashLinkRowKey(sourceTable, id),
          source_table: sourceTable,
          source_id: id,
          submit_date: ymdFromTimestamp(String(row.submit_on ?? row.tour_date ?? '')),
          amount: Math.abs(Number(row.amount ?? 0)),
          paid_to: row.paid_to ?? null,
          paid_for: row.paid_for ?? null,
          detail: row.note ?? null,
          submitter_email: submitterEmailFromExpenseRow(sourceTable, row as Record<string, unknown>),
        })
      }
      break
    }
    case 'reservation_expenses': {
      let q = supabase
        .from('reservation_expenses')
        .select('id,submit_on,amount,paid_to,paid_for,note,submitted_by')
        .order('submit_on', { ascending: false })
        .limit(params.limit)
      if (startIso && endIso) q = q.gte('submit_on', startIso).lte('submit_on', endIso)
      const { data, error } = await q
      if (error) throw error
      for (const row of data ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        pushIfQualifies({
          key: expenseCashLinkRowKey(sourceTable, id),
          source_table: sourceTable,
          source_id: id,
          submit_date: ymdFromTimestamp(String(row.submit_on ?? '')),
          amount: Math.abs(Number(row.amount ?? 0)),
          paid_to: row.paid_to ?? null,
          paid_for: row.paid_for ?? null,
          detail: row.note ?? null,
          submitter_email: submitterEmailFromExpenseRow(sourceTable, row as Record<string, unknown>),
        })
      }
      break
    }
    case 'ticket_bookings': {
      let q = supabase
        .from('ticket_bookings')
        .select('id,submit_on,check_in_date,expense,company,category,note,submitted_by')
        .order('submit_on', { ascending: false })
        .limit(params.limit)
      if (startIso && endIso) {
        q = q
          .gte('check_in_date', startIso.slice(0, 10))
          .lte('check_in_date', endIso.slice(0, 10))
      }
      const { data, error } = await q
      if (error) throw error
      for (const row of data ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        pushIfQualifies({
          key: expenseCashLinkRowKey(sourceTable, id),
          source_table: sourceTable,
          source_id: id,
          submit_date: ymdFromTimestamp(String(row.submit_on ?? row.check_in_date ?? '')),
          amount: Math.abs(Number(row.expense ?? 0)),
          paid_to: row.company ?? null,
          paid_for: row.category ?? null,
          detail: row.note ?? null,
          submitter_email: submitterEmailFromExpenseRow(sourceTable, row as Record<string, unknown>),
        })
      }
      break
    }
    case 'tour_hotel_bookings': {
      let q = supabase
        .from('tour_hotel_bookings')
        .select('id,check_in_date,total_price,hotel,reservation_name,city,submitted_by')
        .order('check_in_date', { ascending: false })
        .limit(params.limit)
      if (startIso && endIso) {
        q = q.gte('check_in_date', startIso.slice(0, 10)).lte('check_in_date', endIso.slice(0, 10))
      }
      const { data, error } = await q
      if (error) throw error
      for (const row of data ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        pushIfQualifies({
          key: expenseCashLinkRowKey(sourceTable, id),
          source_table: sourceTable,
          source_id: id,
          submit_date: ymdFromTimestamp(String(row.check_in_date ?? '')),
          amount: Math.abs(Number(row.total_price ?? 0)),
          paid_to: row.hotel ?? null,
          paid_for: row.reservation_name ?? row.city ?? null,
          detail: row.city ?? null,
          submitter_email: submitterEmailFromExpenseRow(sourceTable, row as Record<string, unknown>),
        })
      }
      break
    }
  }

  return out
}

export async function fetchSimilarExpensesForCashTransaction(
  supabase: SupabaseClient,
  params: {
    cashTransactionId: string
    dateYmd: string
    amount: number
    limit?: number
    matchMode?: 'dateProximity' | 'amountOnly'
    linkedExpenseKeys?: Set<string>
  }
): Promise<SimilarExpenseForCashRow[]> {
  const {
    cashTransactionId,
    dateYmd,
    amount,
    limit = 80,
    matchMode = 'dateProximity',
    linkedExpenseKeys = new Set<string>(),
  } = params
  if (!cashTransactionId) return []

  const absCash = Math.abs(amount)
  const tol = expenseReconciliationAmountTolerance(absCash)
  const linkedKeys = new Set(linkedExpenseKeys)
  const perTableLimit = Math.min(Math.ceil(limit / EXPENSE_CASH_LINK_SOURCE_TABLES.size) + 20, 200)

  const tableList = [...EXPENSE_CASH_LINK_SOURCE_TABLES] as ExpenseCashLinkSourceTable[]
  const rawChunks = await Promise.all(
    tableList.map((table) =>
      queryExpenseCandidatesFromTable(supabase, table, {
        dateYmd,
        absCash,
        tol,
        matchMode,
        limit: perTableLimit,
      })
    )
  )

  const seen = new Set<string>()
  const candidates: SimilarExpenseForCashRow[] = []
  for (const chunk of rawChunks) {
    for (const row of chunk) {
      if (seen.has(row.key)) continue
      seen.add(row.key)
      candidates.push(
        mapExpenseCandidate(row, {
          dateYmd,
          absCash,
          linkedKeys,
          cashTransactionId,
        })
      )
    }
  }

  for (const key of linkedKeys) {
    if (seen.has(key)) continue
    const parsed = parseExpenseCashLinkRowKey(key)
    if (!parsed) continue
    const raw = await fetchExpenseRowByKey(supabase, parsed.sourceTable, parsed.sourceId)
    if (!raw) continue
    seen.add(key)
    candidates.push(
      mapExpenseCandidate(raw, {
        dateYmd,
        absCash,
        linkedKeys,
        cashTransactionId,
      })
    )
  }

  return sortExpenseCandidates(candidates).slice(0, limit)
}

function sanitizeExpenseSearchQuery(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\x00-\x1f]/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .slice(0, 100)
}

export async function searchExpensesForCashTransaction(
  supabase: SupabaseClient,
  params: {
    query: string
    cashTransactionId: string
    dateYmd?: string
    cashAmount?: number
    limit?: number
    linkedExpenseKeys?: Set<string>
  }
): Promise<SimilarExpenseForCashRow[]> {
  const rawQuery = String(params.query ?? '').trim()
  const q = sanitizeExpenseSearchQuery(rawQuery)
  if (!q && !rawQuery) return []

  const limit = params.limit ?? 120
  const linkedKeys = params.linkedExpenseKeys ?? new Set<string>()
  const dateYmd = params.dateYmd?.slice(0, 10) ?? ''
  const absCash = Math.abs(Number(params.cashAmount ?? 0))
  const parsedAmount = parseCashSearchAmount(rawQuery)
  const mapParams = {
    dateYmd,
    absCash,
    linkedKeys,
    cashTransactionId: params.cashTransactionId,
    targetAmount: parsedAmount,
  }

  const seen = new Set<string>()
  const candidates: SimilarExpenseForCashRow[] = []
  const pushRow = (row: RawExpenseCandidate) => {
    if (seen.has(row.key)) return
    seen.add(row.key)
    candidates.push(mapExpenseCandidate(row, mapParams))
  }

  const tables = [...EXPENSE_CASH_LINK_SOURCE_TABLES] as ExpenseCashLinkSourceTable[]

  if (parsedAmount != null) {
    const tol = cashSearchAmountTolerance(parsedAmount)
    for (const table of tables) {
      const rows = await queryExpenseCandidatesFromTable(supabase, table, {
        dateYmd: '',
        absCash: parsedAmount,
        tol,
        matchMode: 'amountOnly',
        limit: limit,
      })
      for (const row of rows) {
        if (Math.abs(row.amount - parsedAmount) <= tol) pushRow(row)
      }
    }
  }

  const textQ = q.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  if (textQ && (!parsedAmount || textQ.replace(/\s/g, '') !== String(parsedAmount))) {
    const innerQuoted = textQ.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    for (const table of tables) {
      let select = ''
      let orParts: string[] = []
      switch (table) {
        case 'company_expenses':
          select = 'id,submit_on,amount,paid_to,paid_for,description,notes,submit_by'
          orParts = [
            `paid_to.ilike."%${innerQuoted}%"`,
            `paid_for.ilike."%${innerQuoted}%"`,
            `description.ilike."%${innerQuoted}%"`,
            `notes.ilike."%${innerQuoted}%"`,
          ]
          break
        case 'tour_expenses':
          select = 'id,submit_on,amount,paid_to,paid_for,note,tour_date,submitted_by'
          orParts = [
            `paid_to.ilike."%${innerQuoted}%"`,
            `paid_for.ilike."%${innerQuoted}%"`,
            `note.ilike."%${innerQuoted}%"`,
          ]
          break
        case 'reservation_expenses':
          select = 'id,submit_on,amount,paid_to,paid_for,note,submitted_by'
          orParts = [
            `paid_to.ilike."%${innerQuoted}%"`,
            `paid_for.ilike."%${innerQuoted}%"`,
            `note.ilike."%${innerQuoted}%"`,
          ]
          break
        case 'ticket_bookings':
          select = 'id,submit_on,check_in_date,expense,company,category,note,submitted_by'
          orParts = [
            `company.ilike."%${innerQuoted}%"`,
            `category.ilike."%${innerQuoted}%"`,
            `note.ilike."%${innerQuoted}%"`,
          ]
          break
        case 'tour_hotel_bookings':
          select = 'id,check_in_date,total_price,hotel,reservation_name,city,submitted_by'
          orParts = [
            `hotel.ilike."%${innerQuoted}%"`,
            `reservation_name.ilike."%${innerQuoted}%"`,
            `city.ilike."%${innerQuoted}%"`,
          ]
          break
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(textQ)) {
        if (table === 'tour_hotel_bookings') {
          orParts.push(`check_in_date.eq.${textQ}`)
        } else if (table === 'ticket_bookings') {
          orParts.push(`check_in_date.eq.${textQ}`, `submit_on.gte.${textQ}T00:00:00.000Z,submit_on.lte.${textQ}T23:59:59.999Z`)
        } else {
          orParts.push(`submit_on.gte.${textQ}T00:00:00.000Z`, `submit_on.lte.${textQ}T23:59:59.999Z`)
        }
      }
      if (/^[a-f0-9-]{6,}$/i.test(textQ.replace(/\s/g, ''))) {
        orParts.push(`id.ilike."%${innerQuoted}%"`)
      }
      if (!select || orParts.length === 0) continue

      const { data, error } = await supabase
        .from(table)
        .select(select)
        .or(orParts.join(','))
        .order(table === 'tour_hotel_bookings' ? 'check_in_date' : 'submit_on', { ascending: false })
        .limit(Math.min(limit, 80))
      if (error) throw error

      for (const row of data ?? []) {
        const id = String((row as { id?: string }).id ?? '')
        if (!id) continue
        const raw = await fetchExpenseRowByKey(supabase, table, id)
        if (raw) pushRow(raw)
      }
    }
  }

  return sortExpenseCandidates(candidates).slice(0, limit)
}

export async function unlinkExpenseCashLedgerMatchesForCash(
  supabase: SupabaseClient,
  cashTransactionId: string,
  expenseSourceTable?: ExpenseReconSourceTable,
  expenseSourceId?: string
): Promise<void> {
  let q = fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
    .delete()
    .eq('cash_transaction_id', cashTransactionId)
  if (expenseSourceTable && expenseSourceId) {
    q = q.eq('expense_source_table', expenseSourceTable).eq('expense_source_id', expenseSourceId)
  }
  const { error } = await q
  if (error) {
    assertExpenseCashLedgerMatchesTableAvailable(error)
    throw error
  }
}

type StatementLineSummary = {
  id: string
  posted_date: string
  amount: number
  label: string
  account_name: string | null
}

type CashTxSummary = {
  id: string
  date: string
  amount: number
  label: string
}

async function fetchStatementLineSummariesByIds(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<Map<string, StatementLineSummary>> {
  const ids = [...new Set(lineIds.filter(Boolean))]
  const out = new Map<string, StatementLineSummary>()
  if (ids.length === 0) return out

  type LineRow = {
    id: string
    posted_date: string | null
    amount: number | string | null
    description: string | null
    merchant: string | null
    statement_import_id: string | null
  }
  const lineById = new Map<string, LineRow>()
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const { data, error } = await supabase
      .from('statement_lines')
      .select('id, posted_date, amount, description, merchant, statement_import_id')
      .in('id', chunk)
    if (error) throw error
    for (const line of (data ?? []) as LineRow[]) {
      if (line.id) lineById.set(line.id, line)
    }
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
    for (const im of (data ?? []) as { id: string; financial_account_id: string | null }[]) {
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
    for (const a of (data ?? []) as { id: string; name: string | null }[]) {
      if (a.id) accountNameById.set(a.id, String(a.name ?? '').trim() || a.id)
    }
  }

  for (const [id, line] of lineById) {
    const importId = String(line.statement_import_id ?? '').trim()
    const accountId = importToAccount.get(importId) ?? ''
    out.set(id, {
      id,
      posted_date: ymdFromTimestamp(String(line.posted_date ?? '')),
      amount: Math.abs(Number(line.amount ?? 0)),
      label: formatStatementLineDescription(line.description, line.merchant),
      account_name: accountId ? accountNameById.get(accountId) ?? null : null,
    })
  }
  return out
}

async function fetchCashTransactionSummariesByIds(
  supabase: SupabaseClient,
  cashIds: string[]
): Promise<Map<string, CashTxSummary>> {
  const ids = [...new Set(cashIds.filter(Boolean))]
  const out = new Map<string, CashTxSummary>()
  if (ids.length === 0) return out

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('id, transaction_date, amount, description, category')
      .in('id', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      const id = String(row.id ?? '')
      if (!id) continue
      out.set(id, {
        id,
        date: ymdFromTimestamp(String(row.transaction_date ?? '')),
        amount: Math.abs(Number(row.amount ?? 0)),
        label: String(row.description ?? '').trim() || String(row.category ?? '').trim() || '—',
      })
    }
  }
  return out
}

/** 지출 후보 — 은행 명세·다른 현금 출금 연결 정보 부착 */
export async function attachExternalLinksToExpenseForCashRows(
  supabase: SupabaseClient,
  rows: SimilarExpenseForCashRow[],
  currentCashTransactionId: string
): Promise<SimilarExpenseForCashRow[]> {
  if (rows.length === 0) return rows

  const byTable = new Map<ExpenseCashLinkSourceTable, string[]>()
  for (const r of rows) {
    const arr = byTable.get(r.source_table) ?? []
    arr.push(r.source_id)
    byTable.set(r.source_table, arr)
  }

  const stmtLineIdsByExpenseKey = new Map<string, Set<string>>()
  const cashIdsByExpenseKey = new Map<string, Set<string>>()

  const addStmtLine = (expenseKey: string, lineId: string) => {
    const lid = lineId.trim()
    if (!lid) return
    const set = stmtLineIdsByExpenseKey.get(expenseKey) ?? new Set<string>()
    set.add(lid)
    stmtLineIdsByExpenseKey.set(expenseKey, set)
  }

  const addCashId = (expenseKey: string, cashId: string) => {
    const cid = cashId.trim()
    if (!cid) return
    const set = cashIdsByExpenseKey.get(expenseKey) ?? new Set<string>()
    set.add(cid)
    cashIdsByExpenseKey.set(expenseKey, set)
  }

  for (const [table, ids] of byTable) {
    const unique = [...new Set(ids.filter(Boolean))]
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200)
      const { data, error } = await supabase
        .from('reconciliation_matches')
        .select('source_id, statement_line_id')
        .eq('source_table', table)
        .in('source_id', chunk)
      if (error) throw error
      for (const row of (data ?? []) as { source_id?: string; statement_line_id?: string }[]) {
        const sid = String(row.source_id ?? '').trim()
        const lid = String(row.statement_line_id ?? '').trim()
        if (!sid || !lid) continue
        addStmtLine(expenseCashLinkRowKey(table, sid), lid)
      }
    }
  }

  for (const table of EXPENSE_TABLES_WITH_LEGACY_STATEMENT_LINE_ID) {
    const ids = byTable.get(table)
    if (!ids?.length) continue
    const unique = [...new Set(ids.filter(Boolean))]
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200)
      const { data, error } = await supabase
        .from(table)
        .select('id, statement_line_id')
        .in('id', chunk)
        .not('statement_line_id', 'is', null)
      if (error) throw error
      for (const row of (data ?? []) as { id?: string; statement_line_id?: string | null }[]) {
        const sid = String(row.id ?? '').trim()
        const lid = String(row.statement_line_id ?? '').trim()
        if (!sid || !lid) continue
        addStmtLine(expenseCashLinkRowKey(table, sid), lid)
      }
    }
  }

  if (!expenseCashLedgerMatchesTableUnavailable) {
    for (const [table, ids] of byTable) {
      const unique = [...new Set(ids.filter(Boolean))]
      for (let i = 0; i < unique.length; i += 200) {
        const chunk = unique.slice(i, i + 200)
        const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE)
          .select('expense_source_id, cash_transaction_id')
          .eq('expense_source_table', table)
          .in('expense_source_id', chunk)
        if (error) {
          markExpenseCashLedgerMatchesTableUnavailable(error)
          break
        }
        for (const row of (data ?? []) as {
          expense_source_id?: string
          cash_transaction_id?: string
        }[]) {
          const sid = String(row.expense_source_id ?? '').trim()
          const cid = String(row.cash_transaction_id ?? '').trim()
          if (!sid || !cid) continue
          addCashId(expenseCashLinkRowKey(table, sid), cid)
        }
      }
    }
  }

  const allLineIds = [...new Set([...stmtLineIdsByExpenseKey.values()].flatMap((s) => [...s]))]
  const allCashIds = [...new Set([...cashIdsByExpenseKey.values()].flatMap((s) => [...s]))]

  const [lineSummaries, cashSummaries] = await Promise.all([
    fetchStatementLineSummariesByIds(supabase, allLineIds),
    fetchCashTransactionSummariesByIds(supabase, allCashIds),
  ])

  return rows.map((row) => {
    const links: ExpenseForCashExternalLink[] = []
    const stmtIds = stmtLineIdsByExpenseKey.get(row.key)
    if (stmtIds) {
      for (const lid of stmtIds) {
        const s = lineSummaries.get(lid)
        links.push({
          kind: 'statement',
          ref_id: lid,
          date: s?.posted_date ?? '—',
          amount: s?.amount ?? 0,
          label: s?.label ?? lid.slice(0, 8) + '…',
          account_name: s?.account_name ?? null,
          is_current_cash: false,
        })
      }
    }
    const cashIds = cashIdsByExpenseKey.get(row.key)
    if (cashIds) {
      for (const cid of cashIds) {
        const c = cashSummaries.get(cid)
        links.push({
          kind: 'cash',
          ref_id: cid,
          date: c?.date ?? '—',
          amount: c?.amount ?? 0,
          label: c?.label ?? cid.slice(0, 8) + '…',
          account_name: null,
          is_current_cash: cid === currentCashTransactionId,
        })
      }
    }
    links.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'statement' ? -1 : 1
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return 0
    })
    return { ...row, external_links: links }
  })
}
