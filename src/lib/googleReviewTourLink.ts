import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { postgrestIlikeQuoted } from '@/lib/postgrestSearchUtils'
import { resolveProductInternalName } from '@/utils/reservationUtils'
import { toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { isReservationCancelledStatus, normalizeReservationIds } from '@/utils/tourUtils'
import {
  findMentionedGuides,
  loadGuideNameProfiles,
  type GuideNameProfile,
} from '@/lib/googleReviewClassification'

type TourCandidate = {
  id: string
  tour_date: string
  product_id: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_status?: string | null
}

type ReviewForTourLink = {
  id: string
  comment: string | null
  review_created_at: string | null
  rating: number | null
  productId: string | null
}

export type GoogleReviewTourLinkSummary = {
  tourId: string
  tourDate: string | null
  productName: string | null
  matchMethod: string | null
}

export type GoogleReviewStaffLinkSummary = {
  staffEmail: string
  staffName: string | null
  staffRole: 'guide' | 'assistant'
  matchMethod: string | null
}

export type GoogleReviewTourSearchItem = {
  id: string
  tourDate: string
  productId: string | null
  productName: string | null
  guideName: string | null
  assistantName: string | null
  totalPeople: number
  customerNames: string[]
}

type TourSearchRow = {
  id: string
  tour_date: string
  product_id: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_status?: string | null
  reservation_ids?: unknown
  products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

const TOUR_SEARCH_SELECT =
  'id, tour_date, product_id, tour_guide_id, assistant_id, tour_status, reservation_ids, products(name, name_ko, name_en)'

function hasGuideAssigned(row: { tour_guide_id?: string | null }): boolean {
  return Boolean(row.tour_guide_id?.trim())
}

function filterSelectableTourRows<
  T extends { tour_status?: string | null; tour_guide_id?: string | null },
>(rows: T[]): T[] {
  return rows.filter(
    (row) => !isTourCancelled(row.tour_status) && hasGuideAssigned(row)
  )
}

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function loadTeamNameByEmail(emails: string[]): Promise<Map<string, string>> {
  const teamByEmail = new Map<string, string>()
  if (!supabaseAdmin || emails.length === 0) return teamByEmail

  const { data: teamRows } = await supabaseAdmin
    .from('team')
    .select('email, nick_name, name_ko, name_en')
    .in('email', emails)

  for (const member of teamRows ?? []) {
    const label = member.nick_name || member.name_ko || member.name_en || member.email
    teamByEmail.set(member.email.toLowerCase(), label)
  }

  return teamByEmail
}

function appendUniqueName(names: string[], name: string | null | undefined): void {
  const trimmed = name?.trim()
  if (!trimmed || names.includes(trimmed)) return
  names.push(trimmed)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

type CustomerNameFields = {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

function pickCustomerDisplayName(fields: CustomerNameFields | null | undefined): string | null {
  if (!fields) return null
  const name = fields.name?.trim() || fields.name_ko?.trim() || fields.name_en?.trim()
  return name || null
}

function pickReservationRepresentativeName(input: {
  customerId: string | null
  firstGuest?: CustomerNameFields & { customer_id?: string | null } | null
  customersById: Map<string, CustomerNameFields>
}): string | null {
  if (input.firstGuest?.customer_id) {
    const fromGuestCustomer = pickCustomerDisplayName(
      input.customersById.get(input.firstGuest.customer_id)
    )
    if (fromGuestCustomer) return fromGuestCustomer
  }

  const fromGuest = pickCustomerDisplayName(input.firstGuest)
  if (fromGuest) return fromGuest

  if (input.customerId) {
    return pickCustomerDisplayName(input.customersById.get(input.customerId))
  }

  return null
}

async function loadReservationRepresentativeNames(
  operatorId: string,
  reservationIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (!supabaseAdmin || reservationIds.length === 0) return result

  const uniqueIds = [...new Set(reservationIds.filter(Boolean))]
  const reservations: Array<{ id: string; customer_id: string | null; status: string | null }> = []

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const { data, error } = await fromUntypedTable(supabaseAdmin, 'reservations')
      .select('id, customer_id, status')
      .eq('operator_id', operatorId)
      .in('id', chunk)
      .neq('status', 'deleted')

    if (error) {
      console.error('[googleReviewTourLink] load reservations for names failed', error.message)
      continue
    }

    reservations.push(
      ...((data ?? []) as Array<{ id: string; customer_id: string | null; status: string | null }>)
    )
  }

  if (!reservations.length) return result

  const firstGuestByReservation = new Map<
    string,
    CustomerNameFields & { customer_id?: string | null }
  >()

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const { data, error } = await fromUntypedTable(supabaseAdmin, 'reservation_customers')
      .select('reservation_id, customer_id, name, name_ko, name_en, order_index')
      .in('reservation_id', chunk)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('[googleReviewTourLink] load reservation_customers for names failed', error.message)
      continue
    }

    for (const row of (data ?? []) as Array<{
      reservation_id: string
      customer_id?: string | null
      name?: string | null
      name_ko?: string | null
      name_en?: string | null
    }>) {
      if (!firstGuestByReservation.has(row.reservation_id)) {
        firstGuestByReservation.set(row.reservation_id, row)
      }
    }
  }

  const customerIds = new Set<string>()
  for (const reservation of reservations) {
    if (reservation.customer_id) customerIds.add(reservation.customer_id)
  }
  for (const guest of firstGuestByReservation.values()) {
    if (guest.customer_id) customerIds.add(guest.customer_id)
  }

  const customersById = new Map<string, CustomerNameFields>()
  if (customerIds.size > 0) {
    for (const chunk of chunkArray([...customerIds], 100)) {
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, name')
        .eq('operator_id', operatorId)
        .in('id', chunk)

      if (error) {
        console.error('[googleReviewTourLink] load customers for names failed', error.message)
        continue
      }

      for (const row of (data ?? []) as Array<{ id: string; name?: string | null }>) {
        customersById.set(row.id, { name: row.name ?? null })
      }
    }
  }

  for (const reservation of reservations) {
    if (isReservationCancelledStatus(reservation.status)) continue

    const name = pickReservationRepresentativeName({
      customerId: reservation.customer_id,
      firstGuest: firstGuestByReservation.get(reservation.id) ?? null,
      customersById,
    })

    if (name) result.set(reservation.id, name)
  }

  return result
}

async function findTourIdsByCustomerName(input: {
  operatorId: string
  customerQuery: string
  tourDate?: string | null
  productId?: string | null
  limit?: number
}): Promise<string[]> {
  if (!supabaseAdmin) return []

  const operatorId = resolveOperatorId(input.operatorId)
  const likePat = `%${input.customerQuery.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  const ilikeQuoted = postgrestIlikeQuoted(input.customerQuery)
  const tourIds = new Set<string>()
  const matchingReservationIds = new Set<string>()

  const { data: customerRows, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('operator_id', operatorId)
    .ilike('name', likePat)
    .limit(100)

  if (customerError) throw new Error(customerError.message)

  const customerIds = ((customerRows ?? []) as Array<{ id: string }>).map((row) => row.id)

  const { data: reservationCustomerRows, error: reservationCustomerError } = await fromUntypedTable(
    supabaseAdmin,
    'reservation_customers'
  )
    .select('reservation_id')
    .or(`name.ilike.${ilikeQuoted},name_ko.ilike.${ilikeQuoted},name_en.ilike.${ilikeQuoted}`)
    .limit(200)

  if (reservationCustomerError) throw new Error(reservationCustomerError.message)

  const reservationIdsFromGuests = [
    ...new Set(
      ((reservationCustomerRows ?? []) as Array<{ reservation_id: string | null }>)
        .map((row) => row.reservation_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  for (const reservationId of reservationIdsFromGuests) {
    matchingReservationIds.add(reservationId)
  }

  if (customerIds.length) {
    let reservationQuery = fromUntypedTable(supabaseAdmin, 'reservations')
      .select('id, tour_id')
      .eq('operator_id', operatorId)
      .in('customer_id', customerIds)
      .neq('status', 'deleted')
      .limit(200)

    if (input.tourDate) {
      reservationQuery = reservationQuery.eq('tour_date', input.tourDate)
    }
    if (input.productId) {
      reservationQuery = reservationQuery.eq('product_id', input.productId)
    }

    const { data: reservationRows, error: reservationError } = await reservationQuery
    if (reservationError) throw new Error(reservationError.message)

    for (const row of (reservationRows ?? []) as Array<{ id: string; tour_id: string | null }>) {
      matchingReservationIds.add(row.id)
      if (row.tour_id) tourIds.add(row.tour_id)
    }
  }

  if (matchingReservationIds.size > 0) {
    const reservationIdList = [...matchingReservationIds]

    for (let i = 0; i < reservationIdList.length; i += 100) {
      const chunk = reservationIdList.slice(i, i + 100)
      let reservationQuery = fromUntypedTable(supabaseAdmin, 'reservations')
        .select('id, tour_id')
        .eq('operator_id', operatorId)
        .in('id', chunk)
        .neq('status', 'deleted')

      if (input.tourDate) {
        reservationQuery = reservationQuery.eq('tour_date', input.tourDate)
      }
      if (input.productId) {
        reservationQuery = reservationQuery.eq('product_id', input.productId)
      }

      const { data: reservationRows, error: reservationError } = await reservationQuery
      if (reservationError) throw new Error(reservationError.message)

      for (const row of (reservationRows ?? []) as Array<{ id: string; tour_id: string | null }>) {
        if (row.tour_id) tourIds.add(row.tour_id)
      }
    }

    for (let i = 0; i < reservationIdList.length; i += 50) {
      const chunk = reservationIdList.slice(i, i + 50)
      let tourQuery = supabaseAdmin
        .from('tours')
        .select('id')
        .eq('operator_id', operatorId)
        .overlaps('reservation_ids', chunk)

      if (input.tourDate) {
        tourQuery = tourQuery.eq('tour_date', input.tourDate)
      }
      if (input.productId) {
        tourQuery = tourQuery.eq('product_id', input.productId)
      }

      const { data: tourRows, error: tourError } = await tourQuery
      if (tourError) throw new Error(tourError.message)

      for (const row of (tourRows ?? []) as Array<{ id: string }>) {
        tourIds.add(row.id)
      }
    }
  }

  return [...tourIds]
}

async function loadReservationMetaById(
  operatorId: string,
  reservationIds: string[]
): Promise<
  Map<
    string,
    {
      status: string | null
      total_people: number | null
      product_id: string | null
      tour_date: string | null
    }
  >
> {
  const reservationsById = new Map<
    string,
    {
      status: string | null
      total_people: number | null
      product_id: string | null
      tour_date: string | null
    }
  >()

  if (!supabaseAdmin || reservationIds.length === 0) return reservationsById

  for (const chunk of chunkArray(reservationIds, 100)) {
    const { data, error } = await fromUntypedTable(supabaseAdmin, 'reservations')
      .select('id, status, total_people, product_id, tour_date')
      .eq('operator_id', operatorId)
      .in('id', chunk)
      .neq('status', 'deleted')

    if (error) {
      console.error('[googleReviewTourLink] load reservations failed', error.message)
      continue
    }

    for (const row of (data ?? []) as Array<{
      id: string
      status: string | null
      total_people: number | null
      product_id: string | null
      tour_date: string | null
    }>) {
      reservationsById.set(row.id, row)
    }
  }

  return reservationsById
}

function getAssignedReservationIdsForTour(
  tour: { product_id?: string | null; tour_date?: string | null; reservation_ids?: unknown },
  reservationsById: Map<
    string,
    {
      status: string | null
      product_id?: string | null
      tour_date?: string | null
    }
  >
): string[] {
  const tourProductId = (tour.product_id ?? '').toString().trim()
  const tourDate = String(tour.tour_date ?? '').slice(0, 10)
  const counted = new Set<string>()
  const ids: string[] = []

  for (const id of normalizeReservationIds(tour.reservation_ids)) {
    const reservationId = id.trim()
    if (!reservationId || counted.has(reservationId)) continue
    counted.add(reservationId)

    const row = reservationsById.get(reservationId)
    if (!row || isReservationCancelledStatus(row.status)) continue

    if (tourProductId && (row.product_id ?? '').toString().trim() !== tourProductId) continue
    const reservationDate = String(row.tour_date ?? '').slice(0, 10)
    if (tourDate && reservationDate && reservationDate !== tourDate) continue

    ids.push(reservationId)
  }

  return ids
}

function sumAssignedTourTotalPeople(
  tour: { product_id?: string | null; tour_date?: string | null; reservation_ids?: unknown },
  reservationsById: Map<
    string,
    {
      status: string | null
      total_people: number | null
      product_id?: string | null
      tour_date?: string | null
    }
  >
): number {
  let total = 0
  for (const reservationId of getAssignedReservationIdsForTour(tour, reservationsById)) {
    const people = reservationsById.get(reservationId)?.total_people
    if (typeof people === 'number' && !Number.isNaN(people)) {
      total += people
    }
  }
  return total
}

async function loadTotalPeopleByTourId(
  operatorId: string,
  tourRows: Array<{
    id: string
    reservation_ids?: unknown
    product_id?: string | null
    tour_date?: string | null
  }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!supabaseAdmin || tourRows.length === 0) return result

  const allReservationIds = [
    ...new Set(tourRows.flatMap((tour) => normalizeReservationIds(tour.reservation_ids))),
  ]
  if (allReservationIds.length === 0) return result

  const reservationsById = await loadReservationMetaById(operatorId, allReservationIds)

  for (const tour of tourRows) {
    result.set(tour.id, sumAssignedTourTotalPeople(tour, reservationsById))
  }

  return result
}

async function loadCustomerNamesByTourId(
  operatorId: string,
  tourRows: Array<{
    id: string
    reservation_ids?: unknown
    product_id?: string | null
    tour_date?: string | null
  }>
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (!supabaseAdmin || tourRows.length === 0) return result

  const allReservationIds = [
    ...new Set(tourRows.flatMap((tour) => normalizeReservationIds(tour.reservation_ids))),
  ]
  if (allReservationIds.length === 0) return result

  const reservationsById = await loadReservationMetaById(operatorId, allReservationIds)
  const validatedIdsByTour = new Map<string, string[]>()
  const validatedReservationIds = new Set<string>()

  for (const tour of tourRows) {
    const ids = getAssignedReservationIdsForTour(tour, reservationsById)
    validatedIdsByTour.set(tour.id, ids)
    for (const id of ids) validatedReservationIds.add(id)
  }

  if (validatedReservationIds.size === 0) return result

  const reservationNames = await loadReservationRepresentativeNames(operatorId, [
    ...validatedReservationIds,
  ])

  for (const [tourId, reservationIds] of validatedIdsByTour) {
    const names: string[] = []
    for (const reservationId of reservationIds) {
      appendUniqueName(names, reservationNames.get(reservationId))
    }
    if (names.length) {
      result.set(tourId, names)
    }
  }

  return result
}

async function mapTourRowsToSearchItems(
  operatorId: string,
  rows: TourSearchRow[],
  options?: { includeCustomerNames?: boolean }
): Promise<GoogleReviewTourSearchItem[]> {
  if (!rows.length) return []

  const emails = [
    ...new Set(
      rows
        .flatMap((row) => [row.tour_guide_id, row.assistant_id])
        .filter((email): email is string => Boolean(email?.trim()))
    ),
  ]

  const teamByEmail = await loadTeamNameByEmail(emails)
  const includeCustomerNames = options?.includeCustomerNames !== false
  const [customerNamesByTour, totalPeopleByTour] = await Promise.all([
    includeCustomerNames
      ? loadCustomerNamesByTourId(operatorId, rows)
      : Promise.resolve(new Map<string, string[]>()),
    loadTotalPeopleByTourId(operatorId, rows),
  ])

  return rows.map((row) => {
    const productName = resolveProductInternalName(row.products, row.product_id)
    const guideName = row.tour_guide_id
      ? teamByEmail.get(row.tour_guide_id.toLowerCase()) ?? row.tour_guide_id
      : null
    const assistantName = row.assistant_id
      ? teamByEmail.get(row.assistant_id.toLowerCase()) ?? row.assistant_id
      : null

    return {
      id: row.id,
      tourDate: row.tour_date,
      productId: row.product_id ?? null,
      productName: productName ?? null,
      guideName,
      assistantName,
      totalPeople: totalPeopleByTour.get(row.id) ?? 0,
      customerNames: customerNamesByTour.get(row.id) ?? [],
    }
  })
}

async function fetchTourSearchRowById(
  operatorId: string,
  tourId: string
): Promise<TourSearchRow | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('tours')
    .select(TOUR_SEARCH_SELECT)
    .eq('operator_id', resolveOperatorId(operatorId))
    .eq('id', tourId)
    .maybeSingle()

  if (error || !data) return null
  return data as TourSearchRow
}

export async function searchNearbyToursForGoogleReviewLink(input: {
  operatorId: string
  reviewDate: string | null
  productId: string | null
  includeTourId?: string | null
  dayRange?: number
  limit?: number
}): Promise<GoogleReviewTourSearchItem[]> {
  if (!supabaseAdmin) return []

  const operatorId = resolveOperatorId(input.operatorId)
  const anchorDate = toDateKey(input.reviewDate) ?? toDateKey(new Date().toISOString())
  if (!anchorDate) return []

  const dayRange = input.dayRange ?? 3
  // 리뷰 날짜 이후 투어 제외 — (review_date - dayRange) ~ review_date (당일 포함)
  const startDate = addDaysYmd(anchorDate, -dayRange)
  const endDate = anchorDate

  let dbQuery = supabaseAdmin
    .from('tours')
    .select(TOUR_SEARCH_SELECT)
    .eq('operator_id', operatorId)
    .gte('tour_date', startDate)
    .lte('tour_date', endDate)
    .not('tour_guide_id', 'is', null)
    .neq('tour_guide_id', '')
    .order('tour_date', { ascending: false })
    .limit(input.limit ?? 100)

  const { data, error } = await dbQuery
  if (error || !data) return []

  let rows = filterSelectableTourRows(data as TourSearchRow[])
  rows.sort((a, b) => {
    const diffA = Math.abs(daysBetween(a.tour_date, anchorDate))
    const diffB = Math.abs(daysBetween(b.tour_date, anchorDate))
    if (diffA !== diffB) return diffA - diffB
    return b.tour_date.localeCompare(a.tour_date)
  })

  const includeTourId = input.includeTourId?.trim()
  if (includeTourId && !rows.some((row) => row.id === includeTourId)) {
    const extra = await fetchTourSearchRowById(operatorId, includeTourId)
    if (extra && !isTourCancelled(extra.tour_status)) {
      rows = [extra, ...rows]
    }
  }

  return mapTourRowsToSearchItems(operatorId, rows, { includeCustomerNames: false })
}

function toDateKey(value: string | null | undefined): string | null {
  return toLasVegasDateKey(value)
}

function daysBetween(startYmd: string, endYmd: string): number {
  const start = new Date(`${startYmd}T00:00:00Z`).getTime()
  const end = new Date(`${endYmd}T00:00:00Z`).getTime()
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

function scoreTourCandidate(input: {
  tour: TourCandidate
  productId: string | null
  mentionedEmails: Set<string>
  reviewDate: string
}): number {
  let score = 0

  if (input.productId && input.tour.product_id === input.productId) {
    score += 5
  }

  const guideEmail = input.tour.tour_guide_id?.trim().toLowerCase() ?? ''
  const assistantEmail = input.tour.assistant_id?.trim().toLowerCase() ?? ''

  if (guideEmail && input.mentionedEmails.has(guideEmail)) score += 4
  if (assistantEmail && input.mentionedEmails.has(assistantEmail)) score += 4

  const tourDate = toDateKey(input.tour.tour_date)
  if (tourDate) {
    const diff = daysBetween(tourDate, input.reviewDate)
    if (diff >= 0 && diff <= 60) {
      score += Math.max(0, 3 - Math.floor(diff / 7))
    }
  }

  return score
}

async function loadPrimaryProductIdForReview(reviewId: string): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data } = await fromUntypedTable(supabaseAdmin, 'review_products')
    .select('product_id')
    .eq('google_review_id', reviewId)
    .eq('is_primary', true)
    .maybeSingle()

  return ((data as { product_id?: string } | null)?.product_id ?? null) || null
}

async function loadTourCandidates(input: {
  operatorId: string
  reviewDate: string
  productId: string | null
}): Promise<TourCandidate[]> {
  if (!supabaseAdmin) return []

  const reviewDt = new Date(`${input.reviewDate}T00:00:00Z`)
  const start = new Date(reviewDt)
  start.setUTCDate(start.getUTCDate() - 60)
  const startYmd = start.toISOString().slice(0, 10)

  let query = supabaseAdmin
    .from('tours')
    .select('id, tour_date, product_id, tour_guide_id, assistant_id, tour_status')
    .eq('operator_id', resolveOperatorId(input.operatorId))
    .gte('tour_date', startYmd)
    .lte('tour_date', input.reviewDate)
    .order('tour_date', { ascending: false })
    .limit(200)

  if (input.productId) {
    query = query.eq('product_id', input.productId)
  }

  const { data, error } = await query
  if (error || !data) {
    console.error('[googleReviewTourLink] tour candidates failed', error?.message)
    return []
  }

  return filterSelectableTourRows(data as TourCandidate[])
}

export async function syncGoogleReviewStaffFromTour(input: {
  operatorId: string
  reviewId: string
  tourId: string
  matchMethod: string
  confidence?: number | null
  createdByEmail?: string
  preserveManual?: boolean
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const { data: tour, error } = await supabaseAdmin
    .from('tours')
    .select('id, tour_guide_id, assistant_id')
    .eq('id', input.tourId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (error || !tour) {
    throw new Error(error?.message || 'tour_not_found')
  }

  if (!input.preserveManual) {
    await fromUntypedTable(supabaseAdmin, 'google_review_staff')
      .delete()
      .eq('google_review_id', input.reviewId)
      .eq('operator_id', operatorId)
      .neq('match_method', 'manual')
  }

  const rows: Array<Record<string, unknown>> = []
  const guideEmail = tour.tour_guide_id?.trim()
  const assistantEmail = tour.assistant_id?.trim()

  if (guideEmail) {
    rows.push({
      operator_id: operatorId,
      google_review_id: input.reviewId,
      tour_id: input.tourId,
      staff_email: guideEmail,
      staff_role: 'guide',
      match_method: input.matchMethod,
      match_confidence: input.confidence ?? null,
      created_by_email: input.createdByEmail ?? 'system',
    })
  }

  if (assistantEmail) {
    rows.push({
      operator_id: operatorId,
      google_review_id: input.reviewId,
      tour_id: input.tourId,
      staff_email: assistantEmail,
      staff_role: 'assistant',
      match_method: input.matchMethod,
      match_confidence: input.confidence ?? null,
      created_by_email: input.createdByEmail ?? 'system',
    })
  }

  if (!rows.length) return

  const { error: upsertError } = await fromUntypedTable(supabaseAdmin, 'google_review_staff').upsert(
    rows as never,
    { onConflict: 'google_review_id,staff_email' }
  )

  if (upsertError) throw new Error(upsertError.message)
}

export async function syncGoogleReviewStaffFromMentions(input: {
  operatorId: string
  reviewId: string
  comment: string
  guides: GuideNameProfile[]
  tourId?: string | null
  createdByEmail?: string
}): Promise<number> {
  if (!supabaseAdmin) return 0

  const mentioned = findMentionedGuides(input.comment, input.guides)
  if (!mentioned.length) return 0

  const operatorId = resolveOperatorId(input.operatorId)
  let linked = 0

  for (const guide of mentioned) {
    const { error } = await fromUntypedTable(supabaseAdmin, 'google_review_staff').upsert(
      {
        operator_id: operatorId,
        google_review_id: input.reviewId,
        tour_id: input.tourId ?? null,
        staff_email: guide.email,
        staff_role: guide.role,
        match_method: 'guide_name',
        match_confidence: 0.85,
        created_by_email: input.createdByEmail ?? 'system',
      } as never,
      { onConflict: 'google_review_id,staff_email', ignoreDuplicates: false }
    )

    if (!error) linked += 1
  }

  return linked
}

export async function linkGoogleReviewToTour(input: {
  operatorId: string
  reviewId: string
  tourId: string | null
  matchMethod?: string
  confidence?: number | null
  linkedByEmail?: string
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const now = new Date().toISOString()

  await fromUntypedTable(supabaseAdmin, 'google_review_tours')
    .delete()
    .eq('google_review_id', input.reviewId)
    .eq('operator_id', operatorId)

  if (!input.tourId) {
    await fromUntypedTable(supabaseAdmin, 'google_review_staff')
      .delete()
      .eq('google_review_id', input.reviewId)
      .eq('operator_id', operatorId)
      .neq('match_method', 'guide_name')
    return
  }

  const { error } = await fromUntypedTable(supabaseAdmin, 'google_review_tours').insert({
    operator_id: operatorId,
    google_review_id: input.reviewId,
    tour_id: input.tourId,
    match_method: input.matchMethod ?? 'manual',
    match_confidence: input.confidence ?? 1,
    matched_by: input.linkedByEmail ?? 'system',
    created_at: now,
    updated_at: now,
  } as never)

  if (error) throw new Error(error.message)

  await syncGoogleReviewStaffFromTour({
    operatorId,
    reviewId: input.reviewId,
    tourId: input.tourId,
    matchMethod: input.matchMethod ?? 'manual',
    confidence: input.confidence ?? 1,
    ...(input.linkedByEmail ? { createdByEmail: input.linkedByEmail } : {}),
    preserveManual: true,
  })
}

/** 투어 연결 시 리뷰 primary 상품을 해당 투어의 product_id로 동기화 */
export async function syncReviewProductFromTourIfUnclassified(input: {
  operatorId: string
  reviewId: string
  tourId: string
  updatedByEmail: string
}): Promise<string | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)

  const { data: tour, error: tourError } = await supabaseAdmin
    .from('tours')
    .select('product_id')
    .eq('id', input.tourId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (tourError) throw new Error(tourError.message)

  const productId = tour?.product_id?.trim()
  if (!productId) {
    return (await loadPrimaryProductIdForReview(input.reviewId)) ?? null
  }

  const existingProductId = await loadPrimaryProductIdForReview(input.reviewId)
  if (existingProductId === productId) return productId

  const now = new Date().toISOString()

  await fromUntypedTable(supabaseAdmin, 'review_products')
    .delete()
    .eq('google_review_id', input.reviewId)
    .eq('operator_id', operatorId)

  const { error: mappingError } = await fromUntypedTable(supabaseAdmin, 'review_products').insert({
    operator_id: operatorId,
    google_review_id: input.reviewId,
    product_id: productId,
    is_primary: true,
    match_method: 'tour_link',
    match_confidence: 1,
    created_by_email: input.updatedByEmail,
  } as never)

  if (mappingError) throw new Error(mappingError.message)

  await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .update({
      classification_method: 'tour_link',
      classification_confidence: 1,
      classified_at: now,
      classified_by: input.updatedByEmail,
      updated_at: now,
    } as never)
    .eq('id', input.reviewId)
    .eq('operator_id', operatorId)

  return productId
}

export async function autoLinkGoogleReviewToTour(input: {
  operatorId: string
  review: ReviewForTourLink
  guides?: GuideNameProfile[]
  linkedByEmail?: string
}): Promise<{ linked: boolean; staffLinked: number }> {
  const reviewDate = toDateKey(input.review.review_created_at) ?? toDateKey(new Date().toISOString())
  if (!reviewDate) return { linked: false, staffLinked: 0 }

  const productId = input.review.productId ?? (await loadPrimaryProductIdForReview(input.review.id))
  const guides = input.guides ?? (await loadGuideNameProfiles())
  const mentioned = findMentionedGuides(input.review.comment ?? '', guides)
  const mentionedEmails = new Set(mentioned.map((row) => row.email.trim().toLowerCase()))

  const candidates = await loadTourCandidates({
    operatorId: input.operatorId,
    reviewDate,
    productId,
  })

  let best: { tour: TourCandidate; score: number } | null = null
  for (const tour of candidates) {
    const score = scoreTourCandidate({
      tour,
      productId,
      mentionedEmails,
      reviewDate,
    })
    if (!best || score > best.score) {
      best = { tour, score }
    }
  }

  let linked = false
  if (best && best.score >= 5) {
    const confidence = Math.min(0.95, best.score / 12)
    await linkGoogleReviewToTour({
      operatorId: input.operatorId,
      reviewId: input.review.id,
      tourId: best.tour.id,
      matchMethod: 'auto_tour',
      confidence,
      ...(input.linkedByEmail ? { linkedByEmail: input.linkedByEmail } : {}),
    })
    linked = true
  }

  const staffLinked = await syncGoogleReviewStaffFromMentions({
    operatorId: input.operatorId,
    reviewId: input.review.id,
    comment: input.review.comment ?? '',
    guides,
    tourId: linked ? best?.tour.id ?? null : null,
    ...(input.linkedByEmail ? { createdByEmail: input.linkedByEmail } : {}),
  })

  return { linked, staffLinked }
}

export async function autoLinkGoogleReviewsToTours(input: {
  operatorId: string
  reviewIds?: string[]
  limit?: number
  linkedByEmail?: string
}): Promise<{ linked: number; staffLinked: number; skipped: number }> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const guides = await loadGuideNameProfiles()

  let query = fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('id, comment, review_created_at, rating')
    .eq('operator_id', operatorId)
    .not('comment', 'is', null)
    .order('imported_at', { ascending: false })
    .limit(input.limit ?? 200)

  if (input.reviewIds?.length) {
    query = query.in('id', input.reviewIds)
  }

  const { data: reviews, error } = await query
  if (error) throw new Error(error.message)

  const rows = (reviews ?? []) as Array<{
    id: string
    comment: string | null
    review_created_at: string | null
    rating: number | null
  }>

  if (!rows.length) return { linked: 0, staffLinked: 0, skipped: 0 }

  const reviewIds = rows.map((row) => row.id)
  const { data: existingTourLinks } = await fromUntypedTable(supabaseAdmin, 'google_review_tours')
    .select('google_review_id')
    .in('google_review_id', reviewIds)

  const linkedReviewIds = new Set(
    ((existingTourLinks ?? []) as Array<{ google_review_id: string }>).map((row) => row.google_review_id)
  )

  let linked = 0
  let staffLinked = 0
  let skipped = 0

  for (const review of rows) {
    const productId = await loadPrimaryProductIdForReview(review.id)

    if (linkedReviewIds.has(review.id)) {
      const mentionCount = await syncGoogleReviewStaffFromMentions({
        operatorId,
        reviewId: review.id,
        comment: review.comment ?? '',
        guides,
        ...(input.linkedByEmail ? { createdByEmail: input.linkedByEmail } : {}),
      })
      staffLinked += mentionCount
      skipped += 1
      continue
    }

    const result = await autoLinkGoogleReviewToTour({
      operatorId,
      review: { ...review, productId },
      guides,
      ...(input.linkedByEmail ? { linkedByEmail: input.linkedByEmail } : {}),
    })

    if (result.linked) linked += 1
    else skipped += 1
    staffLinked += result.staffLinked
  }

  return { linked, staffLinked, skipped }
}

export async function loadGoogleReviewTourStaffSummaries(
  reviewIds: string[]
): Promise<Map<string, { tour: GoogleReviewTourLinkSummary | null; staff: GoogleReviewStaffLinkSummary[] }>> {
  const result = new Map<string, { tour: GoogleReviewTourLinkSummary | null; staff: GoogleReviewStaffLinkSummary[] }>()
  if (!supabaseAdmin || !reviewIds.length) return result

  const { data: tourLinks } = await fromUntypedTable(supabaseAdmin, 'google_review_tours')
    .select('google_review_id, tour_id, match_method')
    .in('google_review_id', reviewIds)

  const tourLinkRows = (tourLinks ?? []) as Array<{
    google_review_id: string
    tour_id: string
    match_method: string | null
  }>

  const tourIds = [...new Set(tourLinkRows.map((row) => row.tour_id))]
  const tourById = new Map<
    string,
    { tourDate: string | null; productName: string | null }
  >()

  if (tourIds.length) {
    const { data: tours } = await supabaseAdmin
      .from('tours')
      .select('id, tour_date, product_id, products(name, name_ko, name_en)')
      .in('id', tourIds)

    for (const tour of (tours ?? []) as Array<{
      id: string
      tour_date?: string | null
      product_id?: string | null
      products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
    }>) {
      const product = tour.products
      tourById.set(tour.id, {
        tourDate: tour.tour_date ?? null,
        productName: resolveProductInternalName(product, tour.product_id),
      })
    }
  }

  for (const row of tourLinkRows) {
    const tour = tourById.get(row.tour_id)
    result.set(row.google_review_id, {
      tour: {
        tourId: row.tour_id,
        tourDate: tour?.tourDate ?? null,
        productName: tour?.productName ?? null,
        matchMethod: row.match_method,
      },
      staff: [],
    })
  }

  const { data: staffRows } = await fromUntypedTable(supabaseAdmin, 'google_review_staff')
    .select('google_review_id, staff_email, staff_role, match_method')
    .in('google_review_id', reviewIds)

  const staffEmails = [
    ...new Set(
      ((staffRows ?? []) as Array<{ staff_email: string }>).map((row) => row.staff_email)
    ),
  ]

  const teamByEmail = new Map<string, string>()
  if (staffEmails.length) {
    const { data: teamRows } = await supabaseAdmin
      .from('team')
      .select('email, nick_name, name_ko, name_en')
      .in('email', staffEmails)

    for (const member of teamRows ?? []) {
      teamByEmail.set(
        member.email.toLowerCase(),
        member.nick_name || member.name_ko || member.name_en || member.email
      )
    }
  }

  for (const row of (staffRows ?? []) as Array<{
    google_review_id: string
    staff_email: string
    staff_role: 'guide' | 'assistant'
    match_method: string | null
  }>) {
    const existing = result.get(row.google_review_id) ?? { tour: null, staff: [] }
    existing.staff.push({
      staffEmail: row.staff_email,
      staffName: teamByEmail.get(row.staff_email.toLowerCase()) ?? row.staff_email,
      staffRole: row.staff_role,
      matchMethod: row.match_method,
    })
    result.set(row.google_review_id, existing)
  }

  for (const reviewId of reviewIds) {
    if (!result.has(reviewId)) {
      result.set(reviewId, { tour: null, staff: [] })
    }
  }

  return result
}

export async function searchToursForGoogleReviewLink(input: {
  operatorId: string
  tourDate?: string | null
  query?: string | null
  customerName?: string | null
  productId?: string | null
  limit?: number
}): Promise<GoogleReviewTourSearchItem[]> {
  if (!supabaseAdmin) return []

  const operatorId = resolveOperatorId(input.operatorId)
  const customerQuery = input.customerName?.trim()
  const textQuery = input.query?.trim().toLowerCase() ?? ''

  if (customerQuery) {
    const tourIds = await findTourIdsByCustomerName({
      operatorId,
      customerQuery,
      ...(input.tourDate !== undefined ? { tourDate: input.tourDate } : {}),
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      limit: input.limit ?? 40,
    })

    if (tourIds.length === 0) return []

    let tourQuery = supabaseAdmin
      .from('tours')
      .select(TOUR_SEARCH_SELECT)
      .eq('operator_id', operatorId)
      .in('id', tourIds)
      .not('tour_guide_id', 'is', null)
      .neq('tour_guide_id', '')
      .order('tour_date', { ascending: false })
      .limit(input.limit ?? 30)

    if (input.tourDate) {
      tourQuery = tourQuery.eq('tour_date', input.tourDate)
    }
    if (input.productId) {
      tourQuery = tourQuery.eq('product_id', input.productId)
    }

    const { data, error } = await tourQuery
    if (error || !data) return []

    const items = await mapTourRowsToSearchItems(
      operatorId,
      filterSelectableTourRows(data as TourSearchRow[])
    )
    if (!textQuery) return items

    return items.filter((row) =>
      [row.tourDate, row.productName, row.guideName, row.assistantName, ...row.customerNames]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(textQuery))
    )
  }

  let dbQuery = supabaseAdmin
    .from('tours')
    .select(TOUR_SEARCH_SELECT)
    .eq('operator_id', operatorId)
    .not('tour_guide_id', 'is', null)
    .neq('tour_guide_id', '')
    .order('tour_date', { ascending: false })
    .limit(input.limit ?? 25)

  if (input.tourDate) {
    dbQuery = dbQuery.eq('tour_date', input.tourDate)
  }
  if (input.productId) {
    dbQuery = dbQuery.eq('product_id', input.productId)
  }

  const { data, error } = await dbQuery
  if (error || !data) return []

  const items = await mapTourRowsToSearchItems(
    operatorId,
    filterSelectableTourRows(data as TourSearchRow[])
  )
  if (!textQuery) return items

  return items.filter((row) =>
    [row.tourDate, row.productName, row.guideName, row.assistantName, ...row.customerNames]
      .filter(Boolean)
      .some((part) => String(part).toLowerCase().includes(textQuery))
  )
}

export type ReservationReviewLookup = {
  reservationId: string
  channelRn: string | null
  tourId: string | null
  tourDate: string | null
  productName: string | null
  customerName: string | null
}

type ReservationLookupRow = {
  id: string
  channel_rn: string | null
  tour_id: string | null
  tour_date: string | null
  product_id: string | null
  customers?: { name?: string | null } | null
  products: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  } | null
}

function mapReservationLookupRow(row: ReservationLookupRow): ReservationReviewLookup {
  const productName = resolveProductInternalName(row.products, row.product_id)

  return {
    reservationId: row.id,
    channelRn: row.channel_rn,
    tourId: row.tour_id,
    tourDate: row.tour_date,
    productName: productName ?? null,
    customerName: row.customers?.name?.trim() || null,
  }
}

export async function lookupReservationForReviewLink(input: {
  operatorId: string
  reference: string
}): Promise<ReservationReviewLookup | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const reference = input.reference.trim()
  if (!reference) return null

  const operatorId = resolveOperatorId(input.operatorId)
  const select =
    'id, channel_rn, tour_id, tour_date, product_id, products(name, name_ko, name_en), customers(name)'

  const byChannelRn = await fromUntypedTable(supabaseAdmin, 'reservations')
    .select(select)
    .eq('operator_id', operatorId)
    .eq('channel_rn', reference)
    .neq('status', 'deleted')
    .limit(1)
    .maybeSingle()

  if (byChannelRn.error) {
    throw new Error(byChannelRn.error.message)
  }

  if (byChannelRn.data) {
    return mapReservationLookupRow(byChannelRn.data as ReservationLookupRow)
  }

  const byId = await fromUntypedTable(supabaseAdmin, 'reservations')
    .select(select)
    .eq('operator_id', operatorId)
    .eq('id', reference)
    .neq('status', 'deleted')
    .limit(1)
    .maybeSingle()

  if (byId.error) {
    throw new Error(byId.error.message)
  }

  if (byId.data) {
    return mapReservationLookupRow(byId.data as ReservationLookupRow)
  }

  return null
}
