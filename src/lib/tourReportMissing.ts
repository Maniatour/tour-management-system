import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { TOUR_REPORT_REQUIRED_FROM } from '@/lib/tourReportExtras'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { resolveSmsPhone } from '@/utils/formatPhoneToE164'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export type TourReportStaffRole = 'guide' | 'assistant'

export type TourReportStatusStaff = {
  email: string
  name: string
  role: TourReportStaffRole
  hasReport: boolean
  reportId: string | null
  submittedOn: string | null
  phone: string | null
  phoneE164: string | null
  locale: 'ko' | 'en'
}

export type TourReportSubmittedRow = {
  id: string
  tourId: string
  tourDate: string
  productName: string
  userEmail: string
  userName: string
  role: TourReportStaffRole | 'other'
  submittedOn: string | null
}

export type TourReportStatusTour = {
  tourId: string
  tourDate: string
  productName: string
  tourStatus: string | null
  staff: TourReportStatusStaff[]
  missingStaff: TourReportStatusStaff[]
}

export type TourReportStatusPayload = {
  from: string
  to: string
  assignedTourCount: number
  missingTourCount: number
  submittedReportCount: number
  tours: TourReportStatusTour[]
  submitted: TourReportSubmittedRow[]
}

export type TourReportReminderTarget = {
  tourId: string
  email: string
}

export type TourReportReminderRecipient = {
  email: string
  name: string
  phone: string | null
  phoneE164: string | null
  locale: 'ko' | 'en'
  tours: Array<{
    tourId: string
    tourDate: string
    productName: string
    role: TourReportStaffRole
  }>
}

type TeamRow = {
  email: string
  name_ko: string | null
  nick_name: string | null
  phone: string | null
  languages: string[] | string | null
}

type ProductRow = {
  id: string
  name: string | null
  name_ko: string | null
  name_en: string | null
}

type TourRow = {
  id: string
  tour_date: string
  tour_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  product_id: string | null
}

type ReportRow = {
  id: string
  tour_id: string | null
  user_email: string
  submitted_on: string | null
}

const PAGE = 1000
const IN_CHUNK = 100

export function defaultTourReportStatusRange(): { from: string; to: string } {
  const to = todayInLasVegas()
  return {
    from: TOUR_REPORT_REQUIRED_FROM,
    to: to < TOUR_REPORT_REQUIRED_FROM ? TOUR_REPORT_REQUIRED_FROM : to,
  }
}

export function normalizeTourReportEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

function teamDisplayName(member: TeamRow | undefined, email: string): string {
  if (!member) return email
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || email
}

function staffMessageLocale(member: TeamRow | undefined): 'ko' | 'en' {
  const languages = member?.languages
  const first = Array.isArray(languages) ? languages[0] : languages
  const code = String(first || '').trim().toLowerCase()
  if (code.startsWith('en') || code === 'eng' || code === 'english') return 'en'
  return 'ko'
}

function productNameForAdmin(product: ProductRow | undefined, locale: string, fallback: string): string {
  if (!product) return fallback
  if (locale === 'en') {
    return product.name_en?.trim() || product.name_ko?.trim() || product.name?.trim() || fallback
  }
  return product.name_ko?.trim() || product.name?.trim() || product.name_en?.trim() || fallback
}

function formatShortDate(dateString: string): string {
  const [y, m, d] = dateString.split('-')
  if (!y || !m || !d) return dateString
  return `${Number(m)}/${Number(d)}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchAllTours(
  db: SupabaseClient,
  from: string,
  to: string,
  operatorId: string
): Promise<TourRow[]> {
  const rows: TourRow[] = []
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db
      .from('tours')
      .select('id, tour_date, tour_status, tour_guide_id, assistant_id, product_id')
      .eq('operator_id', operatorId)
      .gte('tour_date', from)
      .lte('tour_date', to)
      .order('tour_date', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) throw error
    const batch = (data || []) as TourRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function fetchInChunks<T>(
  ids: string[],
  load: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    if (chunk.length === 0) continue
    out.push(...(await load(chunk)))
  }
  return out
}

export async function loadTourReportStatus(
  db: SupabaseClient,
  params: { from: string; to: string; operatorId?: string | null; locale?: string }
): Promise<TourReportStatusPayload> {
  const from = (params.from || TOUR_REPORT_REQUIRED_FROM).trim()
  const to = (params.to || todayInLasVegas()).trim()
  const operatorId = resolveOperatorId(params.operatorId)
  const locale = params.locale === 'en' ? 'en' : 'ko'

  const tours = (await fetchAllTours(db, from, to, operatorId)).filter(
    (tour) => !isTourCancelled(tour.tour_status)
  )

  const assigned = tours.filter(
    (tour) =>
      Boolean(normalizeTourReportEmail(tour.tour_guide_id)) ||
      Boolean(normalizeTourReportEmail(tour.assistant_id))
  )

  const tourIds = assigned.map((tour) => tour.id)
  const reports =
    tourIds.length === 0
      ? []
      : await fetchInChunks<ReportRow>(tourIds, async (chunk) => {
          const { data, error } = await db
            .from('tour_reports')
            .select('id, tour_id, user_email, submitted_on')
            .in('tour_id', chunk)
          if (error) throw error
          return (data || []) as ReportRow[]
        })

  const reportsByTour = new Map<string, ReportRow[]>()
  for (const report of reports) {
    const tourId = report.tour_id
    if (!tourId) continue
    const list = reportsByTour.get(tourId) || []
    list.push(report)
    reportsByTour.set(tourId, list)
  }

  const emails = [
    ...new Set(
      [
        ...assigned.flatMap((tour) =>
          [tour.tour_guide_id, tour.assistant_id].map(normalizeTourReportEmail)
        ),
        ...reports.map((row) => normalizeTourReportEmail(row.user_email)),
      ].filter(Boolean)
    ),
  ]
  const teamRows =
    emails.length === 0
      ? []
      : await fetchInChunks<TeamRow>(emails, async (chunk) => {
          const { data, error } = await db
            .from('team')
            .select('email, name_ko, nick_name, phone, languages')
            .in('email', chunk)
          if (error) throw error
          return (data || []) as TeamRow[]
        })
  const teamByEmail = new Map(
    teamRows.map((row) => [normalizeTourReportEmail(row.email), row] as const)
  )

  const productIds = [...new Set(assigned.map((tour) => tour.product_id).filter(Boolean))] as string[]
  const products =
    productIds.length === 0
      ? []
      : await fetchInChunks<ProductRow>(productIds, async (chunk) => {
          const { data, error } = await db
            .from('products')
            .select('id, name, name_ko, name_en')
            .in('id', chunk)
          if (error) throw error
          return (data || []) as ProductRow[]
        })
  const productById = new Map(products.map((row) => [row.id, row] as const))

  const statusTours: TourReportStatusTour[] = assigned.map((tour) => {
    const productName = productNameForAdmin(
      tour.product_id ? productById.get(tour.product_id) : undefined,
      locale,
      tour.product_id || tour.id
    )
    const tourReports = reportsByTour.get(tour.id) || []
    const reportByEmail = new Map(
      tourReports.map((row) => [normalizeTourReportEmail(row.user_email), row] as const)
    )

    const staff: TourReportStatusStaff[] = []
    const pairs: Array<[TourReportStaffRole, string | null]> = [
      ['guide', tour.tour_guide_id],
      ['assistant', tour.assistant_id],
    ]
    for (const [role, rawEmail] of pairs) {
      const email = normalizeTourReportEmail(rawEmail)
      if (!email) continue
      const member = teamByEmail.get(email)
      const report = reportByEmail.get(email)
      staff.push({
        email,
        name: teamDisplayName(member, email),
        role,
        hasReport: Boolean(report),
        reportId: report?.id ?? null,
        submittedOn: report?.submitted_on ?? null,
        phone: member?.phone?.trim() || null,
        phoneE164: resolveSmsPhone(member?.phone),
        locale: staffMessageLocale(member),
      })
    }

    return {
      tourId: tour.id,
      tourDate: tour.tour_date,
      productName,
      tourStatus: tour.tour_status,
      staff,
      missingStaff: staff.filter((person) => !person.hasReport),
    }
  })

  const submitted: TourReportSubmittedRow[] = []
  for (const tour of statusTours) {
    for (const person of tour.staff) {
      if (!person.hasReport) continue
      submitted.push({
        id: person.reportId || `${tour.tourId}:${person.email}`,
        tourId: tour.tourId,
        tourDate: tour.tourDate,
        productName: tour.productName,
        userEmail: person.email,
        userName: person.name,
        role: person.role,
        submittedOn: person.submittedOn,
      })
    }
    const extraReports = (reportsByTour.get(tour.tourId) || []).filter((row) => {
      const email = normalizeTourReportEmail(row.user_email)
      return email && !tour.staff.some((person) => person.email === email)
    })
    for (const report of extraReports) {
      const email = normalizeTourReportEmail(report.user_email)
      submitted.push({
        id: report.id,
        tourId: tour.tourId,
        tourDate: tour.tourDate,
        productName: tour.productName,
        userEmail: email,
        userName: teamDisplayName(teamByEmail.get(email), email),
        role: 'other',
        submittedOn: report.submitted_on,
      })
    }
  }
  submitted.sort((a, b) => (b.submittedOn || '').localeCompare(a.submittedOn || ''))

  return {
    from,
    to,
    assignedTourCount: statusTours.length,
    missingTourCount: statusTours.filter((tour) => tour.missingStaff.length > 0).length,
    submittedReportCount: submitted.length,
    tours: statusTours,
    submitted,
  }
}

export function groupMissingReminderRecipients(
  tours: TourReportStatusTour[],
  targets: TourReportReminderTarget[] | null
): TourReportReminderRecipient[] {
  const wanted =
    targets && targets.length > 0
      ? new Set(
          targets.map((target) => `${target.tourId}:${normalizeTourReportEmail(target.email)}`)
        )
      : null

  const byEmail = new Map<string, TourReportReminderRecipient>()
  for (const tour of tours) {
    for (const person of tour.missingStaff) {
      const key = `${tour.tourId}:${person.email}`
      if (wanted && !wanted.has(key)) continue
      const existing = byEmail.get(person.email)
      const entry = existing || {
        email: person.email,
        name: person.name,
        phone: person.phone,
        phoneE164: person.phoneE164,
        locale: person.locale,
        tours: [],
      }
      entry.tours.push({
        tourId: tour.tourId,
        tourDate: tour.tourDate,
        productName: tour.productName,
        role: person.role,
      })
      byEmail.set(person.email, entry)
    }
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function buildTourReportReminderCopy(input: {
  locale: 'ko' | 'en'
  name: string
  tours: Array<{ tourDate: string; productName: string }>
  guideUrl: string
}): {
  emailSubject: string
  emailHtml: string
  smsBody: string
  pushTitle: string
  pushBody: string
} {
  const isEn = input.locale === 'en'
  const listed = input.tours.slice(0, 5)
  const extra = input.tours.length - listed.length
  const tourLines = listed.map((tour) => `${formatShortDate(tour.tourDate)} ${tour.productName}`)
  const extraLabel = extra > 0 ? (isEn ? ` +${extra} more` : ` 외 ${extra}건`) : ''
  const tourSummary = `${tourLines.join(', ')}${extraLabel}`

  const emailSubject = isEn
    ? `Please submit your tour report (${input.tours.length})`
    : `투어 리포트 제출 요청 (${input.tours.length}건)`

  const listHtml = listed
    .map(
      (tour) =>
        `<li>${escapeHtml(formatShortDate(tour.tourDate))} · ${escapeHtml(tour.productName)}</li>`
    )
    .join('')
  const extraHtml =
    extra > 0
      ? `<p>${isEn ? `and ${extra} more.` : `외 ${extra}건이 더 있습니다.`}</p>`
      : ''

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>${isEn ? `Hi ${escapeHtml(input.name)},` : `${escapeHtml(input.name)}님,`}</p>
      <p>${
        isEn
          ? 'Please submit a tour report for the following assigned tours. Reports are required from September 1.'
          : '아래 배정 투어의 리포트를 아직 제출하지 않으셨습니다. 9월 1일부터 투어 리포트 제출이 필수입니다.'
      }</p>
      <ul>${listHtml}</ul>
      ${extraHtml}
      <p><a href="${escapeHtml(input.guideUrl)}">${
        isEn ? 'Open the guide app and submit' : '가이드 앱에서 제출하기'
      }</a></p>
    </div>
  `.trim()

  const smsBody = isEn
    ? `[Maniatour] Please submit your tour report: ${tourSummary}. ${input.guideUrl}`
    : `[Maniatour] 미작성 투어 리포트가 있습니다. ${tourSummary}. 가이드 앱에서 제출해 주세요. ${input.guideUrl}`

  const pushTitle = isEn ? 'Tour report needed' : '투어 리포트 제출 요청'
  const pushBody = isEn
    ? `${input.tours.length} unsubmitted report(s): ${tourSummary}`
    : `미작성 리포트 ${input.tours.length}건: ${tourSummary}`

  return { emailSubject, emailHtml, smsBody, pushTitle, pushBody }
}

export function publicAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
  )
}

export function guidePortalUrl(locale: 'ko' | 'en'): string {
  const base = publicAppBaseUrl().replace(/\/$/, '')
  return `${base}/${locale}/guide`
}
