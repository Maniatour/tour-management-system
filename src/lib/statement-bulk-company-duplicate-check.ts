import { supabase } from '@/lib/supabase'

/** 자동 매칭·명세 대조와 동일한 금액 허용 오차에 맞춤 */
export const BULK_COMPANY_DUP_AMOUNT_EPS = 0.02
/** 명세 대조 화면과 동일 ±일 */
export const BULK_COMPANY_DUP_DAY_WINDOW = 4

const FETCH_PAGE = 1000
const MATCH_IN_CHUNK = 200

export type BulkCompanyDuplicateCheckInput = {
  statement_line_id: string
  posted_date: string
  amount: number
  line_desc: string
}

export type ExistingCompanyExpenseDuplicate = {
  id: string
  amount: number | null
  submit_on: string | null
  paid_to: string | null
  paid_for: string | null
  description: string | null
  category: string | null
  status: string | null
  statement_line_id: string | null
  ledger_expense_origin: string | null
  /** reconciliation_matches 기준 명세 줄(행에 없을 수 있음) */
  reconciled_statement_line_id: string | null
  standard_paid_for?: string | null
  payment_method?: string | null
}

/** 지출끼리 중복 점검(ledger) 한 행 — 표시용 필드 포함 */
export type LedgerDuplicateExpenseRow = {
  id: string
  amount: number | null
  submit_on: string | null
  paid_to: string | null
  paid_for: string | null
  description: string | null
  category: string | null
  status: string | null
  statement_line_id: string | null
  ledger_expense_origin: string | null
  reconciled_statement_line_id: string | null
  standard_paid_for: string | null
  payment_method: string | null
  display_payment_method: string
  display_statement_status: string
  display_financial_account: string | null
}

export type BulkCompanyDuplicateRow = {
  proposal: BulkCompanyDuplicateCheckInput
  matches: ExistingCompanyExpenseDuplicate[]
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

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const u = Date.UTC(y, m - 1, d + delta)
  const dt = new Date(u)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function isIncludedStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return true
  if (s === 'approved' || s === 'pending') return true
  return false
}

async function fetchCompanyExpensesInWindow(startIso: string, endIso: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('company_expenses')
      .select(
        'id, amount, submit_on, paid_to, paid_for, description, category, status, statement_line_id, ledger_expense_origin, standard_paid_for, payment_method'
      )
      .gte('submit_on', startIso)
      .lte('submit_on', endIso)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + FETCH_PAGE - 1)
    if (error) throw error
    const batch = (data as Record<string, unknown>[]) || []
    out.push(...batch)
    if (batch.length < FETCH_PAGE) break
    from += FETCH_PAGE
  }
  return out
}

async function fetchReconciliationLinesForCompanyExpenseIds(
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  for (let i = 0; i < ids.length; i += MATCH_IN_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_IN_CHUNK)
    /** Database 타입에 `reconciliation_matches` 행이 없을 수 있어 PostgREST 체인만 느슨하게 씀 */
    const { data, error } = await (supabase as any)
      .from('reconciliation_matches')
      .select('source_id, statement_line_id')
      .eq('source_table', 'company_expenses')
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

/**
 * 일괄 입력 예정 행마다, 동일·근접 금액·등록일(±일)의 기존 회사 지출을 찾습니다.
 * (자동 매칭으로 다른 명세에만 묶여 있거나, 수동으로만 올라간 동일 거래 등)
 */
export async function fetchCompanyExpenseDuplicatesForBulk(
  proposals: BulkCompanyDuplicateCheckInput[]
): Promise<BulkCompanyDuplicateRow[]> {
  if (proposals.length === 0) return []

  const ymds = proposals
    .map((p) => String(p.posted_date ?? '').trim().slice(0, 10))
    .filter((d) => d.length === 10)
  if (ymds.length === 0) return []

  let minY = ymds[0]!
  let maxY = ymds[0]!
  for (const d of ymds) {
    if (d < minY) minY = d
    if (d > maxY) maxY = d
  }

  const winStart = addDaysYmd(minY, -BULK_COMPANY_DUP_DAY_WINDOW)
  const winEnd = addDaysYmd(maxY, BULK_COMPANY_DUP_DAY_WINDOW)
  const startIso = `${winStart}T00:00:00.000Z`
  const endIso = `${winEnd}T23:59:59.999Z`

  const rawRows = await fetchCompanyExpensesInWindow(startIso, endIso)
  const reconciledByExpenseId = await fetchReconciliationLinesForCompanyExpenseIds(
    rawRows.map((r) => String(r.id ?? '')).filter(Boolean)
  )

  const existingList: ExistingCompanyExpenseDuplicate[] = rawRows.map((r) => {
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
      reconciled_statement_line_id: reconciledByExpenseId.get(id) ?? null,
      standard_paid_for: r.standard_paid_for == null ? null : String(r.standard_paid_for),
      payment_method: r.payment_method == null ? null : String(r.payment_method)
    }
  })

  const out: BulkCompanyDuplicateRow[] = []

  for (const p of proposals) {
    const pYmd = String(p.posted_date ?? '').trim().slice(0, 10)
    if (pYmd.length !== 10) continue
    const pAmt = Number(p.amount)
    if (!Number.isFinite(pAmt)) continue

    const matches: ExistingCompanyExpenseDuplicate[] = []
    for (const ex of existingList) {
      if (!isIncludedStatus(ex.status)) continue
      const exAmt = ex.amount
      if (exAmt == null || !Number.isFinite(exAmt)) continue
      if (Math.abs(exAmt - pAmt) > BULK_COMPANY_DUP_AMOUNT_EPS) continue

      const exYmd = comparableYmd(ex.submit_on)
      if (exYmd.length !== 10) continue
      if (calendarDayDiffAbs(pYmd, exYmd) > BULK_COMPANY_DUP_DAY_WINDOW) continue

      if (ex.statement_line_id && ex.statement_line_id === p.statement_line_id) continue
      if (ex.reconciled_statement_line_id && ex.reconciled_statement_line_id === p.statement_line_id) continue

      matches.push(ex)
    }

    if (matches.length > 0) {
      matches.sort((a, b) => String(b.submit_on ?? '').localeCompare(String(a.submit_on ?? '')))
      out.push({
        proposal: {
          statement_line_id: p.statement_line_id,
          posted_date: p.posted_date,
          amount: p.amount,
          line_desc: p.line_desc
        },
        matches
      })
    }
  }

  return out
}

/** 통합 중복 점검(회사·투어·예약·입장권) 등에서 조회·비교 상한(병합 후 slice 기준) */
export const COMPANY_EXPENSE_LEDGER_DUP_MAX_SCAN = 2500
