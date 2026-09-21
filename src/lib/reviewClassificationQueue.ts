import { listAdminGoogleReviews, type AdminGoogleReviewRow } from '@/lib/googleReviewAdmin'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import { loadOtaReviewManualChecks } from '@/lib/otaReviewManualChecks'
import {
  REVIEW_CLASSIFICATION_OTA_SOURCES,
  REVIEW_CLASSIFICATION_TOUR_LINK_START_DATE,
  type OtaReviewPlatformStatus,
  type ReviewClassificationOtaSource,
} from '@/lib/reviewClassificationTodo'

const GOOGLE_PAGE_SIZE = 100
const GOOGLE_MAX_PAGES = 5
const GOOGLE_LIST_CAP = 40

export type ReviewClassificationQueue = {
  googleReviews: AdminGoogleReviewRow[]
  platforms: OtaReviewPlatformStatus[]
}

export function shouldShowGoogleReviewInClassificationQueue(review: AdminGoogleReviewRow): boolean {
  if (review.excludeStaffRating) return false
  if (review.tourId) return false
  const dateKey = toLasVegasDateKey(review.reviewCreatedAt)
  if (dateKey && dateKey < REVIEW_CLASSIFICATION_TOUR_LINK_START_DATE) return false
  return true
}

async function loadUnclassifiedGoogleReviewsWithoutTour(
  operatorId: string
): Promise<AdminGoogleReviewRow[]> {
  const collected: AdminGoogleReviewRow[] = []
  for (let page = 1; page <= GOOGLE_MAX_PAGES; page += 1) {
    const { reviews } = await listAdminGoogleReviews({
      operatorId,
      unclassifiedOnly: true,
      reviewSource: 'google',
      sort: 'imported_at',
      page,
      limit: GOOGLE_PAGE_SIZE,
    })
    collected.push(...reviews.filter(shouldShowGoogleReviewInClassificationQueue))
    if (reviews.length < GOOGLE_PAGE_SIZE) break
    if (collected.length >= GOOGLE_LIST_CAP) break
  }
  return collected.slice(0, GOOGLE_LIST_CAP)
}

async function loadOtaLastImportedAt(
  operatorId: string
): Promise<Partial<Record<ReviewClassificationOtaSource, string>>> {
  const client = supabaseAdmin
  if (!client) return {}

  const entries = await Promise.all(
    REVIEW_CLASSIFICATION_OTA_SOURCES.map(async (source) => {
      const { data, error } = await fromUntypedTable(client, 'google_reviews')
        .select('imported_at')
        .eq('operator_id', operatorId)
        .eq('review_source', source)
        .order('imported_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('[reviewClassificationQueue] last imported_at', source, error.message)
        return [source, null] as const
      }

      const importedAt = (data as { imported_at?: string | null } | null)?.imported_at ?? null
      return [source, importedAt] as const
    })
  )

  const result: Partial<Record<ReviewClassificationOtaSource, string>> = {}
  for (const [source, importedAt] of entries) {
    if (importedAt) result[source] = importedAt
  }
  return result
}

export async function loadReviewClassificationQueue(
  operatorId: string
): Promise<ReviewClassificationQueue> {
  const [googleReviews, lastImported, checks] = await Promise.all([
    loadUnclassifiedGoogleReviewsWithoutTour(operatorId),
    loadOtaLastImportedAt(operatorId),
    loadOtaReviewManualChecks(operatorId),
  ])

  const platforms: OtaReviewPlatformStatus[] = REVIEW_CLASSIFICATION_OTA_SOURCES.map((source) => {
    const check = checks[source]
    return {
      source,
      lastImportedAt: lastImported[source] ?? null,
      checkStatus: check?.checkStatus ?? null,
      checkedAt: check?.checkedAt ?? null,
      checkedByEmail: check?.checkedByEmail ?? null,
    }
  })

  return { googleReviews, platforms }
}
