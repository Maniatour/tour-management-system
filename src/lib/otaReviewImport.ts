import { createHash } from 'crypto'
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

export type OtaReviewImportResult = {
  imported: number
  updated: number
  skipped: number
  classified: number
  autoApproved: number
  toursLinked: number
}

function buildOtaExternalId(source: OtaReviewSource, row: ParsedOtaReviewRow): string {
  const key = [
    source,
    row.reservationNumber ?? '',
    row.authorName ?? '',
    row.reviewCreatedAt ?? '',
    row.comment ?? '',
    String(row.rating ?? ''),
    row.productHint ?? '',
  ].join('|')
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24)
  return `ota:${source}:${hash}`
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
  let toursLinked = 0
  const reviewDbIds: string[] = []

  for (const row of input.rows) {
    const externalId = buildOtaExternalId(input.source, row)
    const importStatus = resolveGoogleReviewImportStatus(row.rating)

    const { data: existing, error: existingError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .select('id, import_status')
      .eq('operator_id', operatorId)
      .eq('review_source', input.source)
      .eq('google_review_id', externalId)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    const payload = {
      operator_id: operatorId,
      google_review_id: externalId,
      review_source: input.source,
      google_location_name: locationName,
      author_name: row.authorName,
      rating: row.rating,
      comment: row.comment,
      review_created_at: row.reviewCreatedAt,
      import_status: existing
        ? resolveGoogleReviewImportStatus(row.rating, (existing as { import_status: string }).import_status)
        : importStatus,
      raw_payload: {
        source: input.source,
        productHint: row.productHint,
        reservationNumber: row.reservationNumber ?? null,
        importedBy: input.importedByEmail ?? null,
        lineNumber: row.lineNumber ?? null,
      },
      updated_at: now,
    }

    let reviewDbId: string | null = null

    if (existing) {
      const { data: updatedRow, error: updateError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
        .update(payload as never)
        .eq('id', (existing as { id: string }).id)
        .select('id')

      if (updateError) throw new Error(updateError.message)
      if (updatedRow?.length) {
        updated += 1
        reviewDbId = (existing as { id: string }).id
      } else {
        skipped += 1
      }
    } else {
      const { data: inserted, error: insertError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
        .insert({
          ...payload,
          imported_at: now,
        } as never)
        .select('id')

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.code === '23505') {
          skipped += 1
          continue
        }
        throw new Error(insertError.message)
      }

      if (inserted?.[0]) {
        imported += 1
        reviewDbId = (inserted[0] as { id: string }).id
      }
    }

    if (!reviewDbId) {
      continue
    }

    reviewDbIds.push(reviewDbId)

    if (row.reservationNumber?.trim()) {
      const reservation = await lookupReservationForReviewLink({
        operatorId,
        reference: row.reservationNumber.trim(),
      })
      if (reservation?.tourId) {
        await linkGoogleReviewToTour({
          operatorId,
          reviewId: reviewDbId,
          tourId: reservation.tourId,
          matchMethod: 'reservation_number',
          confidence: 1,
          ...(input.importedByEmail ? { linkedByEmail: input.importedByEmail } : {}),
        })
        toursLinked += 1
      }
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

  return {
    imported,
    updated,
    skipped,
    classified: classified.classified,
    autoApproved,
    toursLinked: toursLinked + tourLinkResult.linked,
  }
}
