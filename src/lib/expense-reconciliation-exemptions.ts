import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE = 'expense_reconciliation_exemptions'

/** 명세·현금 대조 면제 가능 원장 */
export const RECON_EXEMPT_SOURCE_TABLES = new Set<ExpenseReconSourceTable>([
  'company_expenses',
  'reservation_expenses',
  'tour_expenses',
  'ticket_bookings',
  'tour_hotel_bookings',
  'payment_records',
  'cash_transactions',
])

export function expenseReconExemptSourceSupported(sourceTable: string): boolean {
  return RECON_EXEMPT_SOURCE_TABLES.has(sourceTable as ExpenseReconSourceTable)
}

export function expenseReconExemptRowKey(sourceTable: string, sourceId: string): string {
  return `${sourceTable}:${sourceId}`
}

let exemptionsTableUnavailable = false

function markExemptionsTableUnavailable(err: { code?: string; message?: string } | null): void {
  if (err?.code === '42P01' || String(err?.message ?? '').includes('expense_reconciliation_exemptions')) {
    exemptionsTableUnavailable = true
  }
}

export async function fetchReconciliationExemptSourceIds(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceIds: string[]
): Promise<Set<string>> {
  const ids = sourceIds.filter(Boolean)
  if (ids.length === 0 || exemptionsTableUnavailable) return new Set()
  if (!expenseReconExemptSourceSupported(sourceTable)) return new Set()

  const { data, error } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE)
    .select('source_id')
    .eq('source_table', sourceTable)
    .in('source_id', ids)
  if (error) {
    markExemptionsTableUnavailable(error)
    return new Set()
  }
  return new Set(
    ((data ?? []) as { source_id?: string }[])
      .map((r) => String(r.source_id ?? '').trim())
      .filter(Boolean)
  )
}

export async function fetchReconciliationExemptSourceIdsBatched(
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
    const s = await fetchReconciliationExemptSourceIds(supabase, sourceTable, chunk)
    s.forEach((id) => out.add(id))
  }
  return out
}

export async function fetchReconciliationExemptKeysForSources(
  supabase: SupabaseClient,
  byTable: Map<string, string[]>
): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const [table, ids] of byTable) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) continue
    const exempt = await fetchReconciliationExemptSourceIds(supabase, table, unique)
    for (const id of exempt) keys.add(expenseReconExemptRowKey(table, id))
  }
  return keys
}

const BULK_EXEMPT_CHUNK = 100

export type BulkExemptResult = {
  requested: number
  updated: number
}

export async function bulkSetExpenseReconciliationExempt(
  supabase: SupabaseClient,
  params: {
    sourceTable: ExpenseReconSourceTable
    sourceIds: string[]
    exempt: boolean
    actorEmail?: string | null
    note?: string | null
  }
): Promise<BulkExemptResult> {
  const { sourceTable, exempt, actorEmail, note } = params
  const ids = [...new Set(params.sourceIds.map((id) => id.trim()).filter(Boolean))]
  const requested = ids.length
  if (requested === 0) return { requested: 0, updated: 0 }
  if (!expenseReconExemptSourceSupported(sourceTable)) {
    throw new Error('이 원장 유형은 대조 면제를 지원하지 않습니다.')
  }

  let updated = 0
  for (let i = 0; i < ids.length; i += BULK_EXEMPT_CHUNK) {
    const chunk = ids.slice(i, i + BULK_EXEMPT_CHUNK)
    if (!exempt) {
      const { error } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE)
        .delete()
        .eq('source_table', sourceTable)
        .in('source_id', chunk)
      if (error) {
        markExemptionsTableUnavailable(error)
        throw error
      }
      updated += chunk.length
      continue
    }

    const { error: delErr } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE)
      .delete()
      .eq('source_table', sourceTable)
      .in('source_id', chunk)
    if (delErr) {
      markExemptionsTableUnavailable(delErr)
      throw delErr
    }

    const rows = chunk.map((sourceId) => ({
      source_table: sourceTable,
      source_id: sourceId,
      note: note?.trim() || null,
      exempt_by: actorEmail?.trim() || null,
    }))
    const { error: insErr } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE).insert(rows)
    if (insErr) {
      markExemptionsTableUnavailable(insErr)
      throw insErr
    }
    updated += chunk.length
  }

  return { requested, updated }
}

export async function setExpenseReconciliationExempt(
  supabase: SupabaseClient,
  params: {
    sourceTable: ExpenseReconSourceTable
    sourceId: string
    exempt: boolean
    actorEmail?: string | null
    note?: string | null
  }
): Promise<void> {
  const { sourceTable, sourceId, exempt, actorEmail, note } = params
  if (!sourceId.trim()) throw new Error('원장 id가 없습니다.')
  if (!expenseReconExemptSourceSupported(sourceTable)) {
    throw new Error('이 원장 유형은 대조 면제를 지원하지 않습니다.')
  }

  if (!exempt) {
    const { error } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE)
      .delete()
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
    if (error) {
      markExemptionsTableUnavailable(error)
      throw error
    }
    return
  }

  const { error: delErr } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE)
    .delete()
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
  if (delErr) {
    markExemptionsTableUnavailable(delErr)
    throw delErr
  }

  const { error: insErr } = await fromUntypedTable(supabase, EXPENSE_RECONCILIATION_EXEMPTIONS_TABLE).insert({
    source_table: sourceTable,
    source_id: sourceId,
    note: note?.trim() || null,
    exempt_by: actorEmail?.trim() || null,
  })
  if (insErr) {
    markExemptionsTableUnavailable(insErr)
    throw insErr
  }
}
