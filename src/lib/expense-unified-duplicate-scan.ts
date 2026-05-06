import { supabase } from '@/lib/supabase'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
  COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN,
  type LedgerDuplicateExpenseRow
} from '@/lib/statement-bulk-company-duplicate-check'

const FETCH_PAGE = 1000
const MATCH_IN_CHUNK = 200
/** 테이블당 조회 상한(병합 후 전체는 COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN으로 자름) */
const UNIFIED_DUP_PER_TABLE_FETCH = 900

export type UnifiedExpenseSourceTable =
  | 'company_expenses'
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'ticket_bookings'

export const UNIFIED_EXPENSE_SOURCE_LABEL: Record<UnifiedExpenseSourceTable, string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
  reservation_expenses: '예약 지출',
  ticket_bookings: '입장권 부킹'
}

export type UnifiedLedgerDuplicateExpenseRow = LedgerDuplicateExpenseRow & {
  source_table: UnifiedExpenseSourceTable
  source_key: string
  source_context: string | null
}

export function expenseSourceKey(table: UnifiedExpenseSourceTable, id: string): string {
  return `${table}:${id}`
}

export function parseExpenseSourceKey(key: string): { table: UnifiedExpenseSourceTable; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const table = key.slice(0, idx) as UnifiedExpenseSourceTable
  const id = key.slice(idx + 1)
  if (
    table !== 'company_expenses' &&
    table !== 'tour_expenses' &&
    table !== 'reservation_expenses' &&
    table !== 'ticket_bookings'
  ) {
    return null
  }
  if (!id) return null
  return { table, id }
}

/** DB `fingerprint`와 동일한 규칙 */
export function canonPairFingerprint(ka: string, kb: string): string {
  const [a, b] = [ka, kb].sort((x, y) => x.localeCompare(y))
  return `pair:${a}|${b}`
}

export function canonGroupFingerprint(keys: string[]): string {
  const u = [...new Set(keys)].sort((x, y) => x.localeCompare(y))
  return `group:${u.join('|')}`
}

function comparableYmd(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
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

function isIncludedStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return true
  if (s === 'approved' || s === 'pending') return true
  return false
}

function isLikelyUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim())
}

function paymentMethodLabelFromRow(row: {
  display_name?: string | null
  method?: string | null
  card_number_last4?: string | null
}): string {
  const dn = String(row.display_name ?? '').trim()
  if (dn) return dn
  const m = String(row.method ?? '').trim()
  const last4 = String(row.card_number_last4 ?? '').trim()
  if (m && last4) return `${m} ·${last4}`
  if (m) return m
  return '—'
}

async function fetchPaymentMethodLabelMap(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uuidIds = [...new Set(ids.map((x) => x.trim()).filter((x) => x && isLikelyUuid(x)))]
  for (let i = 0; i < uuidIds.length; i += MATCH_IN_CHUNK) {
    const chunk = uuidIds.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, display_name, method, card_number_last4')
      .in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as {
        id?: string
        display_name?: string | null
        method?: string | null
        card_number_last4?: string | null
      }
      const id = String(o.id ?? '')
      if (!id) continue
      out.set(id, paymentMethodLabelFromRow(o))
    }
  }
  return out
}

async function fetchStatementLineFinancialAccountNames(lineIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(lineIds.map((x) => x.trim()).filter(Boolean))]
  if (unique.length === 0) return out

  const sb = supabase as any
  const lineToImport = new Map<string, string>()

  for (let i = 0; i < unique.length; i += MATCH_IN_CHUNK) {
    const chunk = unique.slice(i, i + MATCH_IN_CHUNK)
    const { data: linesRaw, error: lineErr } = await sb
      .from('statement_lines')
      .select('id, statement_import_id')
      .in('id', chunk)
    if (lineErr) throw lineErr
    const lines = (linesRaw as { id?: string; statement_import_id?: string }[]) || []
    for (const l of lines) {
      const lid = String(l.id ?? '')
      const iid = String(l.statement_import_id ?? '').trim()
      if (lid && iid) lineToImport.set(lid, iid)
    }
  }

  const importIds = [...new Set([...lineToImport.values()])]
  const importToFa = new Map<string, string>()
  for (let j = 0; j < importIds.length; j += MATCH_IN_CHUNK) {
    const ichunk = importIds.slice(j, j + MATCH_IN_CHUNK)
    const { data: impsRaw, error: impErr } = await sb
      .from('statement_imports')
      .select('id, financial_account_id')
      .in('id', ichunk)
    if (impErr) throw impErr
    const imps = (impsRaw as { id?: string; financial_account_id?: string }[]) || []
    for (const im of imps) {
      const id = String(im.id ?? '')
      const fa = String(im.financial_account_id ?? '').trim()
      if (id && fa) importToFa.set(id, fa)
    }
  }

  const faIds = [...new Set([...importToFa.values()])]
  const faName = new Map<string, string>()
  for (let j = 0; j < faIds.length; j += MATCH_IN_CHUNK) {
    const fchunk = faIds.slice(j, j + MATCH_IN_CHUNK)
    const { data: facsRaw, error: faErr } = await sb.from('financial_accounts').select('id, name').in('id', fchunk)
    if (faErr) throw faErr
    const facs = (facsRaw as { id?: string; name?: string }[]) || []
    for (const f of facs) {
      const id = String(f.id ?? '')
      const name = String(f.name ?? '').trim()
      if (id) faName.set(id, name || id)
    }
  }

  for (const [lid, impId] of lineToImport) {
    const faId = importToFa.get(impId)
    const name = faId ? faName.get(faId) : undefined
    if (name) out.set(lid, name)
  }
  return out
}

function effectiveStatementLineId(row: {
  statement_line_id: string | null
  reconciled_statement_line_id: string | null
}): string | null {
  const a = (row.reconciled_statement_line_id ?? '').trim()
  if (a) return a
  const b = (row.statement_line_id ?? '').trim()
  return b || null
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

async function fetchReconciliationLinesForSourceTable(
  sourceTable: UnifiedExpenseSourceTable,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  for (let i = 0; i < ids.length; i += MATCH_IN_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await (supabase as any)
      .from('reconciliation_matches')
      .select('source_id, statement_line_id')
      .eq('source_table', sourceTable)
      .in('source_id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const sid = String((row as { source_id?: string }).source_id ?? '')
      const lid = String((row as { statement_line_id?: string }).statement_line_id ?? '')
      if (!sid || !lid) continue
      if (!map.has(sid)) map.set(sid, lid)
    }
  }
  return map
}

type RawTagged = { _source_table: UnifiedExpenseSourceTable; _raw: Record<string, unknown> }

async function fetchExpenseTableWindow(
  table: UnifiedExpenseSourceTable,
  selectList: string,
  startIso: string,
  endIso: string,
  maxRows: number
): Promise<Record<string, unknown>[]> {
  const sb = table === 'reservation_expenses' ? (supabase as any) : supabase
  const out: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    let q = sb.from(table).select(selectList).gte('submit_on', startIso).lte('submit_on', endIso)
    if (table === 'ticket_bookings') {
      q = q.or('status.eq.confirmed,status.eq.Confirmed')
    }
    const { data, error } = await q
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + FETCH_PAGE - 1)
    if (error) throw error
    const batch = (data as Record<string, unknown>[]) || []
    out.push(...batch)
    if (batch.length < FETCH_PAGE || out.length >= maxRows) break
    from += FETCH_PAGE
  }
  return out.length > maxRows ? out.slice(0, maxRows) : out
}

async function fetchExpenseDuplicateSuppressionFingerprints(): Promise<{
  pairFp: Set<string>
  groupFp: Set<string>
}> {
  const pairFp = new Set<string>()
  const groupFp = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('expense_duplicate_suppressions')
      .select('fingerprint, kind')
      .order('created_at', { ascending: false })
      .range(from, from + FETCH_PAGE - 1)
    if (error) throw error
    const batch = (data as { fingerprint?: string; kind?: string }[]) || []
    for (const r of batch) {
      const fp = String(r.fingerprint ?? '')
      const k = String(r.kind ?? '')
      if (!fp) continue
      if (k === 'pair') pairFp.add(fp)
      else if (k === 'group') groupFp.add(fp)
    }
    if (batch.length < FETCH_PAGE) break
    from += FETCH_PAGE
  }
  return { pairFp, groupFp }
}

function sortUnifiedGroupRows(rows: UnifiedLedgerDuplicateExpenseRow[]): UnifiedLedgerDuplicateExpenseRow[] {
  return [...rows].sort((a, b) => {
    const ay = comparableYmd(a.submit_on)
    const by = comparableYmd(b.submit_on)
    if (ay !== by) return ay.localeCompare(by)
    return a.source_key.localeCompare(b.source_key)
  })
}

function applyLedgerDisplayFields(
  row: Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'>,
  pmLabels: Map<string, string>,
  lineAccountNames: Map<string, string>
): UnifiedLedgerDuplicateExpenseRow {
  const pmRaw = (row.payment_method ?? '').trim()
  let displayPm = '—'
  if (pmRaw) {
    displayPm = pmLabels.get(pmRaw) ?? pmRaw
  }
  const lineId = effectiveStatementLineId(row)
  let displayStmt = '미연결'
  let displayFa: string | null = '—'
  if (lineId) {
    displayStmt = `연결됨 (${lineId.slice(0, 8)}…)`
    displayFa = lineAccountNames.get(lineId) ?? '—'
  }
  return {
    ...row,
    display_payment_method: displayPm,
    display_statement_status: displayStmt,
    display_financial_account: displayFa
  }
}

function mapCompanyRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'company_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.description == null ? null : String(r.description),
    category: r.category == null ? null : String(r.category),
    status: r.status == null ? null : String(r.status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: r.ledger_expense_origin == null ? null : String(r.ledger_expense_origin),
    reconciled_statement_line_id: recon.get(id) ?? null,
    standard_paid_for: r.standard_paid_for == null ? null : String(r.standard_paid_for),
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: null
  }
}

function mapTourRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'tour_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const tourDate = r.tour_date == null ? '' : String(r.tour_date).slice(0, 10)
  const tid = r.tour_id == null ? '' : String(r.tour_id)
  const ctx =
    tourDate && tid ? `투어일 ${tourDate} · tour ${tid.slice(0, 8)}…` : tourDate ? `투어일 ${tourDate}` : tid ? `tour ${tid.slice(0, 8)}…` : null
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.note == null ? null : String(r.note),
    category: null,
    status: r.status == null ? null : String(r.status),
    statement_line_id: null,
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(id) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: ctx
  }
}

function mapReservationRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'reservation_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const rid = r.reservation_id == null ? '' : String(r.reservation_id)
  const ctx = rid ? `예약 ${rid.slice(0, 8)}…` : null
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.note == null ? null : String(r.note),
    category: null,
    status: r.status == null ? null : String(r.status),
    statement_line_id: null,
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(id) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: ctx
  }
}

function mapTicketRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'ticket_bookings'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const cat = r.category == null ? '' : String(r.category)
  const co = r.company == null ? '' : String(r.company)
  return {
    id,
    amount: r.expense == null ? null : Number(r.expense),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: co || null,
    paid_for: cat || null,
    description: r.note == null ? null : String(r.note),
    category: cat || null,
    status: r.booking_status == null ? null : String(r.booking_status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(id) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: r.check_in_date == null ? null : `체크인 ${String(r.check_in_date).slice(0, 10)}`
  }
}

/**
 * 회사·투어·예약·입장권 지출을 한 풀에서 금액·등록일(±) 기준으로 묶은 중복 의심 그룹.
 * `expense_duplicate_suppressions`에 기록된 쌍·그룹은 제외합니다.
 */
export async function fetchUnifiedExpenseLedgerDuplicateGroups(
  dateFromYmd: string,
  dateToYmd: string
): Promise<{ groups: UnifiedLedgerDuplicateExpenseRow[][]; truncated: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(dateToYmd)) {
    throw new Error('날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (dateFromYmd > dateToYmd) {
    throw new Error('시작일이 종료일보다 늦습니다.')
  }

  const startIso = `${dateFromYmd}T00:00:00.000Z`
  const endIso = `${dateToYmd}T23:59:59.999Z`

  const [ce, te, re, tb, { pairFp, groupFp }] = await Promise.all([
    fetchExpenseTableWindow(
      'company_expenses',
      'id, amount, submit_on, paid_to, paid_for, description, category, status, statement_line_id, ledger_expense_origin, standard_paid_for, payment_method',
      startIso,
      endIso,
      UNIFIED_DUP_PER_TABLE_FETCH
    ),
    fetchExpenseTableWindow(
      'tour_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, tour_date, tour_id',
      startIso,
      endIso,
      UNIFIED_DUP_PER_TABLE_FETCH
    ),
    fetchExpenseTableWindow(
      'reservation_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, reservation_id',
      startIso,
      endIso,
      UNIFIED_DUP_PER_TABLE_FETCH
    ),
    fetchExpenseTableWindow(
      'ticket_bookings',
      'id, expense, submit_on, category, company, note, booking_status, payment_method, statement_line_id, check_in_date',
      startIso,
      endIso,
      UNIFIED_DUP_PER_TABLE_FETCH
    ),
    fetchExpenseDuplicateSuppressionFingerprints()
  ])

  const tagged: RawTagged[] = [
    ...ce.map((r) => ({ _source_table: 'company_expenses' as const, _raw: r })),
    ...te.map((r) => ({ _source_table: 'tour_expenses' as const, _raw: r })),
    ...re.map((r) => ({ _source_table: 'reservation_expenses' as const, _raw: r })),
    ...tb.map((r) => ({ _source_table: 'ticket_bookings' as const, _raw: r }))
  ]

  tagged.sort((a, b) => {
    const ta = String(a._raw.submit_on ?? '')
    const tb = String(b._raw.submit_on ?? '')
    if (ta !== tb) return ta.localeCompare(tb)
    return expenseSourceKey(a._source_table, String(a._raw.id ?? '')).localeCompare(
      expenseSourceKey(b._source_table, String(b._raw.id ?? ''))
    )
  })

  const mergedTruncated = tagged.length > COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN
  const cappedTagged = mergedTruncated ? tagged.slice(0, COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN) : tagged

  const idsByTable: Record<UnifiedExpenseSourceTable, string[]> = {
    company_expenses: [],
    tour_expenses: [],
    reservation_expenses: [],
    ticket_bookings: []
  }
  for (const t of cappedTagged) {
    const id = String(t._raw.id ?? '')
    if (id) idsByTable[t._source_table].push(id)
  }

  const [rCompany, rTour, rRes, rTicket] = await Promise.all([
    fetchReconciliationLinesForSourceTable('company_expenses', idsByTable.company_expenses),
    fetchReconciliationLinesForSourceTable('tour_expenses', idsByTable.tour_expenses),
    fetchReconciliationLinesForSourceTable('reservation_expenses', idsByTable.reservation_expenses),
    fetchReconciliationLinesForSourceTable('ticket_bookings', idsByTable.ticket_bookings)
  ])

  const byKey = new Map<
    string,
    Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'>
  >()
  const eligibleBase: Omit<
    UnifiedLedgerDuplicateExpenseRow,
    'display_payment_method' | 'display_statement_status' | 'display_financial_account'
  >[] = []

  for (const { _source_table, _raw } of cappedTagged) {
    let row: Omit<
      UnifiedLedgerDuplicateExpenseRow,
      'display_payment_method' | 'display_statement_status' | 'display_financial_account'
    >
    if (_source_table === 'company_expenses') {
      row = mapCompanyRaw(_raw, rCompany, _source_table)
    } else if (_source_table === 'tour_expenses') {
      row = mapTourRaw(_raw, rTour, _source_table)
    } else if (_source_table === 'reservation_expenses') {
      row = mapReservationRaw(_raw, rRes, _source_table)
    } else {
      row = mapTicketRaw(_raw, rTicket, _source_table)
    }
    if (row.source_table === 'ticket_bookings') {
      const a = row.amount
      if (a == null || !Number.isFinite(a) || a <= 0) continue
    }
    if (!isIncludedStatus(row.status)) continue
    eligibleBase.push(row)
    byKey.set(row.source_key, row)
  }

  const pairKeys: [string, string][] = []
  for (let i = 0; i < eligibleBase.length; i++) {
    const a = eligibleBase[i]!
    const ay = comparableYmd(a.submit_on)
    if (ay.length !== 10) continue
    const aAmt = a.amount
    if (aAmt == null || !Number.isFinite(aAmt)) continue
    for (let j = i + 1; j < eligibleBase.length; j++) {
      const b = eligibleBase[j]!
      const bAmt = b.amount
      if (bAmt == null || !Number.isFinite(bAmt)) continue
      if (Math.abs(aAmt - bAmt) > BULK_COMPANY_DUP_AMOUNT_EPS) continue
      const by = comparableYmd(b.submit_on)
      if (by.length !== 10) continue
      if (calendarDayDiffAbs(ay, by) > BULK_COMPANY_DUP_DAY_WINDOW) continue
      const fp = canonPairFingerprint(a.source_key, b.source_key)
      if (pairFp.has(fp)) continue
      pairKeys.push([a.source_key, b.source_key])
    }
  }

  let clusters = clusterKeysFromPairs(pairKeys)
  clusters = clusters.filter((g) => {
    const gfp = canonGroupFingerprint(g)
    return !groupFp.has(gfp)
  })

  const allInClusters = new Set<string>()
  for (const g of clusters) for (const k of g) allInClusters.add(k)

  const pmIds: string[] = []
  const lineIds: string[] = []
  for (const k of allInClusters) {
    const row = byKey.get(k)
    if (!row) continue
    const pm = (row.payment_method ?? '').trim()
    if (pm) pmIds.push(pm)
    const lid = effectiveStatementLineId(row)
    if (lid) lineIds.push(lid)
  }
  const [pmLabels, lineAccounts] = await Promise.all([
    fetchPaymentMethodLabelMap(pmIds),
    fetchStatementLineFinancialAccountNames(lineIds)
  ])

  const groups: UnifiedLedgerDuplicateExpenseRow[][] = clusters.map((keyList) => {
    const rows = keyList
      .map((k) => byKey.get(k))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .map((row) => applyLedgerDisplayFields(row, pmLabels, lineAccounts))
    return sortUnifiedGroupRows(rows)
  })

  const truncated = mergedTruncated || ce.length >= UNIFIED_DUP_PER_TABLE_FETCH || te.length >= UNIFIED_DUP_PER_TABLE_FETCH || re.length >= UNIFIED_DUP_PER_TABLE_FETCH || tb.length >= UNIFIED_DUP_PER_TABLE_FETCH

  return { groups, truncated }
}

export async function insertExpenseDuplicateSuppression(input: {
  fingerprint: string
  kind: 'pair' | 'group'
  member_keys: string[]
  created_by?: string | null
}): Promise<void> {
  const { error } = await supabase.from('expense_duplicate_suppressions').insert({
    fingerprint: input.fingerprint,
    kind: input.kind,
    member_keys: input.member_keys,
    created_by: input.created_by ?? null
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') return
    throw error
  }
}

/** 명세 매칭 행을 먼저 지운 뒤 해당 출처 지출 1건을 삭제합니다. */
export async function deleteExpenseBySourceKey(sourceKey: string): Promise<void> {
  const parsed = parseExpenseSourceKey(sourceKey)
  if (!parsed) throw new Error('잘못된 지출 키입니다.')
  const { table, id } = parsed
  const sb = table === 'reservation_expenses' ? (supabase as any) : supabase
  const rm = supabase as any
  const { error: e0 } = await rm.from('reconciliation_matches').delete().eq('source_table', table).eq('source_id', id)
  if (e0) throw e0
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) throw error
}
