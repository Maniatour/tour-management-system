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

const INCREMENTAL_OVERLAP_MS = 2 * 60 * 60 * 1000
const INCREMENTAL_FALLBACK_DAYS = 7

function reviewTimestamp(review: GoogleBusinessReviewApiRow): string | null {
  return review.updateTime || review.createTime || null
}

async function resolveIncrementalSinceIso(operatorId: string, lastSyncedAt: string | null): Promise<string> {
  if (lastSyncedAt) {
    return new Date(new Date(lastSyncedAt).getTime() - INCREMENTAL_OVERLAP_MS).toISOString()
  }

  const { data } = await fromUntypedTable(supabaseAdmin!, 'google_reviews')
    .select('review_updated_at, review_created_at')
    .eq('operator_id', operatorId)
    .eq('review_source', 'google')
    .order('review_updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const row = data as { review_updated_at?: string | null; review_created_at?: string | null } | null
  const fromDb = row?.review_updated_at || row?.review_created_at
  if (fromDb) {
    return new Date(new Date(fromDb).getTime() - INCREMENTAL_OVERLAP_MS).toISOString()
  }

  const fallback = new Date()
  fallback.setDate(fallback.getDate() - INCREMENTAL_FALLBACK_DAYS)
  return fallback.toISOString()
}

export async function importGoogleBusinessReviewsPage(input: {
  operatorId: string
  pageToken?: string | null
  classifiedBy?: string
  /** true면 Google이 주는 최신순 페이지를 보다가, 마지막 동기화 이전 리뷰만 나오면 중단 */
  incremental?: boolean
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
  const sinceIso = input.incremental
    ? await resolveIncrementalSinceIso(operatorId, connection.lastSyncedAt)
    : null
  const timestamps = page.reviews
    .map((review) => reviewTimestamp(review))
    .filter((value): value is string => Boolean(value))
  const pageAllAtOrBeforeSince =
    Boolean(input.incremental && sinceIso && page.reviews.length > 0 && timestamps.length > 0) &&
    timestamps.every((value) => value <= sinceIso!)
  const done = !page.nextPageToken || pageAllAtOrBeforeSince

  const apiReviewIds = pageAllAtOrBeforeSince ? [] : page.reviews.map((row) => row.reviewId).filter(Boolean)

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

  if (!pageAllAtOrBeforeSince) {
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
  }

  const autoApproved = pageAllAtOrBeforeSince
    ? 0
    : await autoApproveFiveStarPendingReviews({
        operatorId,
        ...(touchedReviewDbIds.length ? { reviewDbIds: touchedReviewDbIds } : {}),
      })

  const classifyResult = pageAllAtOrBeforeSince
    ? { classified: 0 }
    : await classifyUnmappedGoogleReviews({
        operatorId,
        ...(newReviewDbIds.length ? { reviewIds: newReviewDbIds } : {}),
        ...(input.classifiedBy ? { classifiedBy: input.classifiedBy } : {}),
        limit: newReviewDbIds.length || 50,
      })

  const tourLinkResult = pageAllAtOrBeforeSince
    ? { linked: 0 }
    : await autoLinkGoogleReviewsToTours({
        operatorId,
        ...(touchedReviewDbIds.length ? { reviewIds: touchedReviewDbIds } : {}),
        ...(input.classifiedBy ? { linkedByEmail: input.classifiedBy } : {}),
        limit: touchedReviewDbIds.length || 50,
      })

  if (done) {
    const now = new Date().toISOString()
    await fromUntypedTable(supabaseAdmin, 'google_business_connections')
      .update({
        last_synced_at: now,
        last_import_review_count: page.totalReviewCount,
        last_import_new_count: imported,
        updated_at: now,
      } as never)
      .eq('operator_id', operatorId)
  }

  return {
    imported,
    updated,
    skipped,
    classified: classifyResult.classified,
    autoApproved,
    toursLinked: tourLinkResult.linked,
    pageReviewCount: page.reviews.length,
    nextPageToken: done ? null : page.nextPageToken,
    done,
    totalReviewCount: page.totalReviewCount,
  }
}

export async function importGoogleBusinessReviewsUntilDone(input: {
  operatorId: string
  incremental?: boolean
  classifiedBy?: string
  maxPages?: number
}): Promise<{
  imported: number
  updated: number
  classified: number
  autoApproved: number
  toursLinked: number
  pages: number
  done: boolean
}> {
  const maxPages = Math.min(Math.max(input.maxPages ?? 20, 1), 40)
  let pageToken: string | null = null
  let imported = 0
  let updated = 0
  let classified = 0
  let autoApproved = 0
  let toursLinked = 0
  let pages = 0
  let done = false
  let lastTotalReviewCount: number | null = null

  do {
    pages += 1
    const result = await importGoogleBusinessReviewsPage({
      operatorId: input.operatorId,
      pageToken,
      incremental: input.incremental === true,
      ...(input.classifiedBy ? { classifiedBy: input.classifiedBy } : {}),
    })
    imported += result.imported
    updated += result.updated
    classified += result.classified
    autoApproved += result.autoApproved
    toursLinked += result.toursLinked
    pageToken = result.nextPageToken
    done = result.done
    lastTotalReviewCount = result.totalReviewCount
    if (done) break
  } while (pages < maxPages)

  if (done && supabaseAdmin) {
    const now = new Date().toISOString()
    await fromUntypedTable(supabaseAdmin, 'google_business_connections')
      .update({
        last_synced_at: now,
        last_import_review_count: lastTotalReviewCount,
        last_import_new_count: imported,
        updated_at: now,
      } as never)
      .eq('operator_id', resolveOperatorId(input.operatorId))
  }

  return { imported, updated, classified, autoApproved, toursLinked, pages, done }
}
