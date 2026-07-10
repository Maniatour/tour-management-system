import type { SupabaseClient } from '@supabase/supabase-js'
import { expenseSourceKey, type UnifiedExpenseSourceTable } from '@/lib/expense-unified-duplicate-scan'
import type { UnifiedLedgerDuplicateExpenseRow } from '@/lib/expense-unified-duplicate-scan'
import type { UnifiedExpenseEditDraft } from '@/lib/unified-expense-edit'

export type ExpenseVendorUsageType = 'reusable' | 'one_time'

export type ExpenseVendorRecord = {
  id: string
  name: string
  usage_type: ExpenseVendorUsageType
  match_aliases?: string[]
  created_at?: string | null
}

export function parseVendorMatchAliasesInput(raw: string): string[] {
  return [...new Set(raw.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean))]
}

export const EXPENSE_VENDOR_USAGE_TYPES: ExpenseVendorUsageType[] = ['reusable', 'one_time']

export function expenseVendorUsageLabel(type: ExpenseVendorUsageType): string {
  return type === 'reusable' ? '재사용' : '1회'
}

export function isReusableExpenseVendor(v: Pick<ExpenseVendorRecord, 'usage_type'>): boolean {
  return v.usage_type === 'reusable'
}

/** company / reservation / tour 지출 paid_to 일괄 치환 */
export async function replacePaidToAcrossExpenseTables(
  client: SupabaseClient,
  fromName: string,
  toName: string
): Promise<void> {
  if (!fromName.trim() || !toName.trim() || fromName === toName) return
  const results = await Promise.all([
    client.from('company_expenses').update({ paid_to: toName }).eq('paid_to', fromName),
    client.from('reservation_expenses').update({ paid_to: toName }).eq('paid_to', fromName),
    client.from('tour_expenses').update({ paid_to: toName }).eq('paid_to', fromName),
  ])
  for (const r of results) {
    if (r.error) throw r.error
  }
}

/** 여러 결제처 이름을 targetName 으로 병합 (지출 데이터 갱신) */
export async function mergePaidToNamesAcrossExpenseTables(
  client: SupabaseClient,
  sourceNames: string[],
  targetName: string
): Promise<void> {
  const target = targetName.trim()
  if (!target) return
  const uniqueSources = [...new Set(sourceNames.map((n) => n.trim()).filter((n) => n && n !== target))]
  for (const from of uniqueSources) {
    await replacePaidToAcrossExpenseTables(client, from, target)
  }
}

export type VendorLinkedExpenseSource = 'company' | 'reservation' | 'tour'

export type VendorLinkedExpenseRow = {
  id: string
  source: VendorLinkedExpenseSource
  paid_to: string | null
  paid_for: string | null
  standard_paid_for: string | null
  category: string | null
  subcategory: string | null
  amount: number | null
  submit_on: string | null
  status: string | null
  submit_by: string | null
  ref_id: string | null
  description: string | null
  notes: string | null
  payment_method: string | null
  image_url: string | null
  photo_url: string | null
  file_path: string | null
  tour_date: string | null
  product_id: string | null
  event_id: string | null
  expense_type: string | null
  tax_deductible: boolean | null
  vehicle_id: string | null
  maintenance_type: string | null
  paid_to_employee_email: string | null
  reimbursed_amount: number | null
  reimbursed_on: string | null
  reimbursement_note: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  created_at: string | null
  updated_at: string | null
}

export function vendorLinkedExpenseEditKey(row: VendorLinkedExpenseRow): string {
  return `${row.source}:${row.id}`
}

export function vendorLinkedExpenseSourceTable(source: VendorLinkedExpenseSource): UnifiedExpenseSourceTable {
  if (source === 'company') return 'company_expenses'
  if (source === 'reservation') return 'reservation_expenses'
  return 'tour_expenses'
}

function isoToYmd(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = String(iso).trim()
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function vendorLinkedExpenseToEditDraft(row: VendorLinkedExpenseRow): UnifiedExpenseEditDraft {
  const std = (row.standard_paid_for ?? '').trim()
  const paidFor =
    row.source === 'company' && std ? std : (row.paid_for ?? '').trim()
  return {
    amount: row.amount != null && Number.isFinite(row.amount) ? String(row.amount) : '',
    submitDate: isoToYmd(row.submit_on),
    paid_to: (row.paid_to ?? '').trim(),
    paid_for: paidFor,
    category: (row.category ?? '').trim(),
    company: '',
    note: (row.description ?? '').trim(),
    payment_method: (row.payment_method ?? '').trim(),
  }
}

export function vendorLinkedExpenseToUnifiedRow(row: VendorLinkedExpenseRow): UnifiedLedgerDuplicateExpenseRow {
  const source_table = vendorLinkedExpenseSourceTable(row.source)
  return {
    id: row.id,
    amount: row.amount,
    submit_on: row.submit_on,
    paid_to: row.paid_to,
    paid_for: row.paid_for,
    description: row.description,
    category: row.category,
    status: row.status,
    statement_line_id: null,
    ledger_expense_origin: null,
    reconciled_statement_line_id: null,
    standard_paid_for: row.standard_paid_for,
    payment_method: row.payment_method,
    display_payment_method: '—',
    display_statement_status: '—',
    display_financial_account: '—',
    source_table,
    source_key: expenseSourceKey(source_table, row.id),
    source_context: null,
    tour_reference: null,
    detail_tour_id: row.source === 'tour' ? row.ref_id : null,
    detail_reservation_id: row.source === 'reservation' ? row.ref_id : null,
    deleted_at: null,
    deleted_by: null,
  }
}

const VENDOR_EXPENSE_LIMIT = 50

const SOURCE_LABEL: Record<VendorLinkedExpenseSource, string> = {
  company: '회사 지출',
  reservation: '예약 지출',
  tour: '투어 지출',
}

export function vendorLinkedExpenseSourceLabel(source: VendorLinkedExpenseSource): string {
  return SOURCE_LABEL[source]
}

function parseSubmitOnMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/** 결제처(paid_to)와 연결된 회사·예약·투어 지출 (최근순, 출처별 상한) */
export async function fetchExpensesForVendorPaidTo(
  client: SupabaseClient,
  paidTo: string
): Promise<VendorLinkedExpenseRow[]> {
  const name = paidTo.trim()
  if (!name) return []

  const [companyRes, reservationRes, tourRes] = await Promise.all([
    client
      .from('company_expenses')
      .select(
        'id, paid_to, paid_for, standard_paid_for, category, subcategory, amount, submit_on, status, submit_by, description, notes, payment_method, photo_url, expense_type, tax_deductible, vehicle_id, maintenance_type, paid_to_employee_email, reimbursed_amount, reimbursed_on, reimbursement_note, created_at, updated_at'
      )
      .eq('paid_to', name)
      .is('deleted_at', null)
      .order('submit_on', { ascending: false })
      .limit(VENDOR_EXPENSE_LIMIT),
    client
      .from('reservation_expenses')
      .select(
        'id, paid_to, paid_for, amount, submit_on, status, submitted_by, reservation_id, event_id, note, payment_method, image_url, file_path, audited_by, checked_by, checked_on, reimbursed_amount, reimbursed_on, reimbursement_note, created_at, updated_at'
      )
      .eq('paid_to', name)
      .is('deleted_at', null)
      .order('submit_on', { ascending: false })
      .limit(VENDOR_EXPENSE_LIMIT),
    client
      .from('tour_expenses')
      .select(
        'id, paid_to, paid_for, amount, submit_on, status, submitted_by, tour_id, tour_date, product_id, note, payment_method, image_url, file_path, audited_by, checked_by, checked_on, reimbursed_amount, reimbursed_on, reimbursement_note, created_at, updated_at'
      )
      .eq('paid_to', name)
      .is('deleted_at', null)
      .order('submit_on', { ascending: false })
      .limit(VENDOR_EXPENSE_LIMIT),
  ])

  if (companyRes.error) throw companyRes.error
  if (reservationRes.error) throw reservationRes.error
  if (tourRes.error) throw tourRes.error

  const rows: VendorLinkedExpenseRow[] = []

  for (const r of companyRes.data ?? []) {
    rows.push({
      id: String(r.id),
      source: 'company',
      paid_to: r.paid_to ?? null,
      paid_for: r.paid_for ?? null,
      standard_paid_for: r.standard_paid_for ?? null,
      category: r.category ?? null,
      subcategory: r.subcategory ?? null,
      amount: r.amount != null ? Number(r.amount) : null,
      submit_on: r.submit_on ?? null,
      status: r.status ?? null,
      submit_by: r.submit_by ?? null,
      ref_id: null,
      description: r.description ?? null,
      notes: r.notes ?? null,
      payment_method: r.payment_method ?? null,
      image_url: null,
      photo_url: r.photo_url ?? null,
      file_path: null,
      tour_date: null,
      product_id: null,
      event_id: null,
      expense_type: r.expense_type ?? null,
      tax_deductible: r.tax_deductible ?? null,
      vehicle_id: r.vehicle_id ?? null,
      maintenance_type: r.maintenance_type ?? null,
      paid_to_employee_email: r.paid_to_employee_email ?? null,
      reimbursed_amount: r.reimbursed_amount != null ? Number(r.reimbursed_amount) : null,
      reimbursed_on: r.reimbursed_on ?? null,
      reimbursement_note: r.reimbursement_note ?? null,
      audited_by: null,
      checked_by: null,
      checked_on: null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    })
  }

  for (const r of reservationRes.data ?? []) {
    rows.push({
      id: String(r.id),
      source: 'reservation',
      paid_to: r.paid_to ?? null,
      paid_for: r.paid_for ?? null,
      standard_paid_for: null,
      category: null,
      subcategory: null,
      amount: r.amount != null ? Number(r.amount) : null,
      submit_on: r.submit_on ?? null,
      status: r.status ?? null,
      submit_by: r.submitted_by ?? null,
      ref_id: r.reservation_id ?? null,
      description: r.note ?? null,
      notes: null,
      payment_method: r.payment_method ?? null,
      image_url: r.image_url ?? null,
      photo_url: null,
      file_path: r.file_path ?? null,
      tour_date: null,
      product_id: null,
      event_id: r.event_id ?? null,
      expense_type: null,
      tax_deductible: null,
      vehicle_id: null,
      maintenance_type: null,
      paid_to_employee_email: null,
      reimbursed_amount: r.reimbursed_amount != null ? Number(r.reimbursed_amount) : null,
      reimbursed_on: r.reimbursed_on ?? null,
      reimbursement_note: r.reimbursement_note ?? null,
      audited_by: r.audited_by ?? null,
      checked_by: r.checked_by ?? null,
      checked_on: r.checked_on ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    })
  }

  for (const r of tourRes.data ?? []) {
    rows.push({
      id: String(r.id),
      source: 'tour',
      paid_to: r.paid_to ?? null,
      paid_for: r.paid_for ?? null,
      standard_paid_for: null,
      category: null,
      subcategory: null,
      amount: r.amount != null ? Number(r.amount) : null,
      submit_on: r.submit_on ?? null,
      status: r.status ?? null,
      submit_by: r.submitted_by ?? null,
      ref_id: r.tour_id ?? null,
      description: r.note ?? null,
      notes: null,
      payment_method: r.payment_method ?? null,
      image_url: r.image_url ?? null,
      photo_url: null,
      file_path: r.file_path ?? null,
      tour_date: r.tour_date ?? null,
      product_id: r.product_id ?? null,
      event_id: null,
      expense_type: null,
      tax_deductible: null,
      vehicle_id: null,
      maintenance_type: null,
      paid_to_employee_email: null,
      reimbursed_amount: r.reimbursed_amount != null ? Number(r.reimbursed_amount) : null,
      reimbursed_on: r.reimbursed_on ?? null,
      reimbursement_note: r.reimbursement_note ?? null,
      audited_by: r.audited_by ?? null,
      checked_by: r.checked_by ?? null,
      checked_on: r.checked_on ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    })
  }

  rows.sort((a, b) => parseSubmitOnMs(b.submit_on) - parseSubmitOnMs(a.submit_on))
  return rows
}

export function formatVendorExpensePaidFor(row: VendorLinkedExpenseRow): string {
  const std = (row.standard_paid_for ?? '').trim()
  if (std) return std
  return (row.paid_for ?? '').trim() || '—'
}

export function formatVendorExpenseAmount(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `$${amount.toFixed(2)}`
}

export function formatVendorExpenseDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('ko-KR')
}

export function vendorLinkedExpenseReceiptUrl(row: VendorLinkedExpenseRow): string | null {
  const url = (row.image_url ?? row.photo_url ?? '').trim()
  return url || null
}

export function formatVendorExpenseDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR')
}

const PAID_TO_PAGE_SIZE = 1000

/** 회사·예약·투어 지출에 실제로 쓰인 paid_to (삭제 제외, 공백 trim) */
export async function fetchPaidToNamesInUse(client: SupabaseClient): Promise<Set<string>> {
  const names = new Set<string>()
  const tables = ['company_expenses', 'reservation_expenses', 'tour_expenses'] as const

  for (const table of tables) {
    let from = 0
    while (true) {
      const { data, error } = await client
        .from(table)
        .select('paid_to')
        .is('deleted_at', null)
        .not('paid_to', 'is', null)
        .range(from, from + PAID_TO_PAGE_SIZE - 1)
      if (error) throw error
      const rows = data ?? []
      for (const row of rows) {
        const n = String((row as { paid_to: string | null }).paid_to ?? '').trim()
        if (n) names.add(n)
      }
      if (rows.length < PAID_TO_PAGE_SIZE) break
      from += PAID_TO_PAGE_SIZE
    }
  }

  return names
}

/** 결제처 이름 일괄 변경 + 재사용 설정 (지출 paid_to·벤더 레코드 동기화) */
export async function renameExpenseVendorAsReusable(
  client: SupabaseClient,
  vendorId: string,
  newName: string,
  opts?: { keepOldNameAsAlias?: boolean }
): Promise<{ vendorId: string; name: string }> {
  const target = newName.trim()
  if (!target) throw new Error('새 이름을 입력하세요.')

  const { data: vendor, error } = await client
    .from('expense_vendors')
    .select('id, name, usage_type, match_aliases')
    .eq('id', vendorId)
    .single()
  if (error || !vendor) throw error || new Error('결제처를 찾을 수 없습니다.')

  const oldName = String(vendor.name ?? '').trim()
  if (!oldName) throw new Error('결제처 이름이 비어 있습니다.')

  const { data: allVendors, error: allErr } = await client
    .from('expense_vendors')
    .select('id, name, usage_type, match_aliases')
  if (allErr) throw allErr

  const existingTarget =
    (allVendors ?? []).find(
      (v) =>
        v.id !== vendorId && String(v.name ?? '').trim().toLowerCase() === target.toLowerCase()
    ) ?? null

  if (oldName.toLowerCase() !== target.toLowerCase()) {
    await replacePaidToAcrossExpenseTables(client, oldName, target)
  }

  if (existingTarget) {
    const aliases = new Set(
      [...(existingTarget.match_aliases ?? []), ...(vendor.match_aliases ?? [])]
        .map((a) => String(a).trim())
        .filter(Boolean)
    )
    if (opts?.keepOldNameAsAlias !== false && oldName.toLowerCase() !== target.toLowerCase()) {
      aliases.add(oldName)
    }
    const { error: upErr } = await client
      .from('expense_vendors')
      .update({
        usage_type: 'reusable',
        match_aliases: [...aliases],
      })
      .eq('id', existingTarget.id)
    if (upErr) throw upErr

    const { error: delErr } = await client.from('expense_vendors').delete().eq('id', vendorId)
    if (delErr) throw delErr

    return { vendorId: existingTarget.id, name: String(existingTarget.name).trim() }
  }

  const aliases = (vendor.match_aliases ?? []).map((a) => String(a).trim()).filter(Boolean)
  const { error: upErr } = await client
    .from('expense_vendors')
    .update({
      name: target,
      usage_type: 'reusable',
      match_aliases: aliases,
    })
    .eq('id', vendorId)
  if (upErr) throw upErr

  return { vendorId, name: target }
}

/** 지출과 연결되지 않은 expense_vendors 행 삭제 */
export async function deleteOrphanExpenseVendors(client: SupabaseClient): Promise<number> {
  const inUse = await fetchPaidToNamesInUse(client)
  const { data, error } = await client.from('expense_vendors').select('id, name')
  if (error) throw error

  const orphanIds = (data ?? [])
    .filter((row) => {
      const name = String(row.name ?? '').trim()
      return name && !inUse.has(name)
    })
    .map((row) => row.id)

  if (orphanIds.length === 0) return 0

  const { error: delErr } = await client.from('expense_vendors').delete().in('id', orphanIds)
  if (delErr) throw delErr
  return orphanIds.length
}
