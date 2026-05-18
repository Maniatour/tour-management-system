import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpenseSoftDeleteTable =
  | 'company_expenses'
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'ticket_bookings'

function parseSourceKey(key: string): { table: ExpenseSoftDeleteTable; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const table = key.slice(0, idx) as ExpenseSoftDeleteTable
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

function tableClient(sb: SupabaseClient, table: ExpenseSoftDeleteTable) {
  return table === 'reservation_expenses' ? (sb as SupabaseClient) : sb
}

export async function softDeleteExpenseRecord(
  sb: SupabaseClient,
  table: ExpenseSoftDeleteTable,
  id: string,
  deletedBy?: string | null
): Promise<void> {
  const now = new Date().toISOString()
  const { error: matchErr } = await (sb as any)
    .from('reconciliation_matches')
    .delete()
    .eq('source_table', table)
    .eq('source_id', id)
  if (matchErr) throw matchErr

  const { error } = await tableClient(sb, table)
    .from(table)
    .update({
      deleted_at: now,
      deleted_by: deletedBy ?? null,
      updated_at: now
    })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
}

export async function softDeleteExpenseBySourceKey(
  sb: SupabaseClient,
  sourceKey: string,
  deletedBy?: string | null
): Promise<void> {
  const parsed = parseSourceKey(sourceKey)
  if (!parsed) throw new Error('잘못된 지출 키입니다.')
  await softDeleteExpenseRecord(sb, parsed.table, parsed.id, deletedBy)
}

export async function restoreExpenseRecord(
  sb: SupabaseClient,
  table: ExpenseSoftDeleteTable,
  id: string
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await tableClient(sb, table)
    .from(table)
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_at: now
    })
    .eq('id', id)
    .not('deleted_at', 'is', null)
  if (error) throw error
}

export async function restoreExpenseBySourceKey(sb: SupabaseClient, sourceKey: string): Promise<void> {
  const parsed = parseSourceKey(sourceKey)
  if (!parsed) throw new Error('잘못된 지출 키입니다.')
  await restoreExpenseRecord(sb, parsed.table, parsed.id)
}
