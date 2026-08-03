import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  fetchGoogleBusinessReviewsPage,
  mapGoogleStarRating,
  type GoogleBusinessReviewApiRow,
} from '@/lib/googleBusinessReviewsApi'
import {
  getGoogleBusinessAccessToken,
  getGoogleBusinessConnectionStatus,
} from '@/lib/googleBusinessConnection'
import { classifyUnmappedGoogleReviews } from '@/lib/googleReviewClassification'
import { autoLinkGoogleReviewsToTours } from '@/lib/googleReviewTourLink'

export type GoogleReviewImportPageResult = {
  imported: number
  updated: number
  skipped: number
  classified: number
  autoApproved: number
  toursLinked: number
  pageReviewCount: number
  nextPageToken: string | null
  done: boolean
  totalReviewCount: number | null
}

type ExistingReviewRow = {
  id: string
  google_review_id: string
  import_status: string
}

export function resolveGoogleReviewImportStatus(
  rating: number | null | undefined,
  existingStatus?: string | null
): 'pending' | 'approved' | 'rejected' | 'hidden' {
  if (existingStatus === 'rejected' || existingStatus === 'hidden') {
    return existingStatus
  }
  if (rating === 5) {
    return 'approved'
  }
  if (existingStatus === 'approved') {
    return 'approved'
  }
  return 'pending'
}

export async function autoApproveFiveStarPendingReviews(input: {
  operatorId: string
  reviewDbIds?: string[]
}): Promise<number> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const now = new Date().toISOString()

  let query = fromUntypedTable(supabaseAdmin, 'google_reviews')
    .update({
      import_status: 'approved',
      updated_at: now,
    } as never)
    .eq('operator_id', operatorId)
    .eq('rating', 5)
    .eq('import_status', 'pending')

  if (input.reviewDbIds?.length) {
    query = query.in('id', input.reviewDbIds)
  }

  const { data, error } = await query.select('id')
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).length
}

function mapApiReviewToRow(input: {
  review: GoogleBusinessReviewApiRow
  operatorId: string
  locationName: string
}) {
  const rating = mapGoogleStarRating(input.review.starRating)
  return {
    operator_id: resolveOperatorId(input.operatorId),
    google_review_id: input.review.reviewId,
    review_source: 'google',
    google_location_name: input.locationName,
    author_name: input.review.reviewer?.displayName?.trim() || 'Google User',
    author_photo_url: input.review.reviewer?.profilePhotoUrl ?? null,
    rating,
    comment: input.review.comment?.trim() || null,
    review_reply: input.review.reviewReply?.comment?.trim() || null,
    review_created_at: input.review.createTime ?? null,
    review_updated_at: input.review.updateTime ?? null,
    raw_payload: input.review as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }
}

export async function importGoogleBusinessReviewsPage(input: {
  operatorId: string
  pageToken?: string | null
  classifiedBy?: string
}): Promise<GoogleReviewImportPageResult> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const connection = await getGoogleBusinessConnectionStatus(input.operatorId)
  if (!connection.connected || !connection.googleLocationName) {
    throw new Error('location_not_selected')
  }

  const accessToken = await getGoogleBusinessAccessToken(input.operatorId)
  const page = await fetchGoogleBusinessReviewsPage({
    accessToken,
    locationName: connection.googleLocationName,
    ...(input.pageToken ? { pageToken: input.pageToken } : {}),
    pageSize: 50,
  })

  const operatorId = resolveOperatorId(input.operatorId)
  const apiReviewIds = page.reviews.map((row) => row.reviewId).filter(Boolean)

  let existingByGoogleId = new Map<string, ExistingReviewRow>()
  if (apiReviewIds.length) {
    const { data: existingRows } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .select('id, google_review_id, import_status')
      .eq('operator_id', operatorId)
      .in('google_review_id', apiReviewIds)

    existingByGoogleId = new Map(
      ((existingRows ?? []) as ExistingReviewRow[]).map((row) => [row.google_review_id, row])
    )
  }

  let imported = 0
  let updated = 0
  let skipped = 0
  const newReviewDbIds: string[] = []
  const touchedReviewDbIds: string[] = []

  for (const apiReview of page.reviews) {
    if (!apiReview.reviewId) {
      skipped += 1
      continue
    }

    const row = mapApiReviewToRow({
      review: apiReview,
      operatorId,
      locationName: connection.googleLocationName!,
    })

    const existing = existingByGoogleId.get(apiReview.reviewId)
    const importStatus = resolveGoogleReviewImportStatus(row.rating, existing?.import_status)

    if (!existing) {
      const { data: inserted, error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
        .insert({
          ...row,
          import_status: importStatus,
          imported_at: new Date().toISOString(),
        } as never)
        .select('id')
        .single()

      if (error) {
        console.error('[googleReviewImport] insert failed', error.message)
        skipped += 1
        continue
      }

      imported += 1
      if (inserted && typeof (inserted as { id?: string }).id === 'string') {
        const reviewDbId = (inserted as { id: string }).id
        newReviewDbIds.push(reviewDbId)
        touchedReviewDbIds.push(reviewDbId)
      }
      continue
    }

    const { error: updateError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({
        author_name: row.author_name,
        author_photo_url: row.author_photo_url,
        rating: row.rating,
        comment: row.comment,
        review_reply: row.review_reply,
        review_created_at: row.review_created_at,
        review_updated_at: row.review_updated_at,
        raw_payload: row.raw_payload,
        updated_at: row.updated_at,
        import_status: importStatus,
      } as never)
      .eq('id', existing.id)

    if (updateError) {
      console.error('[googleReviewImport] update failed', updateError.message)
      skipped += 1
      continue
    }

    updated += 1
    touchedReviewDbIds.push(existing.id)
  }

  const autoApproved = await autoApproveFiveStarPendingReviews({
    operatorId,
    ...(touchedReviewDbIds.length ? { reviewDbIds: touchedReviewDbIds } : {}),
  })

  const classifyResult = await classifyUnmappedGoogleReviews({
    operatorId,
    ...(newReviewDbIds.length ? { reviewIds: newReviewDbIds } : {}),
    ...(input.classifiedBy ? { classifiedBy: input.classifiedBy } : {}),
    limit: newReviewDbIds.length || 50,
  })

  const tourLinkResult = await autoLinkGoogleReviewsToTours({
    operatorId,
    ...(touchedReviewDbIds.length ? { reviewIds: touchedReviewDbIds } : {}),
    ...(input.classifiedBy ? { linkedByEmail: input.classifiedBy } : {}),
    limit: touchedReviewDbIds.length || 50,
  })

  const now = new Date().toISOString()
  await fromUntypedTable(supabaseAdmin, 'google_business_connections')
    .update({
      last_synced_at: now,
      last_import_review_count: page.totalReviewCount,
      last_import_new_count: imported,
      updated_at: now,
    } as never)
    .eq('operator_id', operatorId)

  return {
    imported,
    updated,
    skipped,
    classified: classifyResult.classified,
    autoApproved,
    toursLinked: tourLinkResult.linked,
    pageReviewCount: page.reviews.length,
    nextPageToken: page.nextPageToken,
    done: !page.nextPageToken,
    totalReviewCount: page.totalReviewCount,
  }
}
