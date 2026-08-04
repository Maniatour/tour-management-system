import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { classifyUnmappedGoogleReviews } from '@/lib/googleReviewClassification'
import { autoLinkGoogleReviewsToTours, linkGoogleReviewToTour, lookupReservationForReviewLink } from '@/lib/googleReviewTourLink'
import {
  autoApproveFiveStarPendingReviews,
  resolveGoogleReviewImportStatus,
} from '@/lib/googleReviewImport'
import type { OtaReviewSource } from '@/lib/reviewSources'
import { otaLocationPlaceholder } from '@/lib/reviewSources'
import type { ParsedOtaReviewRow } from '@/lib/otaReviewParse'
import {
  buildOtaDedupKey,
  buildOtaExternalId,
  findExistingOtaReview,
  normalizeOtaReservationNumber,
} from '@/lib/otaReviewDedup'

export type OtaReviewImportResult = {
  imported: number
  updated: number
  skipped: number
  duplicates: number
  classified: number
  autoApproved: number
  toursLinked: number
  authorsBackfilled?: number
}

function extractReservationNumberFromRawPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as { reservationNumber?: string | null }
  return normalizeOtaReservationNumber(payload.reservationNumber) ?? payload.reservationNumber?.trim() ?? null
}

async function resolveCustomerNameFromReservation(
  operatorId: string,
  reference: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const normalized = normalizeOtaReservationNumber(reference) ?? reference.trim()
  if (!normalized) return null
  if (cache.has(normalized)) return cache.get(normalized) ?? null

  const reservation = await lookupReservationForReviewLink({
    operatorId,
    reference: normalized,
  })
  const name = reservation?.customerName?.trim() || null
  cache.set(normalized, name)
  return name
}

async function lookupReservationForOtaImport(
  operatorId: string,
  reference: string,
  cache: Map<string, Awaited<ReturnType<typeof lookupReservationForReviewLink>>>
) {
  const normalized = normalizeOtaReservationNumber(reference) ?? reference.trim()
  if (!normalized) return null
  if (cache.has(normalized)) return cache.get(normalized) ?? null

  const reservation = await lookupReservationForReviewLink({
    operatorId,
    reference: normalized,
  })
  cache.set(normalized, reservation)
  return reservation
}

/** OTA 리뷰 중 예약번호는 있으나 작성자명이 비어 있는 경우 예약에서 고객명을 채웁니다. */
export async function backfillOtaReviewAuthorNamesFromReservations(input: {
  operatorId: string
  reviewSource?: OtaReviewSource
  reviewIds?: string[]
  limit?: number
}): Promise<{ updated: number }> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  let query = fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('id, author_name, raw_payload, review_source')
    .eq('operator_id', operatorId)
    .neq('review_source', 'google')
    .or('author_name.is.null,author_name.eq.')
    .order('imported_at', { ascending: false })
    .limit(input.limit ?? 300)

  if (input.reviewSource) {
    query = query.eq('review_source', input.reviewSource)
  }
  if (input.reviewIds?.length) {
    query = query.in('id', input.reviewIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    author_name: string | null
    raw_payload: unknown
    review_source: string
  }>

  const nameCache = new Map<string, string | null>()
  let updated = 0

  for (const row of rows) {
    if (row.author_name?.trim()) continue
    const reservationNumber = extractReservationNumberFromRawPayload(row.raw_payload)
    if (!reservationNumber) continue

    const customerName = await resolveCustomerNameFromReservation(
      operatorId,
      reservationNumber,
      nameCache
    )
    if (!customerName) continue

    const { error: updateError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({ author_name: customerName, updated_at: new Date().toISOString() } as never)
      .eq('id', row.id)
      .eq('operator_id', operatorId)

    if (updateError) {
      console.error('[otaReviewImport] backfill author_name failed', updateError.message)
      continue
    }
    updated += 1
  }

  return { updated }
}

export async function importOtaReviews(input: {
  operatorId: string
  source: OtaReviewSource
  rows: ParsedOtaReviewRow[]
  importedByEmail?: string | null
}): Promise<OtaReviewImportResult> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const locationName = otaLocationPlaceholder(input.source)
  const now = new Date().toISOString()

  let imported = 0
  let updated = 0
  let skipped = 0
  let duplicates = 0
  let toursLinked = 0
  const reviewDbIds: string[] = []
  const seenInBatch = new Set<string>()
  const reservationLookupCache = new Map<
    string,
    Awaited<ReturnType<typeof lookupReservationForReviewLink>>
  >()

  for (const row of input.rows) {
    const dedupKey = buildOtaDedupKey(input.source, row)
    if (seenInBatch.has(dedupKey)) {
      duplicates += 1
      skipped += 1
      continue
    }
    seenInBatch.add(dedupKey)

    const existing = await findExistingOtaReview({
      operatorId,
      source: input.source,
      row,
    })

    if (existing) {
      duplicates += 1
      skipped += 1
      continue
    }

    const externalId = buildOtaExternalId(input.source, row)
    const importStatus = resolveGoogleReviewImportStatus(row.rating)
    const normalizedRn = normalizeOtaReservationNumber(row.reservationNumber)

    let authorName = row.authorName?.trim() || null
    let tourIdToLink = row.tourId?.trim() || null

    if (normalizedRn || row.reservationNumber?.trim()) {
      const reference = normalizedRn ?? row.reservationNumber!.trim()
      const reservation = await lookupReservationForOtaImport(
        operatorId,
        reference,
        reservationLookupCache
      )
      if (reservation) {
        if (!authorName && reservation.customerName?.trim()) {
          authorName = reservation.customerName.trim()
        }
        if (!tourIdToLink && reservation.tourId) {
          tourIdToLink = reservation.tourId
        }
      }
    }

    const payload = {
      operator_id: operatorId,
      google_review_id: externalId,
      review_source: input.source,
      google_location_name: locationName,
      author_name: authorName,
      rating: row.rating,
      comment: row.comment,
      review_created_at: row.reviewCreatedAt,
      import_status: importStatus,
      raw_payload: {
        source: input.source,
        productHint: row.productHint,
        reservationNumber: normalizedRn ?? row.reservationNumber ?? null,
        tourDate: row.tourDate ?? null,
        productId: row.productId ?? null,
        importedBy: input.importedByEmail ?? null,
        lineNumber: row.lineNumber ?? null,
      },
      updated_at: now,
    }

    let reviewDbId: string | null = null

    const { data: inserted, error: insertError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .insert({
        ...payload,
        imported_at: now,
      } as never)
      .select('id')

    if (insertError) {
      if (insertError.message.includes('duplicate') || insertError.code === '23505') {
        duplicates += 1
        skipped += 1
        continue
      }
      throw new Error(insertError.message)
    }

    if (inserted?.[0]) {
      imported += 1
      reviewDbId = (inserted[0] as { id: string }).id
    } else {
      skipped += 1
      continue
    }

    if (!reviewDbId) {
      continue
    }

    reviewDbIds.push(reviewDbId)

    if (tourIdToLink) {
      await linkGoogleReviewToTour({
        operatorId,
        reviewId: reviewDbId,
        tourId: tourIdToLink,
        matchMethod: row.tourId?.trim() ? 'manual' : 'reservation_number',
        confidence: 1,
        ...(input.importedByEmail ? { linkedByEmail: input.importedByEmail } : {}),
      })
      toursLinked += 1
    }
  }

  const classifyInput =
    reviewDbIds.length > 0
      ? { operatorId, reviewIds: reviewDbIds }
      : { operatorId }

  const classified = await classifyUnmappedGoogleReviews(classifyInput)

  const autoApproveInput =
    reviewDbIds.length > 0
      ? { operatorId, reviewDbIds }
      : { operatorId }

  const autoApproved = await autoApproveFiveStarPendingReviews(autoApproveInput)

  const tourLinkInput =
    reviewDbIds.length > 0
      ? { operatorId, reviewIds: reviewDbIds }
      : { operatorId }

  const tourLinkResult = await autoLinkGoogleReviewsToTours(tourLinkInput)

  const authorBackfill = await backfillOtaReviewAuthorNamesFromReservations({
    operatorId,
    reviewSource: input.source,
    ...(reviewDbIds.length ? { reviewIds: reviewDbIds } : { limit: 300 }),
  })

  return {
    imported,
    updated,
    skipped,
    duplicates,
    classified: classified.classified,
    autoApproved,
    toursLinked: toursLinked + tourLinkResult.linked,
    authorsBackfilled: authorBackfill.updated,
  }
}
