import type { SupabaseClient } from '@supabase/supabase-js'
import {
  lookupActiveCashPaymentMethodId,
  needsResolvedCashPaymentMethodId,
} from '@/lib/cashPaymentMethodValues'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'
import { lookupTourOperatorId } from '@/lib/operators/lookupTourOperatorId'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { CashLedgerReviewSource } from '@/lib/cashLedgerReview'

export const MOVABLE_EXPENSE_TABLES = [
  'company_expenses',
  'tour_expenses',
  'reservation_expenses',
  'cash_transactions',
] as const

export type MovableExpenseTable = (typeof MOVABLE_EXPENSE_TABLES)[number]

export type MoveExpenseItem = {
  table: MovableExpenseTable
  id: string
}

export const MOVABLE_EXPENSE_TABLE_LABEL: Record<MovableExpenseTable, string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
  reservation_expenses: '예약 지출',
  cash_transactions: '현금 출금',
}

export function isMovableExpenseTable(value: string | null | undefined): value is MovableExpenseTable {
  return (
    value === 'company_expenses' ||
    value === 'tour_expenses' ||
    value === 'reservation_expenses' ||
    value === 'cash_transactions'
  )
}

const CASH_LEDGER_REVIEW_SOURCES = new Set<string>([
  'cash_transactions',
  'payment_records',
  'company_expenses',
  'reservation_expenses',
])

function isCashLedgerReviewSource(table: string): table is CashLedgerReviewSource {
  return CASH_LEDGER_REVIEW_SOURCES.has(table)
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function isoToYmd(value: unknown): string | null {
  const s = str(value)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdToIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString()
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function ignoreMissingTable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || String(error?.message ?? '').includes('does not exist')
}

type CommonExpenseFields = {
  amount: number
  submitOnIso: string
  paidTo: string
  paidFor: string
  paymentMethod: string | null
  description: string | null
  note: string | null
  category: string | null
  photoUrl: string | null
  filePath: string | null
  submitBy: string
  operatorId: string | null
  status: string | null
  statementLineId: string | null
  reimbursedAmount: number
  reimbursedOn: string | null
  reimbursementNote: string | null
  reservationId: string | null
  tourId: string | null
  transactionType: string | null
}

function readCommon(table: MovableExpenseTable, row: Record<string, unknown>): CommonExpenseFields {
  const amount = Math.abs(num(row.amount) ?? 0)
  const dateRaw =
    table === 'cash_transactions' ? row.transaction_date ?? row.submit_on : row.submit_on ?? row.transaction_date
  const ymd = isoToYmd(dateRaw) || isoToYmd(new Date().toISOString()) || new Date().toISOString().slice(0, 10)
  const paidFor =
    str(row.paid_for) ||
    str(row.category) ||
    str(row.description) ||
    '기타'
  const description =
    table === 'cash_transactions' || table === 'company_expenses'
      ? str(row.description) || null
      : str(row.note) || str(row.description) || null
  const note =
    table === 'company_expenses' || table === 'cash_transactions'
      ? str(row.notes) || null
      : str(row.note) || str(row.notes) || null
  const submitBy =
    str(row.submit_by) ||
    str(row.submitted_by) ||
    str(row.created_by) ||
    ''
  return {
    amount,
    submitOnIso: typeof dateRaw === 'string' && dateRaw.includes('T') ? dateRaw : ymdToIso(ymd),
    paidTo: str(row.paid_to),
    paidFor,
    paymentMethod: str(row.payment_method) || null,
    description,
    note,
    category: str(row.category) || str(row.paid_for) || null,
    photoUrl: str(row.photo_url) || str(row.image_url) || null,
    filePath: str(row.file_path) || null,
    submitBy,
    operatorId: str(row.operator_id) || null,
    status: str(row.status) || 'pending',
    statementLineId: str(row.statement_line_id) || null,
    reimbursedAmount: Math.max(0, num(row.reimbursed_amount) ?? 0),
    reimbursedOn: isoToYmd(row.reimbursed_on),
    reimbursementNote: str(row.reimbursement_note) || null,
    reservationId: str(row.reservation_id) || null,
    tourId: str(row.tour_id) || null,
    transactionType: str(row.transaction_type) || null,
  }
}

async function fetchSourceRow(
  sb: SupabaseClient,
  table: MovableExpenseTable,
  id: string
): Promise<Record<string, unknown>> {
  let query = fromUntypedTable(sb, table).select('*').eq('id', id)
  if (table !== 'cash_transactions') {
    query = query.is('deleted_at', null)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('원본 지출을 찾을 수 없습니다. 이미 삭제되었거나 없는 건입니다.')
  return data as Record<string, unknown>
}

async function remapLinkedRows(
  sb: SupabaseClient,
  fromTable: MovableExpenseTable,
  fromId: string,
  toTable: MovableExpenseTable,
  toId: string
): Promise<void> {
  const { error: matchErr } = await sb
    .from('reconciliation_matches')
    .update({ source_table: toTable, source_id: toId })
    .eq('source_table', fromTable)
    .eq('source_id', fromId)
  if (matchErr && !ignoreMissingTable(matchErr)) throw matchErr

  const { error: exemptErr } = await fromUntypedTable(sb, 'expense_reconciliation_exemptions')
    .update({ source_table: toTable, source_id: toId })
    .eq('source_table', fromTable)
    .eq('source_id', fromId)
  if (exemptErr && !ignoreMissingTable(exemptErr)) throw exemptErr

  const fromReview = isCashLedgerReviewSource(fromTable)
  const toReview = isCashLedgerReviewSource(toTable)
  if (fromReview && toReview) {
    const { error: reviewErr } = await fromUntypedTable(sb, 'cash_ledger_reviews')
      .update({ source: toTable, source_id: toId, updated_at: new Date().toISOString() })
      .eq('source', fromTable)
      .eq('source_id', fromId)
    if (reviewErr && !ignoreMissingTable(reviewErr)) throw reviewErr
    const { error: notifyErr } = await fromUntypedTable(sb, 'cash_withdrawal_notifications')
      .update({ source: toTable, source_id: toId })
      .eq('source', fromTable)
      .eq('source_id', fromId)
    if (notifyErr && !ignoreMissingTable(notifyErr)) throw notifyErr
  } else if (fromReview) {
    const { error: reviewDelErr } = await fromUntypedTable(sb, 'cash_ledger_reviews')
      .delete()
      .eq('source', fromTable)
      .eq('source_id', fromId)
    if (reviewDelErr && !ignoreMissingTable(reviewDelErr)) throw reviewDelErr
    const { error: notifyDelErr } = await fromUntypedTable(sb, 'cash_withdrawal_notifications')
      .delete()
      .eq('source', fromTable)
      .eq('source_id', fromId)
    if (notifyDelErr && !ignoreMissingTable(notifyDelErr)) throw notifyDelErr
  }

  if (fromTable === 'cash_transactions') {
    const { error } = await fromUntypedTable(sb, 'expense_cash_ledger_matches')
      .delete()
      .eq('cash_transaction_id', fromId)
    if (error && !ignoreMissingTable(error)) throw error
  } else if (toTable === 'cash_transactions') {
    const { error } = await fromUntypedTable(sb, 'expense_cash_ledger_matches')
      .delete()
      .eq('expense_source_table', fromTable)
      .eq('expense_source_id', fromId)
    if (error && !ignoreMissingTable(error)) throw error
  } else {
    const { error } = await fromUntypedTable(sb, 'expense_cash_ledger_matches')
      .update({ expense_source_table: toTable, expense_source_id: toId })
      .eq('expense_source_table', fromTable)
      .eq('expense_source_id', fromId)
    if (error && !ignoreMissingTable(error)) throw error
  }
}

async function retireSource(
  sb: SupabaseClient,
  table: MovableExpenseTable,
  id: string,
  actorEmail: string,
  oldValues: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString()
  if (table === 'cash_transactions') {
    const { error: histErr } = await sb.from('cash_transaction_history').insert({
      transaction_id: id,
      source_table: 'cash_transactions',
      change_type: 'deleted',
      old_values: { ...oldValues, moved_to_other_table: true },
      new_values: null,
      modified_by: actorEmail,
      modified_at: now,
    })
    if (histErr && !ignoreMissingTable(histErr)) {
      console.warn('현금 이동 히스토리 저장 실패:', histErr)
    }
    const { error } = await sb.from('cash_transactions').delete().eq('id', id)
    if (error) throw error
    return
  }

  const { error } = await fromUntypedTable(sb, table)
    .update({
      deleted_at: now,
      deleted_by: actorEmail || null,
      updated_at: now,
    })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
}

async function insertCompanyExpense(
  sb: SupabaseClient,
  fields: CommonExpenseFields,
  actorEmail: string
): Promise<string> {
  const paidTo = fields.paidTo || '(미지정)'
  const paymentMethod = fields.paymentMethod || (await lookupActiveCashPaymentMethodId(sb))
  const { data, error } = await sb
    .from('company_expenses')
    .insert({
      paid_to: paidTo,
      paid_for: fields.paidFor,
      amount: fields.amount,
      payment_method: paymentMethod,
      submit_on: fields.submitOnIso,
      submit_by: fields.submitBy || actorEmail,
      description: fields.description,
      notes: fields.note,
      category: fields.category,
      photo_url: fields.photoUrl,
      status: fields.status || 'pending',
      operator_id: resolveOperatorId(fields.operatorId),
      reimbursed_amount: fields.reimbursedAmount,
      reimbursed_on: fields.reimbursedOn,
      reimbursement_note: fields.reimbursementNote,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = str((data as { id?: string } | null)?.id)
  if (!id) throw new Error('회사 지출을 만들지 못했습니다.')
  return id
}

async function insertTourExpense(
  sb: SupabaseClient,
  fields: CommonExpenseFields,
  actorEmail: string,
  tour: { id: string; tour_date: string; product_id: string | null }
): Promise<string> {
  const operatorId = await lookupTourOperatorId(sb, tour.id, fields.operatorId)
  const { data, error } = await sb
    .from('tour_expenses')
    .insert({
      tour_id: tour.id,
      tour_date: tour.tour_date,
      product_id: tour.product_id,
      paid_to: fields.paidTo || null,
      paid_for: fields.paidFor,
      amount: fields.amount,
      payment_method: fields.paymentMethod,
      note: fields.note || fields.description,
      image_url: fields.photoUrl,
      file_path: fields.filePath,
      submitted_by: fields.submitBy || actorEmail,
      submit_on: fields.submitOnIso,
      status: fields.status || 'pending',
      operator_id: operatorId,
      reimbursed_amount: fields.reimbursedAmount,
      reimbursed_on: fields.reimbursedOn,
      reimbursement_note: fields.reimbursementNote,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = str((data as { id?: string } | null)?.id)
  if (!id) throw new Error('투어 지출을 만들지 못했습니다.')
  return id
}

async function insertReservationExpense(
  sb: SupabaseClient,
  fields: CommonExpenseFields,
  actorEmail: string,
  reservation: { id: string; tour_id: string | null }
): Promise<string> {
  const operatorId = await lookupReservationOperatorId(sb, reservation.id, fields.operatorId)
  const id = newId()
  const { error } = await sb.from('reservation_expenses').insert({
    id,
    reservation_id: reservation.id,
    tour_id: reservation.tour_id,
    paid_to: fields.paidTo || '(미지정)',
    paid_for: fields.paidFor,
    amount: fields.amount,
    payment_method: fields.paymentMethod,
    note: fields.note || fields.description,
    image_url: fields.photoUrl,
    file_path: fields.filePath,
    submitted_by: fields.submitBy || actorEmail,
    submit_on: fields.submitOnIso,
    status: fields.status || 'pending',
    operator_id: operatorId,
    reimbursed_amount: fields.reimbursedAmount,
    reimbursed_on: fields.reimbursedOn,
    reimbursement_note: fields.reimbursementNote,
  } as never)
  if (error) throw error
  return id
}

async function insertCashWithdrawal(
  sb: SupabaseClient,
  fields: CommonExpenseFields,
  actorEmail: string
): Promise<string> {
  const { data, error } = await sb
    .from('cash_transactions')
    .insert({
      transaction_type: 'withdrawal',
      amount: fields.amount,
      transaction_date: fields.submitOnIso,
      description: fields.description || fields.paidFor,
      paid_to: fields.paidTo || null,
      category: fields.category,
      notes: fields.note,
      created_by: actorEmail || fields.submitBy || 'system',
      operator_id: resolveOperatorId(fields.operatorId),
    })
    .select('id')
    .single()
  if (error) throw error
  const id = str((data as { id?: string } | null)?.id)
  if (!id) throw new Error('현금 출금을 만들지 못했습니다.')
  const { error: histErr } = await sb.from('cash_transaction_history').insert({
    transaction_id: id,
    source_table: 'cash_transactions',
    change_type: 'created',
    old_values: null,
    new_values: { moved_from_other_table: true, amount: fields.amount, paid_to: fields.paidTo },
    modified_by: actorEmail,
    modified_at: new Date().toISOString(),
  })
  if (histErr && !ignoreMissingTable(histErr)) {
    console.warn('현금 이동 생성 히스토리 저장 실패:', histErr)
  }
  return id
}

export type MoveExpenseDestOptions = {
  destTable: MovableExpenseTable
  tourId?: string | null
  reservationId?: string | null
  actorEmail: string
}

export type MoveExpenseResult = {
  moved: number
  skipped: Array<{ id: string; table: MovableExpenseTable; reason: string }>
}

export async function moveExpenseToTable(
  sb: SupabaseClient,
  item: MoveExpenseItem,
  options: MoveExpenseDestOptions
): Promise<{ toTable: MovableExpenseTable; toId: string }> {
  const fromTable = item.table
  const fromId = item.id.trim()
  const destTable = options.destTable
  if (!fromId) throw new Error('지출 ID가 없습니다.')
  if (fromTable === destTable) {
    throw new Error(`이미 ${MOVABLE_EXPENSE_TABLE_LABEL[destTable]}입니다.`)
  }

  const row = await fetchSourceRow(sb, fromTable, fromId)
  const fields = readCommon(fromTable, row)
  if (fields.amount <= 0) throw new Error('금액이 없는 건은 옮길 수 없습니다.')

  if (fromTable === 'cash_transactions' && fields.transactionType && fields.transactionType !== 'withdrawal') {
    throw new Error('현금 입금은 지출 테이블로 옮길 수 없습니다.')
  }

  if (needsResolvedCashPaymentMethodId(fields.paymentMethod, fromTable === 'cash_transactions')) {
    fields.paymentMethod = await lookupActiveCashPaymentMethodId(sb)
  }

  const actorEmail = str(options.actorEmail)
  let toId = ''

  if (destTable === 'company_expenses') {
    toId = await insertCompanyExpense(sb, fields, actorEmail)
  } else if (destTable === 'tour_expenses') {
    const tourId = str(options.tourId) || fields.tourId
    if (!tourId) throw new Error('투어를 선택하세요.')
    const { data: tour, error: tourErr } = await sb
      .from('tours')
      .select('id, tour_date, product_id')
      .eq('id', tourId)
      .maybeSingle()
    if (tourErr) throw tourErr
    if (!tour?.id || !tour.tour_date) throw new Error('선택한 투어를 찾을 수 없습니다.')
    toId = await insertTourExpense(
      sb,
      fields,
      actorEmail,
      {
        id: String(tour.id),
        tour_date: String(tour.tour_date).slice(0, 10),
        product_id: tour.product_id ? String(tour.product_id) : null,
      }
    )
  } else if (destTable === 'reservation_expenses') {
    const reservationId = str(options.reservationId) || fields.reservationId
    if (!reservationId) throw new Error('예약 ID를 입력하세요.')
    const { data: reservation, error: rezErr } = await sb
      .from('reservations')
      .select('id, tour_id')
      .eq('id', reservationId)
      .maybeSingle()
    if (rezErr) throw rezErr
    if (!reservation?.id) throw new Error('예약을 찾을 수 없습니다.')
    toId = await insertReservationExpense(sb, fields, actorEmail, {
      id: String(reservation.id),
      tour_id: reservation.tour_id ? String(reservation.tour_id) : null,
    })
  } else {
    toId = await insertCashWithdrawal(sb, fields, actorEmail)
  }

  await remapLinkedRows(sb, fromTable, fromId, destTable, toId)
  await retireSource(sb, fromTable, fromId, actorEmail, row)
  return { toTable: destTable, toId }
}

export async function moveExpensesToTable(
  sb: SupabaseClient,
  items: MoveExpenseItem[],
  options: MoveExpenseDestOptions
): Promise<MoveExpenseResult> {
  const skipped: MoveExpenseResult['skipped'] = []
  let moved = 0
  const seen = new Set<string>()
  for (const item of items) {
    const key = `${item.table}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    try {
      await moveExpenseToTable(sb, item, options)
      moved += 1
    } catch (error) {
      skipped.push({
        id: item.id,
        table: item.table,
        reason: error instanceof Error ? error.message : '이동에 실패했습니다.',
      })
    }
  }
  return { moved, skipped }
}
