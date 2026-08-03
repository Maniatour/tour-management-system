import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { OtaReviewSource } from '@/lib/reviewSources'
import type { ParsedOtaReviewRow } from '@/lib/otaReviewParse'

/** RN# 비교용 — 공백 제거, 대문자 */
export function normalizeOtaReservationNumber(rn: string | null | undefined): string | null {
  if (!rn?.trim()) return null
  return rn.trim().replace(/\s+/g, '').toUpperCase()
}

function normalizeOtaComment(comment: string | null | undefined): string {
  return (comment ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeOtaAuthor(author: string | null | undefined): string {
  return (author ?? '').trim().toLowerCase()
}

/** DB google_review_id — RN# 있으면 고정 ID, 없으면 내용 해시 */
export function buildOtaExternalId(source: OtaReviewSource, row: ParsedOtaReviewRow): string {
  const rn = normalizeOtaReservationNumber(row.reservationNumber)
  if (rn) {
    return `ota:${source}:rn:${rn}`
  }

  const key = [
    source,
    normalizeOtaAuthor(row.authorName),
    row.reviewCreatedAt?.slice(0, 10) ?? '',
    String(row.rating ?? ''),
    normalizeOtaComment(row.comment).slice(0, 240),
    (row.productHint ?? '').trim().toLowerCase(),
  ].join('|')
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24)
  return `ota:${source}:${hash}`
}

/** 같은 import 배치 내 중복 방지용 */
export function buildOtaDedupKey(source: OtaReviewSource, row: ParsedOtaReviewRow): string {
  const rn = normalizeOtaReservationNumber(row.reservationNumber)
  if (rn) return `${source}:rn:${rn}`
  return buildOtaExternalId(source, row)
}

export async function findExistingOtaReview(input: {
  operatorId: string
  source: OtaReviewSource
  row: ParsedOtaReviewRow
}): Promise<{ id: string } | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const externalId = buildOtaExternalId(input.source, input.row)

  const { data: byExternalId, error: externalError } = await fromUntypedTable(
    supabaseAdmin,
    'google_reviews'
  )
    .select('id')
    .eq('operator_id', operatorId)
    .eq('review_source', input.source)
    .eq('google_review_id', externalId)
    .maybeSingle()

  if (externalError) {
    throw new Error(externalError.message)
  }
  if (byExternalId) {
    return byExternalId as { id: string }
  }

  const rn = normalizeOtaReservationNumber(input.row.reservationNumber)
  if (!rn) return null

  const { data: legacyRows, error: legacyError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('id, raw_payload')
    .eq('operator_id', operatorId)
    .eq('review_source', input.source)
    .ilike('raw_payload->>reservationNumber', rn)
    .limit(5)

  if (legacyError) {
    throw new Error(legacyError.message)
  }

  const match = (legacyRows ?? []).find((row) => {
    const payload = row.raw_payload as { reservationNumber?: string | null } | null
    return normalizeOtaReservationNumber(payload?.reservationNumber) === rn
  })

  return match ? { id: (match as { id: string }).id } : null
}

export async function checkOtaReviewAlreadyImported(input: {
  operatorId: string
  source: OtaReviewSource
  reservationNumber: string
}): Promise<{ exists: boolean; reviewId: string | null }> {
  const existing = await findExistingOtaReview({
    operatorId: input.operatorId,
    source: input.source,
    row: { authorName: null, rating: null, comment: null, reviewCreatedAt: null, productHint: null, reservationNumber: input.reservationNumber },
  })
  return { exists: Boolean(existing), reviewId: existing?.id ?? null }
}
