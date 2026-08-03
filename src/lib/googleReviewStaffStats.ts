import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import type {
  GoogleReviewStaffMonthlyStat,
  GoogleReviewStaffStatReviewItem,
} from '@/types/googleBusiness'

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

export type GoogleReviewStaffMonthlyStatRow = {
  staffEmail: string
  staffName: string
  month: number
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  totalTourGuests: number
  reservationGroupCount: number
  guestReviewRatePercent: number | null
  groupReviewRatePercent: number | null
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
        'admin_google_review_staff_stats RPC is missing. Apply migration 20260803350000_google_review_staff_stats_all_platforms.sql.'
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

export async function getGoogleReviewStaffMonthlyStats(
  operatorId?: string | null,
  year?: number | null
): Promise<GoogleReviewStaffMonthlyStatRow[]> {
  if (!supabaseAdmin) return []

  const targetYear = year ?? new Date().getFullYear()

  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: Array<{
        staff_email: string
        staff_name: string
        month_num: number | string
        review_count: number | string
        avg_rating: number | string | null
        five_star_count: number | string
        four_star_count: number | string
        three_star_count: number | string
        two_star_count: number | string
        one_star_count: number | string
        total_tour_guests: number | string
        reservation_group_count: number | string
        guest_review_rate_percent: number | string | null
        group_review_rate_percent: number | string | null
      }> | null
      error: { message: string } | null
    }>
  }).rpc('admin_google_review_staff_stats_monthly', {
    p_operator_id: resolveOperatorId(operatorId),
    p_year: targetYear,
  })

  if (error) {
    if (
      error.message.includes('admin_google_review_staff_stats_monthly') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        'admin_google_review_staff_stats_monthly RPC is missing. Apply migration 20260803350000_google_review_staff_stats_all_platforms.sql.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    staffEmail: row.staff_email,
    staffName: row.staff_name,
    month: Number(row.month_num ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    avgRating: row.avg_rating == null ? null : Number(row.avg_rating),
    fiveStarCount: Number(row.five_star_count ?? 0),
    fourStarCount: Number(row.four_star_count ?? 0),
    threeStarCount: Number(row.three_star_count ?? 0),
    twoStarCount: Number(row.two_star_count ?? 0),
    oneStarCount: Number(row.one_star_count ?? 0),
    totalTourGuests: Number(row.total_tour_guests ?? 0),
    reservationGroupCount: Number(row.reservation_group_count ?? 0),
    guestReviewRatePercent:
      row.guest_review_rate_percent == null ? null : Number(row.guest_review_rate_percent),
    groupReviewRatePercent:
      row.group_review_rate_percent == null ? null : Number(row.group_review_rate_percent),
  }))
}

export async function getGoogleReviewStaffStatReviews(input: {
  operatorId?: string | null
  staffEmail: string
  rating: number
  year?: number | null
  month?: number | null
}): Promise<GoogleReviewStaffStatReviewItem[]> {
  if (!supabaseAdmin) return []

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
        review_source: string
        tour_date: string | null
        product_name: string | null
      }> | null
      error: { message: string } | null
    }>
  }).rpc('admin_google_review_staff_stat_reviews', {
    p_operator_id: resolveOperatorId(input.operatorId),
    p_staff_email: input.staffEmail,
    p_rating: input.rating,
    p_year: input.year ?? null,
    p_month: input.month ?? null,
  })

  if (error) {
    if (
      error.message.includes('admin_google_review_staff_stat_reviews') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        'admin_google_review_staff_stat_reviews RPC is missing. Apply migration 20260803350000_google_review_staff_stats_all_platforms.sql.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    authorName: row.author_name,
    rating: row.rating == null ? null : Number(row.rating),
    comment: row.comment,
    reviewCreatedAt: row.review_created_at,
    importedAt: row.imported_at,
    reviewSource: row.review_source ?? 'google',
    tourDate: row.tour_date,
    productName: row.product_name,
  }))
}

export function pivotGoogleReviewStaffMonthlyStats(
  rows: GoogleReviewStaffMonthlyStatRow[]
): GoogleReviewStaffMonthlyStat[] {
  const byStaff = new Map<string, GoogleReviewStaffMonthlyStat>()

  for (const row of rows) {
    const existing = byStaff.get(row.staffEmail)
    const cell = {
      month: row.month,
      reviewCount: row.reviewCount,
      avgRating: row.avgRating,
      fiveStarCount: row.fiveStarCount,
      fourStarCount: row.fourStarCount,
      threeStarCount: row.threeStarCount,
      twoStarCount: row.twoStarCount,
      oneStarCount: row.oneStarCount,
      totalTourGuests: row.totalTourGuests,
      reservationGroupCount: row.reservationGroupCount,
      guestReviewRatePercent: row.guestReviewRatePercent,
      groupReviewRatePercent: row.groupReviewRatePercent,
    }
    if (existing) {
      existing.months.push(cell)
    } else {
      byStaff.set(row.staffEmail, {
        staffEmail: row.staffEmail,
        staffName: row.staffName,
        months: [cell],
      })
    }
  }

  return [...byStaff.values()].sort((a, b) => {
    const aTotal = a.months.reduce((sum, m) => sum + m.reviewCount, 0)
    const bTotal = b.months.reduce((sum, m) => sum + m.reviewCount, 0)
    if (bTotal !== aTotal) return bTotal - aTotal
    return a.staffName.localeCompare(b.staffName, 'ko')
  })
}
