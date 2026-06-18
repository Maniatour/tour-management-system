import type { SupabaseClient } from '@supabase/supabase-js'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import {
  expenseReconciliationAmountTolerance,
} from '@/lib/expense-reconciliation-similar-lines'
import {
  expenseCashLinkRowKey,
  expenseSourceSupportsCashLedgerLink,
  replaceExpenseCashLedgerMatch,
  type ExpenseCashLinkSourceTable,
} from '@/lib/expense-cash-ledger-match'
import { fetchReconciledSourceIds } from '@/lib/reconciliation-match-queries'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const CASH_TRANSACTION_AUTO_MATCH_MAX = 500
export const CASH_TRANSACTION_AUTO_MATCH_CANDIDATE_LIMIT = 6
const AMOUNT_EQUAL_EPS = 0.02
const TEXT_BONUS_MAX = 12
const EXPENSE_CASH_LEDGER_MATCHES_TABLE = 'expense_cash_ledger_matches'

export type CashAutoMatchInputRow = {
  id: string
  transaction_date: string
  amount: number
  transaction_type: 'deposit' | 'withdrawal'
  description: string
  category: string | null
  /** 입금 — payment_record 연결(reference) 여부 */
  linked_payment_record_id?: string | null
}

export type CashAutoMatchCandidate = {
  key: string
  target_kind: 'expense' | 'payment_record'
  target_table: ExpenseCashLinkSourceTable | 'payment_records'
  target_id: string
  submit_date: string
  amount: number
  paid_to: string
  paid_for: string
  label: string
  amount_diff: number
  day_diff: number
  score: number
}

export type CashAutoMatchProposal = {
  cash_id: string
  transaction_date: string
  amount: number
  direction: 'inflow' | 'outflow'
  description: string
  candidates: CashAutoMatchCandidate[]
}

type ExpensePoolRow = {
  key: string
  source_table: ExpenseCashLinkSourceTable
  source_id: string
  submit_date: string
  amount: number
  paid_to: string
  paid_for: string
  label: string
}

type PaymentPoolRow = {
  id: string
  submit_date: string
  amount: number
  note: string
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

function ymdToUtcDayNumber(raw: string): number {
  const ymd = ymdFromTimestamp(raw)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return Number.NaN
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000)
}

function dayDiffFromYmd(a: string, b: string): number {
  const da = ymdToUtcDayNumber(a)
  const db = ymdToUtcDayNumber(b)
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY
  return Math.abs(da - db)
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

function textOverlapBonus(cashText: string, targetText: string): number {
  const cashTokens = autoMatchTextTokenSet(cashText)
  const targetTokens = autoMatchTextTokenSet(targetText)
  if (cashTokens.size === 0 || targetTokens.size === 0) return 0
  let shared = 0
  for (const t of targetTokens) if (cashTokens.has(t)) shared += 1
  if (shared === 0) return 0
  return Math.min(TEXT_BONUS_MAX, 4 + shared * 4)
}

async function fetchCashLinkedExpenseKeys(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE).select(
      'expense_source_table, expense_source_id'
    )
    if (error) return new Set()
    return new Set(
      ((data ?? []) as { expense_source_table?: string; expense_source_id?: string }[])
        .map((r) =>
          expenseCashLinkRowKey(String(r.expense_source_table ?? ''), String(r.expense_source_id ?? ''))
        )
        .filter((k) => k.includes(':') && !k.endsWith(':'))
    )
  } catch {
    return new Set()
  }
}

async function fetchCashLinkedCashTransactionIds(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await fromUntypedTable(supabase, EXPENSE_CASH_LEDGER_MATCHES_TABLE).select(
      'cash_transaction_id'
    )
    if (error) return new Set()
    return new Set(
      ((data ?? []) as { cash_transaction_id?: string }[])
        .map((r) => String(r.cash_transaction_id ?? '').trim())
        .filter(Boolean)
    )
  } catch {
    return new Set()
  }
}

async function fetchExpensePoolForCashAutoMatch(
  supabase: SupabaseClient,
  linkedExpenseKeys: Set<string>
): Promise<ExpensePoolRow[]> {
  const out: ExpensePoolRow[] = []
  const perTableLimit = 1200

  const pushRow = (row: ExpensePoolRow) => {
    if (linkedExpenseKeys.has(row.key)) return
    if (row.amount <= AMOUNT_EQUAL_EPS) return
    out.push(row)
  }

  const [companyRes, tourRes, reservationRes, ticketRes, hotelRes] = await Promise.all([
    supabase
      .from('company_expenses')
      .select('id,submit_on,amount,paid_to,paid_for,description,notes')
      .order('submit_on', { ascending: false })
      .limit(perTableLimit),
    supabase
      .from('tour_expenses')
      .select('id,submit_on,amount,paid_to,paid_for,note,tour_date')
      .order('submit_on', { ascending: false })
      .limit(perTableLimit),
    supabase
      .from('reservation_expenses')
      .select('id,submit_on,amount,paid_to,paid_for,note')
      .order('submit_on', { ascending: false })
      .limit(perTableLimit),
    supabase
      .from('ticket_bookings')
      .select('id,submit_on,check_in_date,expense,company,category,note')
      .order('submit_on', { ascending: false })
      .limit(perTableLimit),
    supabase
      .from('tour_hotel_bookings')
      .select('id,check_in_date,total_price,hotel,reservation_name,city')
      .order('check_in_date', { ascending: false })
      .limit(perTableLimit),
  ])

  if (companyRes.error) throw companyRes.error
  if (tourRes.error) throw tourRes.error
  if (reservationRes.error) throw reservationRes.error
  if (ticketRes.error) throw ticketRes.error
  if (hotelRes.error) throw hotelRes.error

  for (const row of companyRes.data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    pushRow({
      key: expenseCashLinkRowKey('company_expenses', id),
      source_table: 'company_expenses',
      source_id: id,
      submit_date: ymdFromTimestamp(String(row.submit_on ?? '')),
      amount: Math.abs(Number(row.amount ?? 0)),
      paid_to: String(row.paid_to ?? '').trim(),
      paid_for: String(row.paid_for ?? '').trim(),
      label: String(row.description ?? row.notes ?? '').trim() || '—',
    })
  }

  for (const row of tourRes.data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    pushRow({
      key: expenseCashLinkRowKey('tour_expenses', id),
      source_table: 'tour_expenses',
      source_id: id,
      submit_date: ymdFromTimestamp(String(row.submit_on ?? row.tour_date ?? '')),
      amount: Math.abs(Number(row.amount ?? 0)),
      paid_to: String(row.paid_to ?? '').trim(),
      paid_for: String(row.paid_for ?? '').trim(),
      label: String(row.note ?? '').trim() || '—',
    })
  }

  for (const row of reservationRes.data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    pushRow({
      key: expenseCashLinkRowKey('reservation_expenses', id),
      source_table: 'reservation_expenses',
      source_id: id,
      submit_date: ymdFromTimestamp(String(row.submit_on ?? '')),
      amount: Math.abs(Number(row.amount ?? 0)),
      paid_to: String(row.paid_to ?? '').trim(),
      paid_for: String(row.paid_for ?? '').trim(),
      label: String(row.note ?? '').trim() || '—',
    })
  }

  for (const row of ticketRes.data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    pushRow({
      key: expenseCashLinkRowKey('ticket_bookings', id),
      source_table: 'ticket_bookings',
      source_id: id,
      submit_date: ymdFromTimestamp(String(row.submit_on ?? row.check_in_date ?? '')),
      amount: Math.abs(Number(row.expense ?? 0)),
      paid_to: String(row.company ?? '').trim(),
      paid_for: String(row.category ?? '').trim(),
      label: String(row.note ?? '').trim() || '—',
    })
  }

  for (const row of hotelRes.data ?? []) {
    const id = String(row.id ?? '')
    if (!id) continue
    pushRow({
      key: expenseCashLinkRowKey('tour_hotel_bookings', id),
      source_table: 'tour_hotel_bookings',
      source_id: id,
      submit_date: ymdFromTimestamp(String(row.check_in_date ?? '')),
      amount: Math.abs(Number(row.total_price ?? 0)),
      paid_to: String(row.hotel ?? '').trim(),
      paid_for: String(row.reservation_name ?? row.city ?? '').trim(),
      label: String(row.city ?? '').trim() || '—',
    })
  }

  return out
}

async function fetchPaymentPoolForCashAutoMatch(
  supabase: SupabaseClient
): Promise<PaymentPoolRow[]> {
  const cashPaymentMethods = await getCashPaymentMethodFilterValues()
  if (cashPaymentMethods.length === 0) return []

  const { data, error } = await supabase
    .from('payment_records')
    .select('id, amount, submit_on, note, payment_status')
    .in('payment_method', cashPaymentMethods)
    .order('submit_on', { ascending: false })
    .limit(1500)
  if (error) throw error

  const ids = (data ?? []).map((r) => String(r.id ?? '')).filter(Boolean)
  const reconciled = ids.length > 0 ? await fetchReconciledSourceIds(supabase, 'payment_records', ids) : new Set<string>()

  const out: PaymentPoolRow[] = []
  for (const row of data ?? []) {
    const id = String(row.id ?? '')
    if (!id || reconciled.has(id)) continue
    if (String(row.payment_status ?? '').trim() === 'Deposit Requested') continue
    const amount = Math.abs(Number(row.amount ?? 0))
    if (amount <= AMOUNT_EQUAL_EPS) continue
    out.push({
      id,
      submit_date: ymdFromTimestamp(String(row.submit_on ?? '')),
      amount,
      note: String(row.note ?? '').trim() || '—',
    })
  }
  return out
}

function buildCandidatesForCashRow(
  cash: CashAutoMatchInputRow,
  expensePool: ExpensePoolRow[],
  paymentPool: PaymentPoolRow[]
): CashAutoMatchCandidate[] {
  const cashYmd = ymdFromTimestamp(cash.transaction_date)
  const absCash = Math.abs(Number(cash.amount ?? 0))
  if (absCash <= AMOUNT_EQUAL_EPS) return []
  const tol = expenseReconciliationAmountTolerance(absCash)
  const cashText = `${cash.description} ${cash.category ?? ''}`.trim()
  const isDeposit = cash.transaction_type === 'deposit'
  const candidates: CashAutoMatchCandidate[] = []

  if (!isDeposit) {
    for (const exp of expensePool) {
      const amountDiff = Math.abs(exp.amount - absCash)
      if (amountDiff > tol) continue
      const dayDiff = cashYmd ? dayDiffFromYmd(exp.submit_date, cashYmd) : 0
      const exactBonus = amountDiff < AMOUNT_EQUAL_EPS ? 40 : 0
      const targetText = `${exp.paid_to} ${exp.paid_for} ${exp.label}`
      candidates.push({
        key: `expense:${exp.key}`,
        target_kind: 'expense',
        target_table: exp.source_table,
        target_id: exp.source_id,
        submit_date: exp.submit_date,
        amount: exp.amount,
        paid_to: exp.paid_to,
        paid_for: exp.paid_for,
        label: exp.label,
        amount_diff: amountDiff,
        day_diff: dayDiff,
        score: 100 + exactBonus - amountDiff * 10 - dayDiff * 2 + textOverlapBonus(cashText, targetText),
      })
    }
  } else if (!cash.linked_payment_record_id) {
    for (const pr of paymentPool) {
      const amountDiff = Math.abs(pr.amount - absCash)
      if (amountDiff > tol) continue
      const dayDiff = cashYmd ? dayDiffFromYmd(pr.submit_date, cashYmd) : 0
      const exactBonus = amountDiff < AMOUNT_EQUAL_EPS ? 40 : 0
      candidates.push({
        key: `payment:${pr.id}`,
        target_kind: 'payment_record',
        target_table: 'payment_records',
        target_id: pr.id,
        submit_date: pr.submit_date,
        amount: pr.amount,
        paid_to: '—',
        paid_for: pr.note,
        label: pr.note,
        amount_diff: amountDiff,
        day_diff: dayDiff,
        score: 100 + exactBonus - amountDiff * 10 - dayDiff * 2 + textOverlapBonus(cashText, pr.note),
      })
    }
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.amount_diff !== b.amount_diff) return a.amount_diff - b.amount_diff
    return a.day_diff - b.day_diff
  })

  return candidates.slice(0, CASH_TRANSACTION_AUTO_MATCH_CANDIDATE_LIMIT)
}

export function isCashTransactionAutoMatchTarget(row: CashAutoMatchInputRow): boolean {
  const abs = Math.abs(Number(row.amount ?? 0))
  if (abs <= AMOUNT_EQUAL_EPS) return false
  if (row.transaction_type === 'withdrawal') return true
  if (row.transaction_type === 'deposit') return !row.linked_payment_record_id
  return false
}

export function isCashTransactionAlreadyMatchedForAutoMatch(
  cashId: string,
  linkedCashIds: Set<string>,
  stmtReconciledCashIds: Set<string>,
  row: CashAutoMatchInputRow
): boolean {
  if (linkedCashIds.has(cashId) || stmtReconciledCashIds.has(cashId)) return true
  if (row.transaction_type === 'deposit' && row.linked_payment_record_id) return true
  return false
}

/** 현금 거래(cash_transactions) → 지출·입금(payment_records) 자동 매칭 미리보기 */
export async function prepareCashTransactionAutoMatchProposals(
  supabase: SupabaseClient,
  cashRows: CashAutoMatchInputRow[]
): Promise<{
  proposals: CashAutoMatchProposal[]
  expensePoolSize: number
  paymentPoolSize: number
  skippedAlreadyMatched: number
}> {
  const targets = cashRows
    .filter((r) => r.id && isCashTransactionAutoMatchTarget(r))
    .slice(0, CASH_TRANSACTION_AUTO_MATCH_MAX)

  const linkedExpenseKeys = await fetchCashLinkedExpenseKeys(supabase)
  const [linkedCashIds, expensePool, paymentPool] = await Promise.all([
    fetchCashLinkedCashTransactionIds(supabase),
    fetchExpensePoolForCashAutoMatch(supabase, linkedExpenseKeys),
    fetchPaymentPoolForCashAutoMatch(supabase),
  ])

  const cashIds = targets.map((t) => t.id)
  const stmtReconciled =
    cashIds.length > 0
      ? await fetchReconciledSourceIds(supabase, 'cash_transactions', cashIds)
      : new Set<string>()

  const proposals: CashAutoMatchProposal[] = []
  let skippedAlreadyMatched = 0

  for (const cash of targets) {
    if (isCashTransactionAlreadyMatchedForAutoMatch(cash.id, linkedCashIds, stmtReconciled, cash)) {
      skippedAlreadyMatched += 1
      continue
    }
    const candidates = buildCandidatesForCashRow(cash, expensePool, paymentPool).filter((c) => {
      if (c.target_kind === 'expense') {
        return !linkedExpenseKeys.has(expenseCashLinkRowKey(c.target_table, c.target_id))
      }
      return true
    })
    if (candidates.length === 0) continue
    proposals.push({
      cash_id: cash.id,
      transaction_date: ymdFromTimestamp(cash.transaction_date) || '—',
      amount: Math.abs(Number(cash.amount ?? 0)),
      direction: cash.transaction_type === 'deposit' ? 'inflow' : 'outflow',
      description: cash.description || '—',
      candidates,
    })
  }

  return {
    proposals,
    expensePoolSize: expensePool.length,
    paymentPoolSize: paymentPool.length,
    skippedAlreadyMatched,
  }
}

export function pickDefaultCashAutoMatchSelections(proposals: CashAutoMatchProposal[]): {
  selectedCashIds: Set<string>
  candidateKeyByCashId: Record<string, string>
} {
  const ranked = proposals
    .map((p) => ({ p, best: p.candidates[0], score: p.candidates[0]?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)

  const selectedCashIds = new Set<string>()
  const candidateKeyByCashId: Record<string, string> = {}
  const usedExpenseKeys = new Set<string>()
  const usedPaymentIds = new Set<string>()

  for (const { p, best } of ranked) {
    if (!best) continue
    if (best.target_kind === 'expense') {
      const ek = expenseCashLinkRowKey(best.target_table, best.target_id)
      if (usedExpenseKeys.has(ek)) continue
      usedExpenseKeys.add(ek)
    } else if (usedPaymentIds.has(best.target_id)) {
      continue
    } else {
      usedPaymentIds.add(best.target_id)
    }
    selectedCashIds.add(p.cash_id)
    candidateKeyByCashId[p.cash_id] = best.key
  }

  return { selectedCashIds, candidateKeyByCashId }
}

export async function applyCashTransactionAutoMatchProposals(
  supabase: SupabaseClient,
  params: {
    actorEmail: string
    items: {
      cash_id: string
      candidate: CashAutoMatchCandidate
      cash_amount: number
    }[]
  }
): Promise<{ applied: number; skippedConflict: number; skippedInvalid: number }> {
  const usedExpenseKeys = new Set<string>()
  const usedPaymentIds = new Set<string>()
  const usedCashIds = new Set<string>()
  let applied = 0
  let skippedConflict = 0
  let skippedInvalid = 0

  for (const item of params.items) {
    const candidate = item.candidate
    if (!candidate?.target_id) {
      skippedInvalid += 1
      continue
    }
    if (usedCashIds.has(item.cash_id)) {
      skippedConflict += 1
      continue
    }

    try {
      if (candidate.target_kind === 'expense') {
        const table = candidate.target_table as ExpenseCashLinkSourceTable
        if (!expenseSourceSupportsCashLedgerLink(table)) {
          skippedInvalid += 1
          continue
        }
        const ek = expenseCashLinkRowKey(table, candidate.target_id)
        if (usedExpenseKeys.has(ek)) {
          skippedConflict += 1
          continue
        }
        await replaceExpenseCashLedgerMatch(supabase, {
          actorEmail: params.actorEmail,
          expenseSourceTable: table,
          expenseSourceId: candidate.target_id,
          cashTransactionId: item.cash_id,
          matchedAmount: Math.min(Math.abs(item.cash_amount), candidate.amount),
        })
        usedExpenseKeys.add(ek)
        usedCashIds.add(item.cash_id)
        applied += 1
      } else {
        if (usedPaymentIds.has(candidate.target_id)) {
          skippedConflict += 1
          continue
        }
        const { error } = await supabase
          .from('cash_transactions')
          .update({
            reference_type: 'payment_record',
            reference_id: candidate.target_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.cash_id)
        if (error) throw error
        usedPaymentIds.add(candidate.target_id)
        usedCashIds.add(item.cash_id)
        applied += 1
      }
    } catch {
      skippedInvalid += 1
    }
  }

  return { applied, skippedConflict, skippedInvalid }
}
