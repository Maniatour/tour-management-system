import { isGoblinTourProduct } from '@/lib/goblinTour'
import { parseGuideProductSkills } from '@/lib/guideProductSkills'
import { reservationToScheduleBucket } from '@/lib/scheduleGuideLanguageMatch'
import { isAssistantAssignmentLocked, isGuideAssignmentLocked } from '@/lib/staffAssignmentLock'
import {
  addDaysToYmd,
  canonicalReservationIdKey,
  isReservationCancelledStatus,
  normalizeReservationIds,
  resolveTeamTypeForTourCreate,
  toTourDateKey,
} from '@/utils/tourUtils'
import {
  assignmentSignature,
  autoAssignSchedule,
  clampAutoAssignRange,
  eachAutoAssignDate,
  type AutoAssignExistingMode,
  type AutoAssignInput,
  type AutoAssignMember,
  type AutoAssignOff,
  type AutoAssignPreset,
  type AutoAssignResult,
  type AutoAssignReviewStat,
  type AutoAssignTour,
} from '@/lib/schedule/autoAssignSchedule'

export const AUTO_ASSIGN_CONTEXT_DAYS = 3

function assignmentLockFlag(value: unknown): boolean | string | null {
  if (value == null) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (value === 1) return true
  return null
}

export function autoAssignContextDates(startDate: string): string[] {
  const dates: string[] = []
  for (let offset = AUTO_ASSIGN_CONTEXT_DAYS; offset >= 1; offset -= 1) {
    const date = addDaysToYmd(startDate, -offset)
    if (date) dates.push(date)
  }
  return dates
}

export type AutoAssignOffRow = {
  team_email: string
  off_date: string
  reason: string
  status: string
}

export type AutoAssignPreviewGuide = { email: string; name: string }

export type AutoAssignPreviewProduct = { id: string; name: string }

export type AutoAssignPreviewTour = {
  id: string
  date: string
  spanDays: number
  productId: string
  productName: string
  people: number
  colorValue?: string
}

export type AutoAssignPreviewData = {
  result: AutoAssignResult
  /** 다시 배정하는 날짜 */
  dates: string[]
  /** 배정 시작일 앞 3일. 기존 배정과 오프만 보여주고 적용하지 않는다. */
  contextDates: string[]
  guides: AutoAssignPreviewGuide[]
  products: AutoAssignPreviewProduct[]
  tours: AutoAssignPreviewTour[]
  offSchedules: AutoAssignOffRow[]
  sourceTours: TourLike[]
  sourceReservations: ReservationLike[]
  customers: Array<{ id?: string | null; language?: string | null }>
}

type ProductLike = {
  id?: string | null
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  internal_name_ko?: string | null
  internal_name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

type TeamLike = {
  email?: string | null
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
  languages?: unknown
  is_active?: boolean | null
  cdl_driver_license?: boolean | null
  do_not_team_with?: string[] | null
  avoid_team_with?: string[] | null
  guide_product_skills?: unknown
}

type ReservationLike = {
  id?: string | null
  status?: string | null
  customer_id?: string | null
  total_people?: number | null
  tour_language?: string | null
  tour_date?: string | null
  product_id?: string | null
}

type TourLike = {
  id?: string | null
  tour_date?: string | null
  tour_status?: string | null
  product_id?: string | null
  team_type?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  guide_assignment_locked?: unknown
  assistant_assignment_locked?: unknown
  reservation_ids?: unknown
  products?: { name?: string | null } | { name?: string | null }[] | null
}

export function scheduleAutoAssignSpanDays(productId: string): number {
  const id = String(productId || '')
  if (id.startsWith('MNGC3N')) return 4
  if (id.startsWith('MNGC2N')) return 3
  if (id.startsWith('MNGC1N') || id.startsWith('MNM1')) return 2
  return 1
}

function languageList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((item) => String(item))
}

function productName(product: ProductLike | undefined, fallbackId: string): string {
  const name = product?.name_ko || product?.name || product?.name_en || ''
  return String(name).trim() || fallbackId
}

function nestedProductName(tour: TourLike): string | null {
  const nested = tour.products
  if (Array.isArray(nested)) return nested[0]?.name || null
  return nested?.name || null
}

export function mergeAutoAssignOffs(args: {
  rows: Array<{ team_email?: string | null; off_date?: string | null }>
  pending: Array<{ team_email: string; off_date: string; action: 'approve' | 'delete' | 'reject' }>
}): AutoAssignOff[] {
  const pendingByKey = new Map(args.pending.map((row) => [`${row.team_email.trim().toLowerCase()}|${row.off_date.slice(0, 10)}`, row.action]))
  const offs = new Map<string, AutoAssignOff>()
  for (const row of args.rows) {
    const email = String(row.team_email || '').trim()
    const date = String(row.off_date || '').slice(0, 10)
    if (!email || !date) continue
    const key = `${email.toLowerCase()}|${date}`
    if (pendingByKey.get(key) === 'delete') continue
    offs.set(key, { email, date })
  }
  for (const row of args.pending) {
    if (row.action !== 'approve') continue
    const email = row.team_email.trim()
    const date = row.off_date.slice(0, 10)
    if (!email || !date) continue
    offs.set(`${email.toLowerCase()}|${date}`, { email, date })
  }
  return Array.from(offs.values())
}

/** 같은 예약이 화면 데이터와 다시 받은 데이터에 둘 다 있으면 인원이 두 번 더해진다. 나중 값을 남긴다. */
export function dedupeAutoAssignReservations<T extends { id?: string | null }>(rows: T[]): T[] {
  const byId = new Map<string, T>()
  const withoutId: T[] = []
  for (const row of rows) {
    const key = canonicalReservationIdKey(String(row.id || ''))
    if (!key) {
      withoutId.push(row)
      continue
    }
    byId.set(key, row)
  }
  return [...byId.values(), ...withoutId]
}

export function mergeAutoAssignOffRows(args: {
  rows: Array<{
    team_email?: string | null
    off_date?: string | null
    reason?: string | null
    status?: string | null
  }>
  pending: Array<{
    team_email: string
    off_date: string
    reason?: string
    status?: string
    action: 'approve' | 'delete' | 'reject'
  }>
}): AutoAssignOffRow[] {
  const pendingByKey = new Map(
    args.pending.map((row) => [`${row.team_email.trim().toLowerCase()}|${row.off_date.slice(0, 10)}`, row]),
  )
  const offs = new Map<string, AutoAssignOffRow>()
  for (const row of args.rows) {
    const email = String(row.team_email || '').trim()
    const date = String(row.off_date || '').slice(0, 10)
    if (!email || !date) continue
    const key = `${email.toLowerCase()}|${date}`
    if (pendingByKey.get(key)?.action === 'delete') continue
    offs.set(key, {
      team_email: email,
      off_date: date,
      reason: String(row.reason || ''),
      status: String(row.status || 'approved'),
    })
  }
  for (const row of args.pending) {
    if (row.action !== 'approve') continue
    const email = row.team_email.trim()
    const date = row.off_date.slice(0, 10)
    if (!email || !date) continue
    const key = `${email.toLowerCase()}|${date}`
    if (offs.has(key)) continue
    offs.set(key, {
      team_email: email,
      off_date: date,
      reason: String(row.reason || ''),
      status: String(row.status || 'pending'),
    })
  }
  return Array.from(offs.values())
}

export function prepareAutoAssignSchedule(args: {
  startDate: string
  endDate: string
  preset: AutoAssignPreset
  reviewStats: AutoAssignReviewStat[] | null
  memberOrder: string[]
  teamMembers: TeamLike[]
  products: ProductLike[]
  productOrder: string[]
  productColors: Record<string, string>
  tours: TourLike[]
  reservations: ReservationLike[]
  customers: Array<{ id?: string | null; language?: string | null }>
  offs: AutoAssignOff[]
  offRows?: AutoAssignOffRow[]
  variant?: number | undefined
  previousSignature?: string | null | undefined
  existingMode?: AutoAssignExistingMode | undefined
}): AutoAssignPreviewData {
  const teamByEmail = new Map<string, TeamLike>()
  for (const member of args.teamMembers) {
    const email = String(member.email || '').trim()
    if (email) teamByEmail.set(email.toLowerCase(), member)
  }

  const members: AutoAssignMember[] = []
  const seen = new Set<string>()
  for (const rawEmail of args.memberOrder) {
    const email = String(rawEmail || '').trim()
    const key = email.toLowerCase()
    if (!email || seen.has(key)) continue
    const member = teamByEmail.get(key)
    if (!member || member.is_active === false) continue
    seen.add(key)
    members.push({
      email,
      name: member.nick_name || member.name_ko || member.name_en || email,
      nickName: member.nick_name ?? null,
      nameKo: member.name_ko ?? null,
      nameEn: member.name_en ?? null,
      languages: languageList(member.languages),
      active: true,
      cdl: Boolean(member.cdl_driver_license),
      doNotTeamWith: member.do_not_team_with ?? null,
      avoidTeamWith: member.avoid_team_with ?? null,
      guideProductSkills: parseGuideProductSkills(member.guide_product_skills),
    })
  }

  const customerLang = new Map<string, string | null>()
  for (const customer of args.customers) {
    if (customer.id) customerLang.set(String(customer.id), customer.language ?? null)
  }
  const reservationsById = new Map<string, ReservationLike>()
  for (const reservation of args.reservations) {
    const key = canonicalReservationIdKey(String(reservation.id || ''))
    if (key) reservationsById.set(key, reservation)
  }
  const productsById = new Map<string, ProductLike>()
  for (const product of args.products) {
    if (product.id) productsById.set(String(product.id), product)
  }

  const tours: AutoAssignTour[] = []
  const previewTours: AutoAssignPreviewTour[] = []
  for (const tour of args.tours) {
    const id = String(tour.id || '').trim()
    const tourDate = toTourDateKey(tour.tour_date)
    const productId = String(tour.product_id || '').trim()
    if (!id || !tourDate || !productId) continue
    const product = productsById.get(productId)
    const guestPeople = { ko: 0, ja: 0, en: 0 }
    for (const reservationId of normalizeReservationIds(tour.reservation_ids)) {
      const reservation = reservationsById.get(canonicalReservationIdKey(reservationId))
      if (!reservation || isReservationCancelledStatus(reservation.status)) continue
      const bucket = reservationToScheduleBucket(
        reservation.tour_language,
        customerLang.get(String(reservation.customer_id || '')),
      )
      guestPeople[bucket] += reservation.total_people || 0
    }
    const spanDays = scheduleAutoAssignSpanDays(productId)
    const mapped: AutoAssignTour = {
      id,
      tourDate,
      productId,
      productName: productName(product, nestedProductName(tour) || productId),
      teamType:
        spanDays > 1
          ? '1guide'
          : resolveTeamTypeForTourCreate({
              sourceTeamType: tour.team_type ?? null,
              product: product ? { ...product, id: productId } : { id: productId, name: nestedProductName(tour) },
            }),
      tourStatus: tour.tour_status ?? null,
      guideEmail: tour.tour_guide_id ? String(tour.tour_guide_id) : null,
      assistantEmail: tour.assistant_id ? String(tour.assistant_id) : null,
      guideLocked: isGuideAssignmentLocked({
        guide_assignment_locked: assignmentLockFlag(tour.guide_assignment_locked),
      }),
      assistantLocked: isAssistantAssignmentLocked({
        assistant_assignment_locked: assignmentLockFlag(tour.assistant_assignment_locked),
      }),
      spanDays,
      isGoblin: isGoblinTourProduct(product ? { ...product, id: productId } : { id: productId, name: nestedProductName(tour) }, productId),
      guestPeople,
    }
    tours.push(mapped)
  }

  const clamped = clampAutoAssignRange(args.startDate, args.endDate)
  const input: AutoAssignInput = {
    startDate: clamped.startDate,
    endDate: clamped.endDate,
    preset: args.preset,
    members,
    tours,
    offs: args.offs,
    reviewStats: args.reviewStats,
    variant: Math.max(0, Math.floor(args.variant ?? 0)),
    existingMode: args.existingMode === 'keep' ? 'keep' : 'reset',
  }
  let variant = input.variant ?? 0
  let result = autoAssignSchedule(input)
  const previous = args.previousSignature || ''
  if (previous) {
    for (let step = 0; step < 8 && assignmentSignature(result.assignmentsByTourId) === previous; step += 1) {
      variant += 1
      result = autoAssignSchedule({ ...input, variant })
    }
  }
  result = {
    ...result,
    variant,
    alternativeExhausted: Boolean(previous) && assignmentSignature(result.assignmentsByTourId) === previous,
  }
  const range = eachAutoAssignDate(clamped.startDate, clamped.endDate)
  const rangeStart = range[0]
  const rangeEnd = range[range.length - 1]

  for (const tour of tours) {
    if (!rangeStart || !rangeEnd || tour.tourDate < rangeStart || tour.tourDate > rangeEnd) continue
    if (!result.assignmentsByTourId[tour.id]) continue
    previewTours.push({
      id: tour.id,
      date: tour.tourDate,
      spanDays: tour.spanDays,
      productId: tour.productId,
      productName: tour.productName || tour.productId,
      people: tour.guestPeople.ko + tour.guestPeople.ja + tour.guestPeople.en,
      colorValue: args.productColors[tour.productId],
    })
  }

  const productIds = new Set(previewTours.map((tour) => tour.productId))
  const products: AutoAssignPreviewProduct[] = []
  const usedProducts = new Set<string>()
  for (const productId of args.productOrder) {
    if (!productIds.has(productId) || usedProducts.has(productId)) continue
    usedProducts.add(productId)
    products.push({ id: productId, name: productName(productsById.get(productId), productId) })
  }
  for (const tour of previewTours) {
    if (usedProducts.has(tour.productId)) continue
    usedProducts.add(tour.productId)
    products.push({ id: tour.productId, name: tour.productName })
  }

  return {
    result,
    dates: range,
    contextDates: autoAssignContextDates(clamped.startDate),
    guides: members.map((member) => ({ email: member.email, name: member.name })),
    products,
    tours: previewTours,
    offSchedules: args.offRows || [],
    sourceTours: args.tours,
    sourceReservations: dedupeAutoAssignReservations(args.reservations),
    customers: args.customers,
  }
}
