import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE = 'google_review_import_notifications'

export type GoogleReviewImportNotifyRow = {
  id: string
  operator_id: string
  imported_count: number
  updated_count: number
  classified_count: number
  unclassified_count: number
  created_at: string
}

function toCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function mapGoogleReviewImportNotifyRow(
  row: Record<string, unknown>
): GoogleReviewImportNotifyRow | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
  if (!id || !createdAt) return null
  return {
    id,
    operator_id: typeof row.operator_id === 'string' ? row.operator_id : '',
    imported_count: toCount(row.imported_count),
    updated_count: toCount(row.updated_count),
    classified_count: toCount(row.classified_count),
    unclassified_count: toCount(row.unclassified_count),
    created_at: createdAt,
  }
}

export async function insertGoogleReviewImportNotification(input: {
  operatorId: string
  importedCount: number
  updatedCount: number
  classifiedCount: number
  unclassifiedCount: number
}): Promise<GoogleReviewImportNotifyRow | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  if (input.importedCount <= 0 && input.updatedCount <= 0) return null

  const { data, error } = await fromUntypedTable(supabaseAdmin, GOOGLE_REVIEW_IMPORT_NOTIFY_TABLE)
    .insert({
      operator_id: resolveOperatorId(input.operatorId),
      imported_count: Math.max(0, Math.floor(input.importedCount)),
      updated_count: Math.max(0, Math.floor(input.updatedCount)),
      classified_count: Math.max(0, Math.floor(input.classifiedCount)),
      unclassified_count: Math.max(0, Math.floor(input.unclassifiedCount)),
    } as never)
    .select(
      'id, operator_id, imported_count, updated_count, classified_count, unclassified_count, created_at'
    )
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data || typeof data !== 'object') return null
  return mapGoogleReviewImportNotifyRow(data as Record<string, unknown>)
}
