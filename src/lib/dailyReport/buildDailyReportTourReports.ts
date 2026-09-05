import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import {
  inferTourReportHasIssues,
  isTourReportNoLostItemsValue,
  parseIssuePhotoUrls,
  parseSkippedStops,
} from '@/lib/tourReportExtras'
import { narrationSkipSummary } from '@/lib/tourReportNarration'
import {
  loadTourReportStatus,
  normalizeTourReportEmail,
  type TourReportStaffRole,
} from '@/lib/tourReportMissing'
import type {
  DailyReportTourReportEntry,
  DailyReportTourReportStaffRole,
  DailyReportTourReportSummary,
  DailyReportTourReportTour,
} from '@/lib/dailyReport/types'

type ReportDetailRow = {
  id: string
  tour_id: string | null
  user_email: string
  submitted_on: string | null
  weather: string | null
  overall_mood: string | null
  customer_count: number | null
  booked_customer_count: number | null
  incidents_delays_health: string[] | null
  lost_items_damage: string[] | null
  vehicle_condition_tags: string[] | null
  vehicle_condition_note: string | null
  skipped_stops: Json
  guest_comments: string | null
  handoff_note: string | null
  comments: string | null
  suggestions_followup: string | null
  narration_not_played: boolean | null
  narration_explained_in_person: boolean | null
  narration_skip_reason: string | null
  issue_photo_urls: string[] | null
}

const IN_CHUNK = 100

function emptySummary(): DailyReportTourReportSummary {
  return {
    assignedTourCount: 0,
    completeTourCount: 0,
    missingTourCount: 0,
    submittedReportCount: 0,
    issueReportCount: 0,
    tours: [],
    highlights: [],
  }
}

function trimText(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function toStaffRole(role: TourReportStaffRole | 'other'): DailyReportTourReportStaffRole {
  return role
}

async function fetchReportDetails(
  client: SupabaseClient<Database>,
  tourIds: string[]
): Promise<ReportDetailRow[]> {
  const rows: ReportDetailRow[] = []
  for (let i = 0; i < tourIds.length; i += IN_CHUNK) {
    const chunk = tourIds.slice(i, i + IN_CHUNK)
    if (chunk.length === 0) continue
    const { data, error } = await client
      .from('tour_reports')
      .select(
        'id, tour_id, user_email, submitted_on, weather, overall_mood, customer_count, booked_customer_count, incidents_delays_health, lost_items_damage, vehicle_condition_tags, vehicle_condition_note, skipped_stops, guest_comments, handoff_note, comments, suggestions_followup, narration_not_played, narration_explained_in_person, narration_skip_reason, issue_photo_urls'
      )
      .in('tour_id', chunk)
    if (error) throw error
    rows.push(...((data ?? []) as ReportDetailRow[]))
  }
  return rows
}

export function buildDailyReportTourReportEntry(
  row: ReportDetailRow,
  staffName: string,
  role: DailyReportTourReportStaffRole
): DailyReportTourReportEntry {
  const incidents = (row.incidents_delays_health ?? []).map((item) => String(item).trim()).filter(Boolean)
  const lostItems = (row.lost_items_damage ?? [])
    .map((item) => String(item).trim())
    .filter((item) => item && !isTourReportNoLostItemsValue(item))
  const vehicleTags = (row.vehicle_condition_tags ?? []).map((tag) => String(tag).trim()).filter(Boolean)
  const skipped = Object.values(parseSkippedStops(row.skipped_stops)).filter(
    (entry) => entry.reason.trim() || entry.note.trim()
  )
  const skip = narrationSkipSummary(row, 'ko')
  const skipEn = narrationSkipSummary(row, 'en')
  const hasIssues = inferTourReportHasIssues(row)

  return {
    id: row.id,
    staffName,
    role,
    submittedOn: row.submitted_on,
    weather: trimText(row.weather),
    overallMood: trimText(row.overall_mood),
    customerCount: row.customer_count,
    bookedCustomerCount: row.booked_customer_count,
    hasIssues,
    incidents,
    lostItems,
    vehicleTags,
    vehicleNote: trimText(row.vehicle_condition_note),
    skippedStops: skipped,
    guestComments: trimText(row.guest_comments),
    handoffNote: trimText(row.handoff_note),
    comments: trimText(row.comments),
    suggestions: trimText(row.suggestions_followup),
    narrationSkipTitleKo: skip?.title ?? null,
    narrationSkipTitleEn: skipEn?.title ?? null,
    narrationSkipDetail: skip?.detail ?? skipEn?.detail ?? null,
    photoCount: parseIssuePhotoUrls(row.issue_photo_urls).length,
  }
}

export async function buildDailyReportTourReportSummary(
  client: SupabaseClient<Database>,
  operatorId: string,
  from: string,
  to: string
): Promise<DailyReportTourReportSummary> {
  try {
    const status = await loadTourReportStatus(client, {
      from,
      to,
      operatorId,
      locale: 'ko',
    })

    if (status.assignedTourCount === 0) return emptySummary()

    const details = await fetchReportDetails(
      client,
      status.tours.map((tour) => tour.tourId)
    )
    const detailsById = new Map(details.map((row) => [row.id, row] as const))
    const detailsByTourEmail = new Map(
      details.map(
        (row) =>
          [`${row.tour_id ?? ''}:${normalizeTourReportEmail(row.user_email)}`, row] as const
      )
    )

    const tours: DailyReportTourReportTour[] = status.tours.map((tour) => {
      const staff = tour.staff.map((person) => ({
        name: person.name,
        role: toStaffRole(person.role),
        submitted: person.hasReport,
      }))
      const usedDetailIds = new Set<string>()
      const reports: DailyReportTourReportEntry[] = []

      for (const person of tour.staff) {
        if (!person.hasReport) continue
        const detail =
          (person.reportId ? detailsById.get(person.reportId) : undefined) ??
          detailsByTourEmail.get(`${tour.tourId}:${person.email}`)
        if (!detail) continue
        usedDetailIds.add(detail.id)
        reports.push(buildDailyReportTourReportEntry(detail, person.name, toStaffRole(person.role)))
      }

      for (const row of details) {
        if (row.tour_id !== tour.tourId || usedDetailIds.has(row.id)) continue
        const email = normalizeTourReportEmail(row.user_email)
        if (tour.staff.some((person) => person.email === email)) continue
        const extra = status.submitted.find((item) => item.id === row.id)
        reports.push(
          buildDailyReportTourReportEntry(
            row,
            extra?.userName || email,
            extra?.role === 'other' ? 'other' : toStaffRole(extra?.role ?? 'other')
          )
        )
      }

      return {
        tourId: tour.tourId,
        tourDate: tour.tourDate,
        productName: tour.productName,
        staff,
        missingNames: tour.missingStaff.map((person) => person.name),
        allSubmitted: tour.missingStaff.length === 0 && staff.length > 0,
        reports,
      }
    })

    tours.sort((a, b) => {
      if (a.allSubmitted !== b.allSubmitted) return a.allSubmitted ? 1 : -1
      const aIssue = a.reports.some((report) => report.hasIssues)
      const bIssue = b.reports.some((report) => report.hasIssues)
      if (aIssue !== bIssue) return aIssue ? -1 : 1
      if (a.tourDate !== b.tourDate) return a.tourDate.localeCompare(b.tourDate)
      return a.productName.localeCompare(b.productName, 'ko')
    })

    const completeTourCount = tours.filter((tour) => tour.allSubmitted).length
    const missingTourCount = tours.filter((tour) => !tour.allSubmitted).length
    const submittedReportCount = tours.reduce((sum, tour) => sum + tour.reports.length, 0)
    const issueReportCount = tours.reduce(
      (sum, tour) => sum + tour.reports.filter((report) => report.hasIssues).length,
      0
    )

    const highlights: string[] = [
      `투어 리포트 ${completeTourCount}/${tours.length}건 제출 완료`,
    ]
    if (missingTourCount > 0) {
      highlights.push(`미제출 ${missingTourCount}건`)
    }
    if (issueReportCount > 0) {
      highlights.push(`현장 이슈 ${issueReportCount}건`)
      for (const tour of tours) {
        if (!tour.reports.some((report) => report.hasIssues)) continue
        highlights.push(`${tour.productName} — 이슈 있음`)
      }
    }

    return {
      assignedTourCount: tours.length,
      completeTourCount,
      missingTourCount,
      submittedReportCount,
      issueReportCount,
      tours,
      highlights,
    }
  } catch (error) {
    console.error('daily-report tour reports:', error)
    return emptySummary()
  }
}
