import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

export type GoogleReviewStaffStatRow = {
  staffEmail: string
  staffName: string
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
}

export async function getGoogleReviewStaffStats(
  operatorId?: string | null
): Promise<GoogleReviewStaffStatRow[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: Array<{
        staff_email: string
        staff_name: string
        review_count: number | string
        avg_rating: number | string | null
        five_star_count: number | string
        four_star_count: number | string
        three_star_count: number | string
        two_star_count: number | string
        one_star_count: number | string
      }> | null
      error: { message: string } | null
    }>
  }).rpc('admin_google_review_staff_stats', {
    p_operator_id: resolveOperatorId(operatorId),
  })

  if (error) {
    if (
      error.message.includes('admin_google_review_staff_stats') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        'admin_google_review_staff_stats RPC is missing. Apply migration 20260803210000_google_reviews_tour_staff_links.sql.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    staffEmail: row.staff_email,
    staffName: row.staff_name,
    reviewCount: Number(row.review_count ?? 0),
    avgRating: row.avg_rating == null ? null : Number(row.avg_rating),
    fiveStarCount: Number(row.five_star_count ?? 0),
    fourStarCount: Number(row.four_star_count ?? 0),
    threeStarCount: Number(row.three_star_count ?? 0),
    twoStarCount: Number(row.two_star_count ?? 0),
    oneStarCount: Number(row.one_star_count ?? 0),
  }))
}
