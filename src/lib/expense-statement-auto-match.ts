import type { SupabaseClient } from '@supabase/supabase-js'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import { extractPaymentMethodCardLabel } from '@/lib/paymentMethodDisplay'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  expenseReconciliationAmountTolerance,
  replaceExpenseReconciliationMatch,
  type ExpenseReconSourceTable,
} from '@/lib/expense-reconciliation-similar-lines'
import {
  expenseSourceSupportsCashLedgerLink,
  replaceExpenseCashLedgerMatch,
} from '@/lib/expense-cash-ledger-match'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

/** 자동 매칭 — 날짜는 후보 제외에 쓰지 않음(점수·정렬만). UI·번역 호환용 */
export const EXPENSE_STATEMENT_AUTO_MATCH_DAY_WINDOW = 0
/** 합산 매칭: 같은 가맹점 그룹 — 날짜 제한 없음(금액만). UI·번역 호환용 */
export const EXPENSE_STATEMENT_AGGREGATE_MAX_DAY_SPAN = 0
/** 한 번에 자동 매칭 미리보기를 만들 지출 상한 */
export const EXPENSE_STATEMENT_AUTO_MATCH_MAX_EXPENSES = 2500
/** 지출당 표시할 후보 수 */
export const EXPENSE_STATEMENT_AUTO_MATCH_CANDIDATE_LIMIT = 8
/** 미리보기 «고신뢰도만 선택» 기준 점수(금액 정확·계정·가맹점 일치) */
export const EXPENSE_STATEMENT_AUTO_MATCH_HIGH_CONFIDENCE_SCORE = 95
/** 합산 후보 — 한 그룹에서 묶을 최대 줄 수 */
const AGGREGATE_MAX_LINES_PER_COMBO = 6
/** 금액 «정확 일치» 부동소수 허용 */
const AMOUNT_EQUAL_EPS = 0.02
const ACCOUNT_MATCH_BONUS = 16
const ACCOUNT_MISMATCH_PENALTY = 12
const TEXT_BONUS_MAX = 12
const VENDOR_SUBSTRING_BONUS = 12
const PAYMENT_METHOD_TEXT_BONUS_MAX = 10
const PAYMENT_METHOD_CASH_SOURCE_BONUS = 14

function normalizeVendorText(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** 결제처(paid_to) ↔ 명세 가맹점·적요 부분 일치 */
function vendorSubstringBonus(
  paidTo: string,
  merchantLabel: string,
  description: string
): number {
  const vendor = normalizeVendorText(paidTo)
  if (vendor.length < 3) return 0
  const hay = normalizeVendorText(`${merchantLabel} ${description}`)
  if (!hay) return 0
  if (hay.includes(vendor)) return VENDOR_SUBSTRING_BONUS
  const merchant = normalizeVendorText(merchantLabel)
  if (merchant.length >= 3 && vendor.includes(merchant)) return VENDOR_SUBSTRING_BONUS - 2
  return 0
}

/** 결제처·등록 결제처명(paid_to와 유사한 vendor)을 명세 가맹점·적요와 대조 */
function expenseTextMatchBonus(
  line: ExpenseStatementAutoMatchLine,
  paidTo: string,
  paidFor: string,
  vendorAliasTexts: string[]
): number {
  const tokens = lineTokensFromRaw(line.merchant_label, line.description)
  const overlap = textOverlapBonus(tokens, `${paidTo} ${paidFor}`)
  let vendor = vendorSubstringBonus(paidTo, line.merchant_label, line.description)
  for (const alias of vendorAliasTexts) {
    vendor = Math.max(vendor, vendorSubstringBonus(alias, line.merchant_label, line.description))
  }
  return Math.min(TEXT_BONUS_MAX + VENDOR_SUBSTRING_BONUS, overlap + vendor)
}

type PaymentMethodMatchProfile = {
  id: string
  method: string
  method_type: string | null
  display_name: string | null
  financial_account_id: string | null
  financial_account_name: string | null
  card_label: string
  is_cash: boolean
}

type PaymentMethodMatchContext = PaymentMethodMatchProfile | null

function paymentMethodDigitsForMatch(label: string): string[] {
  const digits = String(label ?? '').replace(/\D/g, '')
  const out: string[] = []
  if (digits.length >= 4) out.push(digits.slice(-4))
  if (digits.length >= 6 && digits.length !== 4) out.push(digits.slice(-6))
  return out
}

/** 결제수단 표시명·카드 뒷자리·연결 계정명 ↔ 명세 적요 */
function paymentMethodTextBonus(
  line: ExpenseStatementAutoMatchLine,
  ctx: PaymentMethodMatchContext
): number {
  if (!ctx) return 0
  const hay = normalizeVendorText(`${line.merchant_label} ${line.description} ${line.financial_account_name}`)
  if (!hay) return 0
  let bonus = 0

  const cardLabel = normalizeVendorText(ctx.card_label)
  if (cardLabel.length >= 3 && hay.includes(cardLabel)) {
    bonus = Math.max(bonus, PAYMENT_METHOD_TEXT_BONUS_MAX)
  }

  for (const digits of paymentMethodDigitsForMatch(ctx.card_label)) {
    if (digits.length >= 4 && hay.includes(digits)) {
      bonus = Math.max(bonus, PAYMENT_METHOD_TEXT_BONUS_MAX - 2)
    }
  }

  const faName = normalizeVendorText(ctx.financial_account_name ?? '')
  if (faName.length >= 3 && hay.includes(faName)) {
    bonus = Math.max(bonus, 6)
  }

  const methodNorm = normalizeVendorText(ctx.method)
  if (methodNorm.length >= 4 && hay.includes(methodNorm)) {
    bonus = Math.max(bonus, 5)
  }

  return Math.min(PAYMENT_METHOD_TEXT_BONUS_MAX, bonus)
}

/** 결제수단에 맞지 않는 명세·현금 줄은 후보에서 제외 */
function lineAllowedForPaymentMethod(
  line: ExpenseStatementAutoMatchLine,
  ctx: PaymentMethodMatchContext
): boolean {
  if (!ctx) return true
  if (ctx.is_cash) return line.match_source === 'cash'
  if (ctx.financial_account_id) {
    if (line.match_source === 'cash') return false
    return line.financial_account_id === ctx.financial_account_id
  }
  if (line.match_source === 'cash') return false
  return true
}

function paymentMethodSourceBonus(
  line: ExpenseStatementAutoMatchLine,
  ctx: PaymentMethodMatchContext
): number {
  if (!ctx?.is_cash || line.match_source !== 'cash') return 0
  return PAYMENT_METHOD_CASH_SOURCE_BONUS
}

function vendorAliasTextsForPaidTo(paidTo: string, vendorNames: string[]): string[] {
  const normPaid = normalizeVendorText(paidTo)
  if (normPaid.length < 2) return []
  const out: string[] = []
  for (const name of vendorNames) {
    const norm = normalizeVendorText(name)
    if (norm.length < 2) continue
    if (norm === normPaid || norm.includes(normPaid) || normPaid.includes(norm)) {
      out.push(name)
    }
  }
  return out
}

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
  match_source: 'statement' | 'cash'
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
  match_source: 'statement' | 'cash'
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
    const prefix = line.match_source === 'cash' ? '〔현금〕 ' : ''
    return `${prefix}${line.posted_date} · $${candidate.total_amount.toFixed(2)} · ${line.description}`
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
  const aggregatePenalty = kind === 'aggregate' ? 6 : 0
  const dateTiebreak = Math.min(12, maxDayDiff * 0.15 + maxDaySpan * 0.1)
  const base = Math.max(
    1,
    100 - amountDiff * 2 - aggregatePenalty + exactBonus - dateTiebreak
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

async function loadPaymentMethodMatchProfiles(
  supabase: SupabaseClient
): Promise<{
  byId: Map<string, PaymentMethodMatchProfile>
  byMethodKey: Map<string, PaymentMethodMatchProfile>
  cashValues: Set<string>
}> {
  const cashValues = new Set(await getCashPaymentMethodFilterValues())
  const byId = new Map<string, PaymentMethodMatchProfile>()
  const byMethodKey = new Map<string, PaymentMethodMatchProfile>()

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, method, method_type, display_name, financial_account_id')
  if (error) throw error

  const rows = (data || []) as {
    id: string
    method: string | null
    method_type: string | null
    display_name: string | null
    financial_account_id: string | null
  }[]

  const faIds = [...new Set(rows.map((r) => r.financial_account_id).filter(Boolean) as string[])]
  const faNameById = new Map<string, string>()
  for (let i = 0; i < faIds.length; i += 80) {
    const chunk = faIds.slice(i, i + 80)
    const { data: accs } = await supabase.from('financial_accounts').select('id, name').in('id', chunk)
    for (const a of (accs || []) as { id: string; name: string }[]) {
      faNameById.set(a.id, a.name)
    }
  }

  for (const row of rows) {
    const id = String(row.id ?? '').trim()
    if (!id) continue
    const method = String(row.method ?? '').trim()
    const methodType = row.method_type == null ? null : String(row.method_type).trim()
    const faId = String(row.financial_account_id ?? '').trim() || null
    const isCash =
      methodType === 'cash' ||
      cashValues.has(id) ||
      (method ? cashValues.has(method) : false)
    const profile: PaymentMethodMatchProfile = {
      id,
      method,
      method_type: methodType,
      display_name: row.display_name == null ? null : String(row.display_name),
      financial_account_id: faId,
      financial_account_name: faId ? faNameById.get(faId) ?? null : null,
      card_label: extractPaymentMethodCardLabel(row.display_name, method),
      is_cash: isCash,
    }
    byId.set(id, profile)
    if (method) {
      const prev = byMethodKey.get(method)
      if (!prev || (!prev.financial_account_id && profile.financial_account_id)) {
        byMethodKey.set(method, profile)
      }
    }
  }

  return { byId, byMethodKey, cashValues }
}

function resolvePaymentMethodContext(
  pmValue: string | null | undefined,
  profiles: {
    byId: Map<string, PaymentMethodMatchProfile>
    byMethodKey: Map<string, PaymentMethodMatchProfile>
    cashValues: Set<string>
  }
): PaymentMethodMatchContext {
  const raw = String(pmValue ?? '').trim()
  if (!raw) return null

  const byId = profiles.byId.get(raw)
  if (byId) return byId

  const byMethod = profiles.byMethodKey.get(raw)
  if (byMethod) return byMethod

  if (profiles.cashValues.has(raw)) {
    return {
      id: raw,
      method: raw,
      method_type: 'cash',
      display_name: null,
      financial_account_id: null,
      financial_account_name: null,
      card_label: raw,
      is_cash: true,
    }
  }

  return null
}

async function loadExpenseVendorNames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('expense_vendors').select('name').order('name')
  if (error) {
    console.warn('expense_vendors 조회 실패(자동 매칭 결제처 별칭 생략):', error)
    return []
  }
  return ((data || []) as { name?: string | null }[])
    .map((r) => String(r.name ?? '').trim())
    .filter(Boolean)
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

async function fetchLinkedCashTransactionIds(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches').select(
      'cash_transaction_id'
    )
    if (error) return new Set()
    return new Set(
      ((data || []) as { cash_transaction_id?: string }[])
        .map((r) => String(r.cash_transaction_id ?? '').trim())
        .filter(Boolean)
    )
  } catch {
    return new Set()
  }
}

/** 전체 은행 명세 출금 줄(미연결·부분연결, 날짜 무관) */
async function fetchStatementPool(supabase: SupabaseClient): Promise<ExpenseStatementAutoMatchLine[]> {
  const { data: rawImports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id, financial_account_id, period_start, period_end')
    .order('period_start', { ascending: false })
    .limit(500)
  if (impErr) throw impErr

  const imports = (rawImports || []) as {
    id: string
    financial_account_id: string
    period_start: string
    period_end: string
  }[]
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
      match_source: 'statement',
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

/** 전체 현금 관리 출금(이미 다른 지출에 연결된 건 제외, 날짜 무관) */
async function fetchCashWithdrawalPool(supabase: SupabaseClient): Promise<ExpenseStatementAutoMatchLine[]> {
  const linkedCashIds = await fetchLinkedCashTransactionIds(supabase)
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('id, transaction_date, transaction_type, amount, description, category')
    .eq('transaction_type', 'withdrawal')
    .order('transaction_date', { ascending: false })
    .limit(5000)
  if (error) throw error

  const pool: ExpenseStatementAutoMatchLine[] = []
  for (const row of data ?? []) {
    const id = String(row.id ?? '').trim()
    if (!id || linkedCashIds.has(id)) continue
    const amount = Math.abs(Number(row.amount ?? 0))
    if (amount <= AMOUNT_EQUAL_EPS) continue
    const ymd = ymdFromTimestamp(String(row.transaction_date ?? ''))
    const description = String(row.description ?? '').trim() || String(row.category ?? '').trim() || '—'
    pool.push({
      id,
      match_source: 'cash',
      financial_account_id: '',
      financial_account_name: '현금',
      posted_date: ymd || '—',
      amount: -amount,
      description,
      merchant_key: normalizeStatementMerchantKey(null, description),
      merchant_label: description,
      matched_status: 'unmatched',
      allocated_sum: 0,
      matchable_amount: amount,
      day_diff: 0,
    })
  }
  return pool
}

async function fetchMatchPool(supabase: SupabaseClient): Promise<{
  pool: ExpenseStatementAutoMatchLine[]
  statementCount: number
  cashCount: number
}> {
  const [statementPool, cashPool] = await Promise.all([
    fetchStatementPool(supabase),
    fetchCashWithdrawalPool(supabase),
  ])
  return {
    pool: [...statementPool, ...cashPool],
    statementCount: statementPool.length,
    cashCount: cashPool.length,
  }
}

type AmountIndexedPool = {
  pool: ExpenseStatementAutoMatchLine[]
  byCentKey: Map<number, ExpenseStatementAutoMatchLine[]>
}

function buildAmountIndexedPool(pool: ExpenseStatementAutoMatchLine[]): AmountIndexedPool {
  const byCentKey = new Map<number, ExpenseStatementAutoMatchLine[]>()
  for (const line of pool) {
    const key = Math.round(line.matchable_amount * 100)
    const arr = byCentKey.get(key) ?? []
    arr.push(line)
    byCentKey.set(key, arr)
  }
  return { pool, byCentKey }
}

/** 금액 허용 오차 범위의 명세·현금 줄만 조회 — 전체 풀 선형 탐색 대신 */
function poolLinesNearAmount(index: AmountIndexedPool, absAmt: number, tol: number): ExpenseStatementAutoMatchLine[] {
  const minCent = Math.max(0, Math.round((absAmt - tol) * 100))
  const maxCent = Math.round((absAmt + tol) * 100)
  const out: ExpenseStatementAutoMatchLine[] = []
  for (let cent = minCent; cent <= maxCent; cent++) {
    const batch = index.byCentKey.get(cent)
    if (batch) out.push(...batch)
  }
  return out
}

function buildCandidatesForExpense(
  expense: ExpenseAutoMatchInputRow,
  amountIndex: AmountIndexedPool,
  paymentMethodCtx: PaymentMethodMatchContext,
  vendorNames: string[]
): ExpenseStatementAutoMatchCandidate[] {
  const submitYmd = expense.submit_on ? expense.submit_on.slice(0, 10) : ''
  const absAmt = Math.abs(Number(expense.amount ?? 0))
  if (absAmt <= AMOUNT_EQUAL_EPS) return []
  const tol = expenseReconciliationAmountTolerance(absAmt)
  const paidTo = expense.paid_to ?? ''
  const paidFor = expense.paid_for ?? ''
  const vendorAliases = vendorAliasTextsForPaidTo(paidTo, vendorNames)

  const scoredPool = poolLinesNearAmount(amountIndex, absAmt, tol)
    .filter((line) => lineAllowedForPaymentMethod(line, paymentMethodCtx))
    .map((line) => ({
      ...line,
      day_diff: submitYmd ? dayDiffFromYmd(line.posted_date, submitYmd) : 0,
    }))

  const candidates: ExpenseStatementAutoMatchCandidate[] = []
  const usedLineSets = new Set<string>()

  for (const line of scoredPool) {
    const amountDiff = Math.abs(line.matchable_amount - absAmt)
    if (amountDiff > tol) continue
    const accountAdj =
      paymentMethodCtx?.financial_account_id && line.financial_account_id
        ? paymentMethodCtx.financial_account_id === line.financial_account_id
          ? ACCOUNT_MATCH_BONUS
          : -ACCOUNT_MISMATCH_PENALTY
        : 0
    const textBonus =
      expenseTextMatchBonus(line, paidTo, paidFor, vendorAliases) +
      paymentMethodTextBonus(line, paymentMethodCtx) +
      paymentMethodSourceBonus(line, paymentMethodCtx)
    const partial: Omit<ExpenseStatementAutoMatchCandidate, 'key' | 'label'> = {
      kind: 'single',
      match_source: line.match_source,
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
        textBonus,
        accountAdj,
      }),
    }
    const key = `${line.match_source === 'cash' ? 'cash' : 'single'}:${line.id}`
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
  for (const line of scoredPool) {
    if (line.match_source !== 'statement') continue
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
      const accountAdj =
        paymentMethodCtx?.financial_account_id && combo[0]?.financial_account_id
          ? paymentMethodCtx.financial_account_id === combo[0].financial_account_id
            ? ACCOUNT_MATCH_BONUS
            : -ACCOUNT_MISMATCH_PENALTY
          : 0
      const textBonus = combo[0]
        ? expenseTextMatchBonus(combo[0], paidTo, paidFor, vendorAliases) +
          paymentMethodTextBonus(combo[0], paymentMethodCtx)
        : 0
      const partial: Omit<ExpenseStatementAutoMatchCandidate, 'key' | 'label'> = {
        kind: 'aggregate',
        match_source: 'statement',
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
          textBonus,
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
  statementPoolSize: number
  cashPoolSize: number
  skippedNoDate: number
}> {
  const exclude = opts?.excludeExpenseIds ?? new Set<string>()
  const targets = expenses
    .filter(
      (e) =>
        e.id &&
        !exclude.has(e.id) &&
        Math.abs(Number(e.amount ?? 0)) > AMOUNT_EQUAL_EPS
    )
    .slice(0, EXPENSE_STATEMENT_AUTO_MATCH_MAX_EXPENSES)

  const { pool, statementCount, cashCount } = await fetchMatchPool(supabase)
  const amountIndex = buildAmountIndexedPool(pool)
  const [pmProfiles, vendorNames] = await Promise.all([
    loadPaymentMethodMatchProfiles(supabase),
    loadExpenseVendorNames(supabase),
  ])

  const proposals: ExpenseStatementAutoMatchProposal[] = []
  let skippedNoDate = 0

  for (const expense of targets) {
    const submitYmd = expense.submit_on ? expense.submit_on.slice(0, 10) : ''
    if (!submitYmd) skippedNoDate += 1
    const paymentMethodCtx = resolvePaymentMethodContext(expense.payment_method, pmProfiles)
    const candidates = buildCandidatesForExpense(expense, amountIndex, paymentMethodCtx, vendorNames)
    if (candidates.length === 0) continue
    proposals.push({
      expense_id: expense.id,
      submit_on: submitYmd || '—',
      amount: Math.abs(Number(expense.amount ?? 0)),
      paid_to: expense.paid_to ?? '',
      paid_for: expense.paid_for ?? '',
      candidates,
    })
  }

  return {
    proposals,
    poolSize: pool.length,
    statementPoolSize: statementCount,
    cashPoolSize: cashCount,
    skippedNoDate,
  }
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

  const sortedItems = [...params.items].sort(
    (a, b) => (b.candidate?.score ?? 0) - (a.candidate?.score ?? 0)
  )

  for (const item of sortedItems) {
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
    const sourceTable = item.sourceTable ?? params.sourceTable
    try {
      if (candidate.match_source === 'cash') {
        const line = candidate.lines[0]
        if (!line || !expenseSourceSupportsCashLedgerLink(sourceTable)) {
          skippedInvalid += 1
          continue
        }
        await replaceExpenseCashLedgerMatch(supabase, {
          actorEmail: params.actorEmail,
          expenseSourceTable: sourceTable,
          expenseSourceId: item.expense_id,
          cashTransactionId: line.id,
          matchedAmount: line.matchable_amount,
        })
        usedLineIds.add(line.id)
        applied += 1
        continue
      }

      for (let i = 0; i < candidate.lines.length; i++) {
        const line = candidate.lines[i]!
        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: params.actorEmail,
          sourceTable,
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

/** 일괄 미리보기 기본 선택 — 명세 줄 충돌 없이 점수 순·후보 대안까지 시도 */
export function pickDefaultExpenseAutoMatchSelections(
  proposals: ExpenseStatementAutoMatchProposal[]
): { selectedExpenseIds: Set<string>; candidateKeyByExpenseId: Record<string, string> } {
  const rankedExpenses = [...proposals].sort((a, b) => {
    const sa = a.candidates[0]?.score ?? 0
    const sb = b.candidates[0]?.score ?? 0
    if (sb !== sa) return sb - sa
    const da = a.candidates[0]?.amount_diff ?? Number.POSITIVE_INFINITY
    const db = b.candidates[0]?.amount_diff ?? Number.POSITIVE_INFINITY
    return da - db
  })

  const selectedExpenseIds = new Set<string>()
  const candidateKeyByExpenseId: Record<string, string> = {}
  const usedLineIds = new Set<string>()

  for (const p of rankedExpenses) {
    for (const candidate of p.candidates) {
      if (candidate.line_ids.some((id) => usedLineIds.has(id))) continue
      selectedExpenseIds.add(p.expense_id)
      candidateKeyByExpenseId[p.expense_id] = candidate.key
      for (const id of candidate.line_ids) usedLineIds.add(id)
      break
    }
  }

  return { selectedExpenseIds, candidateKeyByExpenseId }
}

/** 점수·충돌 없는 고신뢰 후보만 선택 */
export function pickHighConfidenceExpenseAutoMatchSelections(
  proposals: ExpenseStatementAutoMatchProposal[],
  minScore = EXPENSE_STATEMENT_AUTO_MATCH_HIGH_CONFIDENCE_SCORE
): { selectedExpenseIds: Set<string>; candidateKeyByExpenseId: Record<string, string> } {
  const ranked = proposals
    .flatMap((p) =>
      p.candidates
        .filter((c) => c.score >= minScore)
        .map((candidate) => ({ p, candidate, score: candidate.score }))
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.candidate.amount_diff - b.candidate.amount_diff
    })

  const selectedExpenseIds = new Set<string>()
  const candidateKeyByExpenseId: Record<string, string> = {}
  const usedLineIds = new Set<string>()

  for (const { p, candidate } of ranked) {
    if (selectedExpenseIds.has(p.expense_id)) continue
    if (candidate.line_ids.some((id) => usedLineIds.has(id))) continue
    selectedExpenseIds.add(p.expense_id)
    candidateKeyByExpenseId[p.expense_id] = candidate.key
    for (const id of candidate.line_ids) usedLineIds.add(id)
  }

  return { selectedExpenseIds, candidateKeyByExpenseId }
}
