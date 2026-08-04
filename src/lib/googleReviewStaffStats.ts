import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import type {
  GoogleReviewStaffMonthlyStat,
  GoogleReviewStaffStatReviewItem,
} from '@/types/googleBusiness'

export type GoogleReviewStaffStatRow = {
  staffEmail: string
  staffName: string
  staffIsActive: boolean
  firstReviewDate: string | null
  lastReviewDate: string | null
  reviewCount: number
  avgRating: number | null
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  totalTourGuests: number
  reservationGroupCount: number
  tourDepartureCount: number
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

async function loadStaffActiveByEmail(emails: string[]): Promise<Map<string, boolean>> {
  if (!supabaseAdmin || emails.length === 0) return new Map()

  const { data, error } = await supabaseAdmin.from('team').select('email, is_active')
  if (error) {
    console.error('[googleReviewStaffStats] team is_active load failed:', error.message)
    return new Map()
  }

  const map = new Map<string, boolean>()
  for (const row of data ?? []) {
    const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
    if (!email) continue
    map.set(email, row.is_active !== false)
  }
  return map
}

function resolveStaffIsActive(
  staffEmail: string,
  activeMap: Map<string, boolean>
): boolean {
  return activeMap.get(staffEmail.toLowerCase()) ?? true
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
        first_review_date: string | null
        last_review_date: string | null
        review_count: number | string
        avg_rating: number | string | null
        five_star_count: number | string
        four_star_count: number | string
        three_star_count: number | string
        two_star_count: number | string
        one_star_count: number | string
        total_tour_guests: number | string
        reservation_group_count: number | string
        tour_departure_count: number | string
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
        'admin_google_review_staff_stats RPC is missing. Apply migration 20260803400000_google_review_staff_stats_all_tour_history.sql.'
      )
    }
    throw new Error(error.message)
  }

  const mapped = (data ?? []).map((row) => ({
    staffEmail: row.staff_email,
    staffName: row.staff_name,
    firstReviewDate: row.first_review_date ?? null,
    lastReviewDate: row.last_review_date ?? null,
    reviewCount: Number(row.review_count ?? 0),
    avgRating: row.avg_rating == null ? null : Number(row.avg_rating),
    fiveStarCount: Number(row.five_star_count ?? 0),
    fourStarCount: Number(row.four_star_count ?? 0),
    threeStarCount: Number(row.three_star_count ?? 0),
    twoStarCount: Number(row.two_star_count ?? 0),
    oneStarCount: Number(row.one_star_count ?? 0),
    totalTourGuests: Number(row.total_tour_guests ?? 0),
    reservationGroupCount: Number(row.reservation_group_count ?? 0),
    tourDepartureCount: Number(row.tour_departure_count ?? 0),
  }))

  const activeMap = await loadStaffActiveByEmail(mapped.map((row) => row.staffEmail))
  return mapped.map((row) => ({
    ...row,
    staffIsActive: resolveStaffIsActive(row.staffEmail, activeMap),
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

export async function pivotGoogleReviewStaffMonthlyStats(
  rows: GoogleReviewStaffMonthlyStatRow[]
): Promise<GoogleReviewStaffMonthlyStat[]> {
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
        staffIsActive: true,
        months: [cell],
      })
    }
  }

  const activeMap = await loadStaffActiveByEmail([...byStaff.keys()])

  return [...byStaff.values()]
    .map((stat) => ({
      ...stat,
      staffIsActive: resolveStaffIsActive(stat.staffEmail, activeMap),
    }))
    .sort((a, b) => {
      const aTotal = a.months.reduce((sum, m) => sum + m.reviewCount, 0)
      const bTotal = b.months.reduce((sum, m) => sum + m.reviewCount, 0)
      if (bTotal !== aTotal) return bTotal - aTotal
      return a.staffName.localeCompare(b.staffName, 'ko')
    })
}
