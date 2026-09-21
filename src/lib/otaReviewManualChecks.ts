import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  REVIEW_CLASSIFICATION_OTA_SOURCES,
  type OtaReviewManualCheckStatus,
  type OtaReviewPlatformStatus,
  type ReviewClassificationOtaSource,
} from '@/lib/reviewClassificationTodo'

const TABLE = 'ota_review_manual_checks'

type CheckRow = {
  review_source: string
  status: string
  checked_at: string
  checked_by_email: string | null
}

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const message = error.message || ''
  return (
    error.code === '42P01' ||
    /ota_review_manual_checks/i.test(message) ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  )
}

function asCheckStatus(value: string | null | undefined): OtaReviewManualCheckStatus | null {
  if (value === 'no_review' || value === 'follow_up') return value
  return null
}

export async function loadOtaReviewManualChecks(
  operatorId: string
): Promise<Partial<Record<ReviewClassificationOtaSource, OtaReviewPlatformStatus>>> {
  const client = supabaseAdmin
  if (!client) return {}

  const { data, error } = await fromUntypedTable(client, TABLE)
    .select('review_source, status, checked_at, checked_by_email')
    .eq('operator_id', operatorId)
    .in('review_source', [...REVIEW_CLASSIFICATION_OTA_SOURCES])

  if (error) {
    if (isMissingTableError(error)) return {}
    throw new Error(error.message)
  }

  const result: Partial<Record<ReviewClassificationOtaSource, OtaReviewPlatformStatus>> = {}
  for (const row of (data ?? []) as CheckRow[]) {
    if (!REVIEW_CLASSIFICATION_OTA_SOURCES.includes(row.review_source as ReviewClassificationOtaSource)) {
      continue
    }
    const source = row.review_source as ReviewClassificationOtaSource
    result[source] = {
      source,
      lastImportedAt: null,
      checkStatus: asCheckStatus(row.status),
      checkedAt: row.checked_at ?? null,
      checkedByEmail: row.checked_by_email ?? null,
    }
  }
  return result
}

export async function upsertOtaReviewManualCheck(input: {
  operatorId: string
  source: ReviewClassificationOtaSource
  status: OtaReviewManualCheckStatus
  checkedByEmail: string
}): Promise<{
  source: ReviewClassificationOtaSource
  checkStatus: OtaReviewManualCheckStatus
  checkedAt: string
  checkedByEmail: string
}> {
  const client = supabaseAdmin
  if (!client) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const now = new Date().toISOString()
  const { data, error } = await fromUntypedTable(client, TABLE)
    .upsert(
      {
        operator_id: input.operatorId,
        review_source: input.source,
        status: input.status,
        checked_at: now,
        checked_by_email: input.checkedByEmail,
        updated_at: now,
      },
      { onConflict: 'operator_id,review_source' }
    )
    .select('review_source, status, checked_at, checked_by_email')
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) {
      return {
        source: input.source,
        checkStatus: input.status,
        checkedAt: now,
        checkedByEmail: input.checkedByEmail,
      }
    }
    throw new Error(error.message)
  }

  const row = data as CheckRow | null
  return {
    source: input.source,
    checkStatus: asCheckStatus(row?.status) ?? input.status,
    checkedAt: row?.checked_at ?? now,
    checkedByEmail: row?.checked_by_email ?? input.checkedByEmail,
  }
}
