import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addCalendarDaysYmd,
  expenseReconciliationAmountTolerance,
  RECON_EXPENSE_LEDGER_DAY_WINDOW,
  type ExpenseReconSourceTable,
} from '@/lib/expense-reconciliation-similar-lines'
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

export async function fetchCashLedgerMatchedExpenseIds(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceIds: string[]
): Promise<Set<string>> {
  const ids = sourceIds.filter(Boolean)
  if (ids.length === 0) return new Set()
  const { data, error } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches')
    .select('expense_source_id')
    .eq('expense_source_table', sourceTable)
    .in('expense_source_id', ids)
  if (error || !data) return new Set()
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
  const { data: links, error: linkErr } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches')
    .select('cash_transaction_id, matched_amount')
    .eq('expense_source_table', sourceTable)
    .eq('expense_source_id', sourceId)
  if (linkErr) throw linkErr
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

  const { error: delErr } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches')
    .delete()
    .eq('expense_source_table', expenseSourceTable)
    .eq('expense_source_id', expenseSourceId)
  if (delErr) throw delErr

  const matchedAmount =
    params.matchedAmount != null && Number.isFinite(Number(params.matchedAmount))
      ? Math.abs(Number(params.matchedAmount))
      : null

  const { error: insErr } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches').insert({
    expense_source_table: expenseSourceTable,
    expense_source_id: expenseSourceId,
    cash_transaction_id: cashTransactionId,
    matched_amount: matchedAmount,
    matched_by: actorEmail || null,
  })
  if (insErr) throw insErr
}

export async function unlinkExpenseCashLedgerMatches(
  supabase: SupabaseClient,
  expenseSourceTable: ExpenseReconSourceTable,
  expenseSourceId: string
): Promise<void> {
  const { error } = await fromUntypedTable(supabase, 'expense_cash_ledger_matches')
    .delete()
    .eq('expense_source_table', expenseSourceTable)
    .eq('expense_source_id', expenseSourceId)
  if (error) throw error
}
