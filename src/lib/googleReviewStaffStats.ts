import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import type { GoogleReviewStaffMonthlyStat } from '@/types/googleBusiness'

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
  totalTourGuests: number
  reviewRatePercent: number | null
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
        total_tour_guests: number | string
        review_rate_percent: number | string | null
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
        'admin_google_review_staff_stats_monthly RPC is missing. Apply migration 20260803290000_google_review_staff_stats_monthly.sql.'
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
    totalTourGuests: Number(row.total_tour_guests ?? 0),
    reviewRatePercent:
      row.review_rate_percent == null ? null : Number(row.review_rate_percent),
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
      totalTourGuests: row.totalTourGuests,
      reviewRatePercent: row.reviewRatePercent,
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
