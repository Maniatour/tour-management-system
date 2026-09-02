import type { SupabaseClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { LV_TZ, toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  teamMemberNameForLocale,
  type TeamMemberNameFields,
} from '@/lib/teamMemberDisplayName'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { resolveProductInternalName } from '@/utils/reservationUtils'
import { newSopId, type SopDocument, type SopSection } from '@/types/sopStructure'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 후기 1포인트당 가이드 보너스 (USD) */
export const REVIEW_BONUS_USD_PER_POINT = 5

export function ratingToReviewBonusPoints(rating: number): number {
  switch (Math.round(rating)) {
    case 1:
      return -3
    case 2:
      return -2
    case 3:
      return -1
    case 4:
      return 0
    case 5:
      return 1
    default:
      return 0
  }
}

export function reviewBonusPointsFromStarCounts(counts: {
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
}): number {
  return (
    counts.fiveStarCount * ratingToReviewBonusPoints(5) +
    counts.fourStarCount * ratingToReviewBonusPoints(4) +
    counts.threeStarCount * ratingToReviewBonusPoints(3) +
    counts.twoStarCount * ratingToReviewBonusPoints(2) +
    counts.oneStarCount * ratingToReviewBonusPoints(1)
  )
}

export function reviewBonusAmountUsd(points: number): number {
  return points * REVIEW_BONUS_USD_PER_POINT
}

/** 2주급 시작일이 16일 이후면 해당 월 후기 보너스를 이 지급분에 포함 */
export function isSecondHalfPayPeriod(startDate: string): boolean {
  const day = Number.parseInt(startDate.slice(8, 10), 10)
  return Number.isFinite(day) && day >= 16
}

export function payPeriodCalendarMonth(startDate: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
  const year = Number.parseInt(startDate.slice(0, 4), 10)
  const month = Number.parseInt(startDate.slice(5, 7), 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return { year, month }
}

export type ReviewBonusReviewRow = {
  id: string
  rating: number
  points: number
  postedAt: string
  postedDateLv: string
  authorName: string | null
  reviewSource: string | null
  tourName: string | null
  tourNameEn: string | null
  guide: TeamMemberNameFields | null
  driver: TeamMemberNameFields | null
}

export type ReviewBonusSummary = {
  year: number
  month: number
  monthStart: string
  monthEnd: string
  includedInThisPayPeriod: boolean
  reviewCount: number
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  totalPoints: number
  amountUsd: number
  reviews: ReviewBonusReviewRow[]
}

function emptySummary(
  year: number,
  month: number,
  includedInThisPayPeriod: boolean
): ReviewBonusSummary {
  const start = dayjs.tz(`${year}-${String(month).padStart(2, '0')}-01`, LV_TZ)
  return {
    year,
    month,
    monthStart: start.format('YYYY-MM-DD'),
    monthEnd: start.endOf('month').format('YYYY-MM-DD'),
    includedInThisPayPeriod,
    reviewCount: 0,
    fiveStarCount: 0,
    fourStarCount: 0,
    threeStarCount: 0,
    twoStarCount: 0,
    oneStarCount: 0,
    totalPoints: 0,
    amountUsd: 0,
    reviews: [],
  }
}

function monthUtcRange(year: number, month: number): { startIso: string; endIso: string } {
  const start = dayjs.tz(`${year}-${String(month).padStart(2, '0')}-01`, LV_TZ).startOf('month')
  return {
    startIso: start.toISOString(),
    endIso: start.endOf('month').toISOString(),
  }
}

async function fetchByIds<T>(
  ids: string[],
  load: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 100) {
    out.push(...(await load(ids.slice(i, i + 100))))
  }
  return out
}

function normalizeEmail(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

type GoogleReviewRow = {
  id: string
  rating: number | null
  imported_at: string
  review_created_at: string | null
  author_name: string | null
  review_source: string | null
  exclude_staff_rating: boolean | null
}

type ReviewTourRow = {
  id: string
  tour_guide_id: string | null
  assistant_id: string | null
  tour_status: string | null
  product_id: string | null
  products?:
    | { name?: string | null; name_ko?: string | null; name_en?: string | null }
    | Array<{ name?: string | null; name_ko?: string | null; name_en?: string | null }>
    | null
}

type StaffLinkRow = {
  google_review_id: string
  staff_email: string
  tour_id: string | null
}

type TourLinkRow = {
  google_review_id: string
  tour_id: string
}

function productFromJoin(products: ReviewTourRow['products']) {
  if (!products) return null
  return Array.isArray(products) ? products[0] ?? null : products
}

function reviewPostedAt(row: Pick<GoogleReviewRow, 'review_created_at' | 'imported_at'>): string {
  return row.review_created_at || row.imported_at
}

function toReviewRow(
  row: GoogleReviewRow,
  extra?: {
    tourName: string | null
    tourNameEn: string | null
    guide: TeamMemberNameFields | null
    driver: TeamMemberNameFields | null
  }
): ReviewBonusReviewRow | null {
  if (row.rating == null || row.exclude_staff_rating) return null
  const postedAt = reviewPostedAt(row)
  const postedDateLv = toLasVegasDateKey(postedAt)
  if (!postedDateLv) return null
  const rating = Number(row.rating)
  if (!Number.isFinite(rating)) return null
  return {
    id: row.id,
    rating,
    points: ratingToReviewBonusPoints(rating),
    postedAt,
    postedDateLv,
    authorName: row.author_name,
    reviewSource: row.review_source,
    tourName: extra?.tourName ?? null,
    tourNameEn: extra?.tourNameEn ?? null,
    guide: extra?.guide ?? null,
    driver: extra?.driver ?? null,
  }
}

export function reviewBonusDisplayTourName(
  review: ReviewBonusReviewRow,
  locale: 'ko' | 'en'
): string {
  if (locale === 'en') return review.tourNameEn || review.tourName || '—'
  return review.tourName || review.tourNameEn || '—'
}

export function reviewBonusDisplayGuideName(
  review: ReviewBonusReviewRow,
  locale: 'ko' | 'en'
): string {
  return teamMemberNameForLocale(review.guide, locale) || '—'
}

export function reviewBonusDisplayDriverName(
  review: ReviewBonusReviewRow,
  locale: 'ko' | 'en'
): string {
  return teamMemberNameForLocale(review.driver, locale) || '—'
}

function summarize(
  year: number,
  month: number,
  includedInThisPayPeriod: boolean,
  reviews: ReviewBonusReviewRow[]
): ReviewBonusSummary {
  const start = dayjs.tz(`${year}-${String(month).padStart(2, '0')}-01`, LV_TZ)
  const counts = { five: 0, four: 0, three: 0, two: 0, one: 0 }
  let totalPoints = 0
  for (const review of reviews) {
    totalPoints += review.points
    if (review.rating >= 5) counts.five += 1
    else if (review.rating >= 4) counts.four += 1
    else if (review.rating >= 3) counts.three += 1
    else if (review.rating >= 2) counts.two += 1
    else counts.one += 1
  }
  const sorted = [...reviews].sort((a, b) => b.postedDateLv.localeCompare(a.postedDateLv))
  return {
    year,
    month,
    monthStart: start.format('YYYY-MM-DD'),
    monthEnd: start.endOf('month').format('YYYY-MM-DD'),
    includedInThisPayPeriod,
    reviewCount: reviews.length,
    fiveStarCount: counts.five,
    fourStarCount: counts.four,
    threeStarCount: counts.three,
    twoStarCount: counts.two,
    oneStarCount: counts.one,
    totalPoints,
    amountUsd: includedInThisPayPeriod ? reviewBonusAmountUsd(totalPoints) : 0,
    reviews: sorted,
  }
}

/**
 * 해당 월(1일~말일, 라스베가스)에 고객이 후기를 남긴 건을 가이드 이메일 기준으로 집계.
 * 등록일이 없으면 시스템 입력일을 사용합니다. 2주급 시작일이 16일 미만이면 금액은 0 (16~말일 지급분에서만 포함).
 */
export async function fetchGuideReviewBonusForPayPeriod(
  client: SupabaseClient,
  params: {
    staffEmail: string
    operatorId: string
    startDate: string
  }
): Promise<ReviewBonusSummary> {
  const month = payPeriodCalendarMonth(params.startDate)
  if (!month) return emptySummary(new Date().getFullYear(), 1, false)

  const includedInThisPayPeriod = isSecondHalfPayPeriod(params.startDate)
  if (!includedInThisPayPeriod) {
    return emptySummary(month.year, month.month, false)
  }

  const staffEmail = normalizeEmail(params.staffEmail)
  if (!staffEmail) return emptySummary(month.year, month.month, true)

  const { startIso, endIso } = monthUtcRange(month.year, month.month)
  const reviewSelect =
    'id, rating, imported_at, review_created_at, author_name, review_source, exclude_staff_rating'
  const [{ data: postedRows, error: postedError }, { data: importedRows, error: importedError }] =
    await Promise.all([
      fromUntypedTable(client, 'google_reviews')
        .select(reviewSelect)
        .eq('operator_id', params.operatorId)
        .not('rating', 'is', null)
        .not('review_created_at', 'is', null)
        .gte('review_created_at', startIso)
        .lte('review_created_at', endIso),
      fromUntypedTable(client, 'google_reviews')
        .select(reviewSelect)
        .eq('operator_id', params.operatorId)
        .not('rating', 'is', null)
        .gte('imported_at', startIso)
        .lte('imported_at', endIso),
    ])

  const reviewError = postedError || importedError
  if (reviewError) {
    console.error('[reviewBonusPoints] google_reviews:', reviewError.message)
    return emptySummary(month.year, month.month, true)
  }

  const reviewById = new Map<string, GoogleReviewRow>()
  for (const row of [...(postedRows ?? []), ...(importedRows ?? [])] as GoogleReviewRow[]) {
    reviewById.set(row.id, row)
  }
  const reviewRows = [...reviewById.values()]

  const bounds = emptySummary(month.year, month.month, true)
  const monthReviews = ((reviewRows ?? []) as GoogleReviewRow[]).filter((row) => {
    const lv = toLasVegasDateKey(reviewPostedAt(row))
    if (!lv) return false
    return lv >= bounds.monthStart && lv <= bounds.monthEnd
  })
  if (monthReviews.length === 0) return emptySummary(month.year, month.month, true)

  const monthIds = monthReviews.map((row) => row.id)
  const attributedIds = new Set<string>()

  const staffLinks = await fetchByIds(monthIds, async (chunk) => {
    const { data, error } = await fromUntypedTable(client, 'google_review_staff')
      .select('google_review_id, staff_email, tour_id')
      .eq('operator_id', params.operatorId)
      .in('google_review_id', chunk)
    if (error) {
      console.error('[reviewBonusPoints] google_review_staff:', error.message)
      return []
    }
    return (data ?? []) as StaffLinkRow[]
  })

  for (const link of staffLinks) {
    if (normalizeEmail(link.staff_email) === staffEmail) {
      attributedIds.add(link.google_review_id)
    }
  }

  const tourLinks = await fetchByIds(monthIds, async (chunk) => {
    const { data, error } = await fromUntypedTable(client, 'google_review_tours')
      .select('google_review_id, tour_id')
      .eq('operator_id', params.operatorId)
      .in('google_review_id', chunk)
    if (error) {
      console.error('[reviewBonusPoints] google_review_tours:', error.message)
      return []
    }
    return (data ?? []) as TourLinkRow[]
  })

  const tourIdByReviewId = new Map<string, string>()
  for (const link of tourLinks) {
    if (link.tour_id) tourIdByReviewId.set(link.google_review_id, link.tour_id)
  }
  for (const link of staffLinks) {
    if (link.tour_id && !tourIdByReviewId.has(link.google_review_id)) {
      tourIdByReviewId.set(link.google_review_id, link.tour_id)
    }
  }

  const tourIds = [...new Set([...tourIdByReviewId.values(), ...tourLinks.map((row) => row.tour_id)].filter(Boolean))]
  const toursById = new Map<string, ReviewTourRow>()
  if (tourIds.length > 0) {
    const tours = await fetchByIds(tourIds, async (chunk) => {
      const { data, error } = await client
        .from('tours')
        .select('id, tour_guide_id, assistant_id, tour_status, product_id, products(name, name_ko, name_en)')
        .in('id', chunk)
      if (error) {
        console.error('[reviewBonusPoints] tours:', error.message)
        return []
      }
      return (data ?? []) as ReviewTourRow[]
    })
    for (const tour of tours) {
      toursById.set(tour.id, tour)
    }
    const matchingTourIds = new Set(
      tours
        .filter((tour) => {
          if (isTourCancelled(tour.tour_status)) return false
          return (
            normalizeEmail(tour.tour_guide_id) === staffEmail ||
            normalizeEmail(tour.assistant_id) === staffEmail
          )
        })
        .map((tour) => tour.id)
    )
    for (const link of tourLinks) {
      if (matchingTourIds.has(link.tour_id)) attributedIds.add(link.google_review_id)
    }
  }

  const teamByEmail = new Map<string, TeamMemberNameFields>()
  const staffEmails = [
    ...new Set(
      [...toursById.values()]
        .flatMap((tour) => [tour.tour_guide_id, tour.assistant_id])
        .map((email) => (email || '').trim())
        .filter(Boolean)
    ),
  ]
  if (staffEmails.length > 0) {
    const { data: teamRows, error: teamError } = await client
      .from('team')
      .select('email, nick_name, display_name, name_ko, name_en')
      .in('email', staffEmails)
    if (teamError) {
      console.error('[reviewBonusPoints] team:', teamError.message)
    } else {
      for (const member of teamRows ?? []) {
        const email = normalizeEmail(member.email)
        if (!email) continue
        teamByEmail.set(email, {
          nick_name: member.nick_name,
          display_name: member.display_name,
          name_ko: member.name_ko,
          name_en: member.name_en,
        })
      }
    }
  }

  const reviews = monthReviews
    .filter((row) => attributedIds.has(row.id))
    .map((row) => {
      const tour = toursById.get(tourIdByReviewId.get(row.id) || '')
      const product = productFromJoin(tour?.products)
      const tourName = resolveProductInternalName(product, tour?.product_id)
      const tourNameEn =
        product?.name_en?.trim() || product?.name?.trim() || product?.name_ko?.trim() || tourName
      const guideEmail = normalizeEmail(tour?.tour_guide_id)
      const driverEmail = normalizeEmail(tour?.assistant_id)
      return toReviewRow(row, {
        tourName,
        tourNameEn: tourNameEn || null,
        guide: guideEmail ? teamByEmail.get(guideEmail) ?? null : null,
        driver: driverEmail ? teamByEmail.get(driverEmail) ?? null : null,
      })
    })
    .filter((row): row is ReviewBonusReviewRow => row != null)

  return summarize(month.year, month.month, true, reviews)
}

export function formatReviewBonusMonthLabel(year: number, month: number, locale: 'ko' | 'en'): string {
  if (locale === 'en') {
    return dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY')
  }
  return `${year}년 ${month}월`
}

export function reviewBonusSopSectionAlreadyExists(sections: Array<{ title_ko?: string; title_en?: string }>): boolean {
  return sections.some((section) => {
    const ko = (section.title_ko || '').replace(/\s+/g, '')
    const en = (section.title_en || '').toLowerCase()
    return ko.includes('후기포인트') || en.includes('review bonus') || en.includes('review point')
  })
}

export const REVIEW_BONUS_SOP_POLICY_KO = `후기는 **고객이 후기를 남긴 날짜(라스베가스 기준)** 로 해당 월(1일~말일)에 받은 건만 집계합니다. 등록일이 없으면 시스템 입력일을 사용합니다. 투어 출발일이 아닙니다.

**지급 시기:** 해당 월 **16일~말일 2주급**에 포함합니다. 1~15일 지급분에는 넣지 않습니다.

**포인트**
| 별점 | 포인트 |
|------|--------|
| 5점 | +1 |
| 4점 | 0 |
| 3점 | -1 |
| 2점 | -2 |
| 1점 | -3 |

**금액:** 1포인트 = **$5**. 합산 포인트가 음수이면 해당 기간 가이드 지급액에서 차감합니다.

**대상:** 후기에 연결된 가이드·어시스턴트. 스태프 평점 제외로 표시된 후기는 집계하지 않습니다.`

export const REVIEW_BONUS_SOP_POLICY_EN = `Reviews count by **the date the guest posted the review (Las Vegas time)** for that calendar month (1st–last day). If the posted date is missing, the system entry date is used. Not the tour departure date.

**Pay timing:** Included in that month’s **16th–end biweekly payroll**. Not included in the 1st–15th pay.

**Points**
| Stars | Points |
|-------|--------|
| 5 | +1 |
| 4 | 0 |
| 3 | -1 |
| 2 | -2 |
| 1 | -3 |

**Amount:** 1 point = **$5**. A negative total is deducted from that period’s guide pay.

**Who:** Guide/assistant linked to the review. Reviews marked exclude-from-staff-rating are omitted.`

export function createReviewBonusSopSection(sortOrder: number): SopSection {
  return {
    id: newSopId(),
    title_ko: '후기 포인트 제도',
    title_en: 'Review bonus points',
    sort_order: sortOrder,
    hub_category: 'guide',
    content_type: 'regulation',
    target_roles: ['guide', 'driver', 'office', 'office manager', 'op'],
    content_ko: REVIEW_BONUS_SOP_POLICY_KO,
    content_en: REVIEW_BONUS_SOP_POLICY_EN,
    categories: [
      {
        id: newSopId(),
        title_ko: '운영 규칙',
        title_en: 'Operating rules',
        content_ko: REVIEW_BONUS_SOP_POLICY_KO,
        content_en: REVIEW_BONUS_SOP_POLICY_EN,
        sort_order: 0,
        checklist_items: [
          {
            id: newSopId(),
            title_ko: '후기 입력 시 가이드·어시스턴트 연결 확인',
            title_en: 'Link guide/assistant when entering a review',
            sort_order: 0,
            parent_id: null,
          },
          {
            id: newSopId(),
            title_ko: '월말 2주급(16~말일)에서 후기 포인트·금액 확인 후 지급',
            title_en: 'Confirm review points & amount on 16th–end payroll before paying',
            sort_order: 1,
            parent_id: null,
          },
          {
            id: newSopId(),
            title_ko: '스태프 평점 제외 후기는 포인트에서 빼기',
            title_en: 'Omit exclude-from-staff-rating reviews from points',
            sort_order: 2,
            parent_id: null,
          },
        ],
      },
    ],
  }
}

export function addReviewBonusSopSectionIfMissing(doc: SopDocument): {
  doc: SopDocument
  added: boolean
} {
  if (reviewBonusSopSectionAlreadyExists(doc.sections)) {
    return { doc, added: false }
  }
  return {
    doc: {
      ...doc,
      sections: [...doc.sections, createReviewBonusSopSection(doc.sections.length)],
    },
    added: true,
  }
}

export const REVIEW_BONUS_GUIDE_NOTICE_KO = `안녕하세요, 가이드 여러분.

이번 달부터 **고객 후기 포인트 제도**를 2주급에 반영합니다.

■ 산정
• 매월 1일~말일, **고객이 후기를 남긴 날짜** 기준입니다. (투어 날짜가 아닙니다. 등록일이 없으면 시스템 입력일)
• 별점 → 포인트: 5점 +1 / 4점 0 / 3점 -1 / 2점 -2 / 1점 -3
• 1포인트 = $5 (합산이 마이너스면 해당 기간 급여에서 차감)

■ 지급
• 해당 월 **16일~말일 2주급**에 포함됩니다.
• 1~15일 지급분에는 후기 보너스가 들어가지 않습니다.

좋은 후기는 고객 신뢰와 바로 연결됩니다. 안전하고 친절한 투어 부탁드립니다.
궁금한 점은 사무실로 연락 주세요.`

export const REVIEW_BONUS_GUIDE_NOTICE_EN = `Hello team,

Starting this month, **guest review bonus points** will be included in biweekly pay.

■ How it is calculated
• Calendar month (1st–last day), based on the **date the guest posted the review** (Las Vegas time)—not the tour date. If the posted date is missing, the system entry date is used.
• Stars → points: 5 = +1 / 4 = 0 / 3 = −1 / 2 = −2 / 1 = −3
• $5 per point. A negative total is deducted from that period’s pay.

■ When you receive it
• Included in that month’s **16th–end biweekly pay**.
• Not included in the 1st–15th pay.

Great reviews come from safe, kind tours. Please reach out to the office with any questions.`
