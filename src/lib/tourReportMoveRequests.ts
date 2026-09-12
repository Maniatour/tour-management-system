import type { SupabaseClient } from '@supabase/supabase-js'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeTourReportEmail } from '@/lib/tourReportMissing'
import { tourReportText } from '@/lib/tourReportExtras'

export const TOUR_REPORT_MOVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type TourReportMoveStatus = (typeof TOUR_REPORT_MOVE_STATUSES)[number]

export type TourReportMoveAssignedRole = 'guide' | 'assistant'

export type TourReportMoveTourSummary = {
  id: string
  tourDate: string
  productName: string
  tourStatus: string | null
}

export type TourReportMoveCandidate = TourReportMoveTourSummary & {
  assignedRole: TourReportMoveAssignedRole | null
  hasOwnReport: boolean
  blockedReason: TourReportMoveBlockReason | null
}

export type TourReportMoveRequestView = {
  id: string
  reportId: string
  status: TourReportMoveStatus
  reason: string | null
  requestedBy: string
  requestedByName: string
  fromTour: TourReportMoveTourSummary
  toTour: TourReportMoveTourSummary
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export type TourReportMoveBlockReason =
  | 'same_tour'
  | 'cancelled'
  | 'own_report_exists'
  | 'missing_target'
  | 'missing_report'
  | 'not_owner'
  | 'already_pending'
  | 'not_pending'

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MAX_REASON_LEN = 500

type ProductNameRow = {
  id: string
  name: string | null
  name_ko: string | null
  name_en: string | null
}

type TourRow = {
  id: string
  tour_date: string
  tour_status: string | null
  product_id: string | null
  tour_guide_id: string | null
  assistant_id: string | null
}

type ReportRow = {
  id: string
  tour_id: string | null
  user_email: string
  office_note: string | null
}

type MoveRequestRow = {
  id: string
  report_id: string
  from_tour_id: string
  to_tour_id: string
  requested_by: string
  reason: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

export function isTourReportMoveStatus(value: string): value is TourReportMoveStatus {
  return (TOUR_REPORT_MOVE_STATUSES as readonly string[]).includes(value)
}

export function productNameForLocale(
  product: ProductNameRow | undefined,
  locale: string,
  fallback: string
): string {
  if (!product) return fallback
  const isEn = locale.startsWith('en')
  const ko = product.name_ko || product.name || product.name_en || fallback
  const en = product.name_en || product.name || product.name_ko || fallback
  return isEn ? en : ko
}

export function assignedRoleForEmail(
  tour: Pick<TourRow, 'tour_guide_id' | 'assistant_id'>,
  email: string
): TourReportMoveAssignedRole | null {
  const normalized = normalizeTourReportEmail(email)
  if (!normalized) return null
  if (normalizeTourReportEmail(tour.tour_guide_id) === normalized) return 'guide'
  if (normalizeTourReportEmail(tour.assistant_id) === normalized) return 'assistant'
  return null
}

export function getMoveBlockReason(input: {
  fromTourId: string
  toTour: Pick<TourRow, 'id' | 'tour_status'> | null
  hasOwnReportOnTarget: boolean
}): TourReportMoveBlockReason | null {
  if (!input.toTour) return 'missing_target'
  if (input.toTour.id === input.fromTourId) return 'same_tour'
  if (isTourCancelled(input.toTour.tour_status)) return 'cancelled'
  if (input.hasOwnReportOnTarget) return 'own_report_exists'
  return null
}

export function moveBlockMessage(reason: TourReportMoveBlockReason, locale: string): string {
  const map: Record<TourReportMoveBlockReason, { ko: string; en: string }> = {
    same_tour: {
      ko: '지금 있는 투어와 같은 곳으로는 옮길 수 없습니다.',
      en: 'Choose a different tour than the current one.',
    },
    cancelled: {
      ko: '취소된 투어로는 옮길 수 없습니다.',
      en: 'That tour is cancelled.',
    },
    own_report_exists: {
      ko: '이미 그 투어에 작성한 리포트가 있습니다.',
      en: 'You already have a report on that tour.',
    },
    missing_target: {
      ko: '옮길 투어를 찾을 수 없습니다.',
      en: 'The destination tour was not found.',
    },
    missing_report: {
      ko: '리포트를 찾을 수 없습니다.',
      en: 'The report was not found.',
    },
    not_owner: {
      ko: '본인이 작성한 리포트만 이동 요청할 수 있습니다.',
      en: 'You can only request a move for your own report.',
    },
    already_pending: {
      ko: '이미 사무실 확인을 기다리는 이동 요청이 있습니다.',
      en: 'A move request is already waiting for office review.',
    },
    not_pending: {
      ko: '대기 중인 요청만 처리할 수 있습니다.',
      en: 'Only a pending request can be updated.',
    },
  }
  return tourReportText(locale, map[reason].ko, map[reason].en)
}

export function sortMoveCandidates(a: TourReportMoveCandidate, b: TourReportMoveCandidate): number {
  const aAssigned = a.assignedRole ? 0 : 1
  const bAssigned = b.assignedRole ? 0 : 1
  if (aAssigned !== bAssigned) return aAssigned - bAssigned
  const aBlocked = a.blockedReason ? 1 : 0
  const bBlocked = b.blockedReason ? 1 : 0
  if (aBlocked !== bBlocked) return aBlocked - bBlocked
  return a.productName.localeCompare(b.productName, 'en')
}

export function buildMoveOfficeNote(input: {
  existing: string | null | undefined
  fromTour: TourReportMoveTourSummary
  toTour: TourReportMoveTourSummary
  reviewedBy: string
  locale: string
}): string {
  const line = tourReportText(
    input.locale,
    `리포트 이동 승인: ${input.fromTour.tourDate} ${input.fromTour.productName} → ${input.toTour.tourDate} ${input.toTour.productName} (${input.reviewedBy})`,
    `Report moved: ${input.fromTour.tourDate} ${input.fromTour.productName} → ${input.toTour.tourDate} ${input.toTour.productName} (${input.reviewedBy})`
  )
  const existing = (input.existing || '').trim()
  return existing ? `${existing}\n${line}` : line
}

export function sanitizeMoveReason(reason: string | null | undefined): string | null {
  const trimmed = (reason || '').trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_REASON_LEN)
}

function requireAdminDb(db: SupabaseClient): SupabaseClient {
  return db
}

async function loadProductsById(
  db: SupabaseClient,
  productIds: string[]
): Promise<Map<string, ProductNameRow>> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const { data, error } = await db.from('products').select('id, name, name_ko, name_en').in('id', ids)
  if (error) throw error
  return new Map(((data || []) as ProductNameRow[]).map((row) => [row.id, row]))
}

async function loadToursById(db: SupabaseClient, ids: string[]): Promise<Map<string, TourRow>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await db
    .from('tours')
    .select('id, tour_date, tour_status, product_id, tour_guide_id, assistant_id')
    .in('id', unique)
  if (error) throw error
  return new Map(((data || []) as TourRow[]).map((row) => [row.id, row]))
}

function toTourSummary(
  tour: TourRow | undefined,
  products: Map<string, ProductNameRow>,
  locale: string,
  fallbackId: string
): TourReportMoveTourSummary {
  const product = tour?.product_id ? products.get(tour.product_id) : undefined
  return {
    id: tour?.id || fallbackId,
    tourDate: tour?.tour_date || '',
    productName: productNameForLocale(product, locale, tour?.product_id || fallbackId),
    tourStatus: tour?.tour_status ?? null,
  }
}

async function loadTeamNames(
  db: SupabaseClient,
  emails: string[],
  locale: string
): Promise<Map<string, string>> {
  const unique = [...new Set(emails.map(normalizeTourReportEmail).filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await db.from('team').select('email, name_ko, name_en, nick_name').in('email', unique)
  if (error) throw error
  const map = new Map<string, string>()
  for (const row of data || []) {
    const email = normalizeTourReportEmail(row.email)
    const nick = String(row.nick_name || '').trim()
    const nameKo = String(row.name_ko || '').trim()
    const nameEn = String(row.name_en || '').trim()
    const name = locale.startsWith('en')
      ? nameEn || nick || nameKo || email
      : nick || nameKo || nameEn || email
    if (email) map.set(email, name)
  }
  return map
}

async function hydrateRequests(
  db: SupabaseClient,
  rows: MoveRequestRow[],
  locale: string
): Promise<TourReportMoveRequestView[]> {
  if (rows.length === 0) return []
  const tourIds = rows.flatMap((row) => [row.from_tour_id, row.to_tour_id])
  const tours = await loadToursById(db, tourIds)
  const products = await loadProductsById(
    db,
    [...tours.values()].map((tour) => tour.product_id || '').filter(Boolean)
  )
  const names = await loadTeamNames(
    db,
    rows.map((row) => row.requested_by),
    locale
  )
  return rows.map((row) => {
    const requestedBy = normalizeTourReportEmail(row.requested_by)
    const status = isTourReportMoveStatus(row.status) ? row.status : 'pending'
    return {
      id: row.id,
      reportId: row.report_id,
      status,
      reason: row.reason,
      requestedBy,
      requestedByName: names.get(requestedBy) || requestedBy,
      fromTour: toTourSummary(tours.get(row.from_tour_id), products, locale, row.from_tour_id),
      toTour: toTourSummary(tours.get(row.to_tour_id), products, locale, row.to_tour_id),
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      createdAt: row.created_at,
    }
  })
}

export async function listMoveCandidatesForGuide(
  db: SupabaseClient,
  input: { reportId: string; date: string; actingEmail: string; locale: string }
): Promise<{ current: TourReportMoveTourSummary; candidates: TourReportMoveCandidate[] }> {
  const email = normalizeTourReportEmail(input.actingEmail)
  if (!email) throw new Error(moveBlockMessage('not_owner', input.locale))
  if (!DATE_RE.test(input.date)) {
    throw new Error(tourReportText(input.locale, '날짜 형식이 올바르지 않습니다.', 'Invalid date.'))
  }

  const { data: report, error: reportError } = await db
    .from('tour_reports')
    .select('id, tour_id, user_email')
    .eq('id', input.reportId)
    .maybeSingle()
  if (reportError) throw reportError
  const reportRow = report as ReportRow | null
  if (!reportRow?.tour_id) throw new Error(moveBlockMessage('missing_report', input.locale))
  if (normalizeTourReportEmail(reportRow.user_email) !== email) {
    throw new Error(moveBlockMessage('not_owner', input.locale))
  }

  const toursById = await loadToursById(db, [reportRow.tour_id])
  const currentTour = toursById.get(reportRow.tour_id)
  const { data: dayTours, error: dayError } = await db
    .from('tours')
    .select('id, tour_date, tour_status, product_id, tour_guide_id, assistant_id')
    .eq('tour_date', input.date)
    .order('id', { ascending: true })
  if (dayError) throw dayError
  const dayRows = (dayTours || []) as TourRow[]
  const products = await loadProductsById(
    db,
    [...(currentTour ? [currentTour.product_id || ''] : []), ...dayRows.map((row) => row.product_id || '')]
  )

  const tourIds = dayRows.map((row) => row.id)
  const { data: existingReports, error: existingError } =
    tourIds.length === 0
      ? { data: [], error: null }
      : await db.from('tour_reports').select('tour_id, user_email').in('tour_id', tourIds)
  if (existingError) throw existingError
  const ownReportTourIds = new Set(
    ((existingReports || []) as Array<{ tour_id: string | null; user_email: string }>)
      .filter((row) => normalizeTourReportEmail(row.user_email) === email)
      .map((row) => row.tour_id)
      .filter((id): id is string => Boolean(id))
  )

  const current = toTourSummary(currentTour, products, input.locale, reportRow.tour_id)
  const candidates = dayRows
    .map((tour): TourReportMoveCandidate => {
      const hasOwnReport = ownReportTourIds.has(tour.id)
      const blockedReason = getMoveBlockReason({
        fromTourId: reportRow.tour_id as string,
        toTour: tour,
        hasOwnReportOnTarget: hasOwnReport && tour.id !== reportRow.tour_id,
      })
      return {
        ...toTourSummary(tour, products, input.locale, tour.id),
        assignedRole: assignedRoleForEmail(tour, email),
        hasOwnReport,
        blockedReason,
      }
    })
    .sort(sortMoveCandidates)

  return { current, candidates }
}

export async function listMoveRequests(
  db: SupabaseClient,
  input: {
    locale: string
    status?: TourReportMoveStatus | 'all'
    requestedBy?: string
    reportIds?: string[]
  }
): Promise<TourReportMoveRequestView[]> {
  const admin = requireAdminDb(db)
  let query = admin
    .from('tour_report_move_requests')
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (input.status && input.status !== 'all') {
    query = query.eq('status', input.status)
  }
  if (input.requestedBy) {
    query = query.eq('requested_by', normalizeTourReportEmail(input.requestedBy))
  }
  if (input.reportIds && input.reportIds.length > 0) {
    query = query.in('report_id', input.reportIds)
  }

  const { data, error } = await query
  if (error) throw error
  return hydrateRequests(admin, (data || []) as MoveRequestRow[], input.locale)
}

export async function createMoveRequest(
  db: SupabaseClient,
  input: { reportId: string; toTourId: string; reason?: string | null | undefined; actingEmail: string; locale: string }
): Promise<TourReportMoveRequestView> {
  const email = normalizeTourReportEmail(input.actingEmail)
  if (!email) throw new Error(moveBlockMessage('not_owner', input.locale))
  const toTourId = input.toTourId.trim()
  if (!toTourId) throw new Error(moveBlockMessage('missing_target', input.locale))

  const { data: report, error: reportError } = await db
    .from('tour_reports')
    .select('id, tour_id, user_email')
    .eq('id', input.reportId)
    .maybeSingle()
  if (reportError) throw reportError
  const reportRow = report as ReportRow | null
  if (!reportRow?.tour_id) throw new Error(moveBlockMessage('missing_report', input.locale))
  if (normalizeTourReportEmail(reportRow.user_email) !== email) {
    throw new Error(moveBlockMessage('not_owner', input.locale))
  }

  const tours = await loadToursById(db, [reportRow.tour_id, toTourId])
  const target = tours.get(toTourId) || null
  const { data: existingOnTarget, error: existingError } = await db
    .from('tour_reports')
    .select('id, user_email')
    .eq('tour_id', toTourId)
  if (existingError) throw existingError
  const hasOwnReportOnTarget = ((existingOnTarget || []) as Array<{ id: string; user_email: string }>).some(
    (row) => row.id !== reportRow.id && normalizeTourReportEmail(row.user_email) === email
  )
  const blocked = getMoveBlockReason({
    fromTourId: reportRow.tour_id,
    toTour: target,
    hasOwnReportOnTarget,
  })
  if (blocked) throw new Error(moveBlockMessage(blocked, input.locale))

  const { data: pending, error: pendingError } = await db
    .from('tour_report_move_requests')
    .select('id')
    .eq('report_id', reportRow.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (pendingError) throw pendingError
  if (pending) throw new Error(moveBlockMessage('already_pending', input.locale))

  const now = new Date().toISOString()
  const { data: inserted, error: insertError } = await db
    .from('tour_report_move_requests')
    .insert({
      report_id: reportRow.id,
      from_tour_id: reportRow.tour_id,
      to_tour_id: toTourId,
      requested_by: email,
      reason: sanitizeMoveReason(input.reason),
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .single()
  if (insertError) {
    if (insertError.code === '23505') throw new Error(moveBlockMessage('already_pending', input.locale))
    throw insertError
  }

  const [view] = await hydrateRequests(db, [inserted as MoveRequestRow], input.locale)
  return view
}

export async function cancelMoveRequest(
  db: SupabaseClient,
  input: { requestId: string; actingEmail: string; locale: string }
): Promise<TourReportMoveRequestView> {
  const email = normalizeTourReportEmail(input.actingEmail)
  const { data: row, error } = await db
    .from('tour_report_move_requests')
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .eq('id', input.requestId)
    .maybeSingle()
  if (error) throw error
  const request = row as MoveRequestRow | null
  if (!request) throw new Error(moveBlockMessage('missing_report', input.locale))
  if (normalizeTourReportEmail(request.requested_by) !== email) {
    throw new Error(moveBlockMessage('not_owner', input.locale))
  }
  if (request.status !== 'pending') throw new Error(moveBlockMessage('not_pending', input.locale))

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('tour_report_move_requests')
    .update({ status: 'cancelled', updated_at: now, reviewed_at: now, reviewed_by: email })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) throw new Error(moveBlockMessage('not_pending', input.locale))
  const [view] = await hydrateRequests(db, [updated as MoveRequestRow], input.locale)
  return view
}

export async function reviewMoveRequest(
  db: SupabaseClient,
  input: {
    requestId: string
    action: 'approve' | 'reject'
    reviewNote?: string | null | undefined
    reviewerEmail: string
    locale: string
  }
): Promise<TourReportMoveRequestView> {
  const reviewer = normalizeTourReportEmail(input.reviewerEmail)
  const { data: row, error } = await db
    .from('tour_report_move_requests')
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .eq('id', input.requestId)
    .maybeSingle()
  if (error) throw error
  const request = row as MoveRequestRow | null
  if (!request) throw new Error(moveBlockMessage('missing_report', input.locale))
  if (request.status !== 'pending') throw new Error(moveBlockMessage('not_pending', input.locale))

  const now = new Date().toISOString()
  const reviewNote = sanitizeMoveReason(input.reviewNote)

  if (input.action === 'reject') {
    const { data: updated, error: updateError } = await db
      .from('tour_report_move_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewer,
        reviewed_at: now,
        review_note: reviewNote,
        updated_at: now,
      })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select(
        'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
      )
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new Error(moveBlockMessage('not_pending', input.locale))
    const [view] = await hydrateRequests(db, [updated as MoveRequestRow], input.locale)
    return view
  }

  const { data: report, error: reportError } = await db
    .from('tour_reports')
    .select('id, tour_id, user_email, office_note')
    .eq('id', request.report_id)
    .maybeSingle()
  if (reportError) throw reportError
  const reportRow = report as ReportRow | null
  if (!reportRow) throw new Error(moveBlockMessage('missing_report', input.locale))

  const tours = await loadToursById(db, [reportRow.tour_id || request.from_tour_id, request.to_tour_id])
  const target = tours.get(request.to_tour_id) || null
  const { data: existingOnTarget, error: existingError } = await db
    .from('tour_reports')
    .select('id, user_email')
    .eq('tour_id', request.to_tour_id)
  if (existingError) throw existingError
  const requesterEmail = normalizeTourReportEmail(reportRow.user_email)
  const hasOwnReportOnTarget = ((existingOnTarget || []) as Array<{ id: string; user_email: string }>).some(
    (row) => row.id !== reportRow.id && normalizeTourReportEmail(row.user_email) === requesterEmail
  )
  const fromTourId = reportRow.tour_id || request.from_tour_id
  if (reportRow.tour_id !== request.to_tour_id) {
    const blocked = getMoveBlockReason({
      fromTourId,
      toTour: target,
      hasOwnReportOnTarget,
    })
    if (blocked) throw new Error(moveBlockMessage(blocked, input.locale))
  }

  const products = await loadProductsById(
    db,
    [tours.get(fromTourId)?.product_id || '', target?.product_id || ''].filter(Boolean)
  )
  const fromSummary = toTourSummary(tours.get(fromTourId), products, input.locale, fromTourId)
  const toSummary = toTourSummary(target || undefined, products, input.locale, request.to_tour_id)
  const officeNote = buildMoveOfficeNote({
    existing: reportRow.office_note,
    fromTour: fromSummary,
    toTour: toSummary,
    reviewedBy: reviewer,
    locale: input.locale,
  })

  if (reportRow.tour_id !== request.to_tour_id) {
    const { error: moveError } = await db
      .from('tour_reports')
      .update({
        tour_id: request.to_tour_id,
        office_note: officeNote,
        updated_at: now,
      })
      .eq('id', reportRow.id)
    if (moveError) throw moveError
  } else {
    const { error: noteError } = await db
      .from('tour_reports')
      .update({ office_note: officeNote, updated_at: now })
      .eq('id', reportRow.id)
    if (noteError) throw noteError
  }

  const { data: updated, error: updateError } = await db
    .from('tour_report_move_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewer,
      reviewed_at: now,
      review_note: reviewNote,
      updated_at: now,
    })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select(
      'id, report_id, from_tour_id, to_tour_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) throw new Error(moveBlockMessage('not_pending', input.locale))
  const [view] = await hydrateRequests(db, [updated as MoveRequestRow], input.locale)
  return view
}
