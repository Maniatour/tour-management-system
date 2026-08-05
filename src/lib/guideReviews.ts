import { todayInLasVegas, toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import { supabaseAdmin } from '@/lib/supabase'

export type GuideLinkedReviewRow = {
  id: string
  authorName: string | null
  rating: number
  comment: string | null
  reviewCreatedAt: string | null
  importedAt: string
  reviewSource: string
  tourDate: string | null
  productNameKo: string | null
  productNameEn: string | null
  staffRole: string
  isRead: boolean
}

export type GuideReviewSummary = {
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  unreadCount: number
}

export type GuideReviewsPayload = {
  summary: GuideReviewSummary
  reviews: GuideLinkedReviewRow[]
}

function mapRow(row: {
  id: string
  author_name: string | null
  rating: number | null
  comment: string | null
  review_created_at: string | null
  imported_at: string
  review_source: string | null
  tour_date: string | null
  product_name_ko: string | null
  product_name_en: string | null
  staff_role: string
  is_read: boolean
}): GuideLinkedReviewRow | null {
  if (row.rating == null) return null
  return {
    id: row.id,
    authorName: row.author_name,
    rating: Number(row.rating),
    comment: row.comment,
    reviewCreatedAt: row.review_created_at,
    importedAt: row.imported_at,
    reviewSource: row.review_source ?? 'google',
    tourDate: row.tour_date,
    productNameKo: row.product_name_ko,
    productNameEn: row.product_name_en,
    staffRole: row.staff_role,
    isRead: Boolean(row.is_read),
  }
}

function buildSummary(reviews: GuideLinkedReviewRow[]): GuideReviewSummary {
  const counts = { five: 0, four: 0, three: 0, two: 0, one: 0 }
  let unreadCount = 0
  let ratingSum = 0

  for (const review of reviews) {
    ratingSum += review.rating
    if (!review.isRead) unreadCount += 1
    if (review.rating >= 5) counts.five += 1
    else if (review.rating >= 4) counts.four += 1
    else if (review.rating >= 3) counts.three += 1
    else if (review.rating >= 2) counts.two += 1
    else counts.one += 1
  }

  const reviewCount = reviews.length
  return {
    reviewCount,
    avgRating:
      reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 100) / 100 : null,
    fiveStarCount: counts.five,
    fourStarCount: counts.four,
    threeStarCount: counts.three,
    twoStarCount: counts.two,
    oneStarCount: counts.one,
    unreadCount,
  }
}

/** 라스베가스 기준 오늘 이전에 업로드된 리뷰는 새 리뷰(미확인)에서 제외 */
function applyNewReviewCutoff(reviews: GuideLinkedReviewRow[]): GuideLinkedReviewRow[] {
  const todayYmd = todayInLasVegas()
  return reviews.map((review) => {
    if (review.isRead) return review
    const importedYmd = toLasVegasDateKey(review.importedAt)
    if (!importedYmd || importedYmd < todayYmd) {
      return { ...review, isRead: true }
    }
    return review
  })
}

export async function getGuideLinkedReviews(staffEmail: string): Promise<GuideReviewsPayload> {
  if (!supabaseAdmin) {
    return {
      summary: {
        reviewCount: 0,
        avgRating: null,
        fiveStarCount: 0,
        fourStarCount: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0,
        unreadCount: 0,
      },
      reviews: [],
    }
  }

  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: Array<{
        id: string
        author_name: string | null
        rating: number | null
        comment: string | null
        review_created_at: string | null
        imported_at: string
        review_source: string | null
        tour_date: string | null
        product_name_ko: string | null
        product_name_en: string | null
        staff_role: string
        is_read: boolean
      }> | null
      error: { message: string } | null
    }>
  }).rpc('guide_my_linked_reviews', { p_staff_email: staffEmail })

  if (error) {
    if (
      error.message.includes('guide_my_linked_reviews') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        'guide_my_linked_reviews RPC is missing. Apply migration 20260803420000_guide_review_reads.sql.'
      )
    }
    throw new Error(error.message)
  }

  const reviews = applyNewReviewCutoff(
    (data ?? [])
      .map((row) => mapRow(row))
      .filter((row): row is GuideLinkedReviewRow => row != null)
  )

  return {
    summary: buildSummary(reviews),
    reviews,
  }
}

export async function markGuideReviewsRead(
  staffEmail: string,
  reviewIds: string[]
): Promise<void> {
  if (!supabaseAdmin || reviewIds.length === 0) return

  const rows = reviewIds.map((id) => ({
    staff_email: staffEmail,
    google_review_id: id,
    read_at: new Date().toISOString(),
  }))

  const { error } = await (supabaseAdmin as unknown as {
    from: (table: string) => {
      upsert: (
        rows: Array<{ staff_email: string; google_review_id: string; read_at: string }>,
        options: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>
    }
  })
    .from('guide_review_reads')
    .upsert(rows, { onConflict: 'staff_email,google_review_id' })

  if (error) {
    throw new Error(error.message)
  }
}
