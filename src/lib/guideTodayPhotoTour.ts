import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import dayjs from 'dayjs'
import { LV_TZ, todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { isGuideBackupTour } from '@/lib/guideBackupTour'
import { calculatePickupDate } from '@/lib/reservationDisplayUtils'
import { tourCoversCalendarDate } from '@/lib/scheduleVehicleOilMaintenance'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeReservationIds, parseTourAssignmentEmails } from '@/utils/tourUtils'

/** MNGC3N 최대 4일. 시작일이 이 구간 안인 투어만 조회한다. */
export const PHOTO_TOUR_MAX_SPAN_DAYS = 4
/** 내일 투어를 최초 픽업 30분 전부터 찍을 수 있게 하루 앞까지 조회한다. */
export const PHOTO_TOUR_LOOKAHEAD_DAYS = 1
export const PHOTO_OPEN_BEFORE_PICKUP_MINUTES = 30

export type TodayPhotoTourRow = {
  id: string
  tour_date: string
  tour_status: string | null
  assignment_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_start_datetime: string | null
  tour_end_datetime?: string | null
  reservation_ids: unknown
  product_id: string | null
  products?: unknown
}

export type TodayPhotoTourMatch = {
  id: string
  tourDate: string
  productName: string
  productId: string | null
  startDatetime: string | null
  isBackup: boolean
  candidateCount: number
}

export type TodayPhotoThumb = {
  id: string
  fileName: string
  filePath: string
  thumbnailPath: string | null
}

function startMs(tour: TodayPhotoTourRow): number | null {
  if (!tour.tour_start_datetime) return null
  const ms = Date.parse(tour.tour_start_datetime)
  return Number.isFinite(ms) ? ms : null
}

export function isGuideAssignedToTour(
  email: string,
  tour: Pick<TodayPhotoTourRow, 'tour_guide_id' | 'assistant_id'>
): boolean {
  const needle = email.toLowerCase().trim()
  if (!needle) return false
  const assigned = [
    ...parseTourAssignmentEmails(tour.tour_guide_id),
    ...parseTourAssignmentEmails(tour.assistant_id),
  ]
  return assigned.some((item) => item.toLowerCase() === needle)
}

function isBackupCandidate(tour: TodayPhotoTourRow): boolean {
  return isGuideBackupTour({
    assignedPeople: normalizeReservationIds(tour.reservation_ids).length,
    tourGuideId: tour.tour_guide_id,
    assistantId: tour.assistant_id,
    tourStatus: tour.tour_status,
    assignmentStatus: tour.assignment_status,
  })
}

export function pickTodayPhotoTour(
  tours: TodayPhotoTourRow[],
  email: string,
  nowMs: number
): TodayPhotoTourRow | null {
  const assigned = tours.filter(
    (tour) => isGuideAssignedToTour(email, tour) && !isTourCancelled(tour.tour_status)
  )
  if (assigned.length === 0) return null
  if (assigned.length === 1) return assigned[0]

  const withGuests = assigned.filter((tour) => !isBackupCandidate(tour))
  const pool = withGuests.length > 0 ? withGuests : assigned

  const started = pool
    .map((tour) => ({ tour, start: startMs(tour) }))
    .filter((item): item is { tour: TodayPhotoTourRow; start: number } => item.start != null && item.start <= nowMs)
  if (started.length > 0) {
    started.sort((a, b) => b.start - a.start)
    return started[0].tour
  }

  const timed = pool
    .map((tour) => ({ tour, start: startMs(tour) }))
    .filter((item): item is { tour: TodayPhotoTourRow; start: number } => item.start != null)
  if (timed.length > 0) {
    timed.sort((a, b) => a.start - b.start)
    return timed[0].tour
  }

  return pool[0]
}

export function photoTourLookbackStart(todayYmd: string): string {
  return dayjs(todayYmd).subtract(PHOTO_TOUR_MAX_SPAN_DAYS - 1, 'day').format('YYYY-MM-DD')
}

export function photoTourLookaheadEnd(todayYmd: string): string {
  return dayjs(todayYmd).add(PHOTO_TOUR_LOOKAHEAD_DAYS, 'day').format('YYYY-MM-DD')
}

function parsePickupMinutes(time: string): number | null {
  const matched = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!matched) return null
  const hours = Number(matched[1])
  const minutes = Number(matched[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function firstPickupMsFromParts(
  tourDate: string,
  pickupTime: string | null | undefined,
  tourStartDatetime: string | null | undefined
): number | null {
  const time = pickupTime?.trim()
  if (time) {
    const minutes = parsePickupMinutes(time)
    if (minutes != null) {
      const pickupDate = calculatePickupDate(time, tourDate)
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
      const mm = String(minutes % 60).padStart(2, '0')
      const parsed = dayjs.tz(`${pickupDate}T${hh}:${mm}:00`, LV_TZ)
      if (parsed.isValid()) return parsed.valueOf()
    }
  }
  if (tourStartDatetime) {
    const ms = Date.parse(tourStartDatetime)
    if (Number.isFinite(ms)) return ms
  }
  return null
}

export function earliestPickupTime(
  tourDate: string,
  pickupTimes: Array<string | null | undefined>
): string | null {
  let bestTime: string | null = null
  let bestMs = Number.POSITIVE_INFINITY
  for (const raw of pickupTimes) {
    const time = raw?.trim()
    if (!time) continue
    const ms = firstPickupMsFromParts(tourDate, time, null)
    if (ms != null && ms < bestMs) {
      bestMs = ms
      bestTime = time
    }
  }
  return bestTime
}

export function isPhotoShootingOpen(nowMs: number, firstPickupMs: number | null, tourDate: string): boolean {
  if (firstPickupMs != null) {
    return nowMs >= firstPickupMs - PHOTO_OPEN_BEFORE_PICKUP_MINUTES * 60 * 1000
  }
  const startOfTourDate = dayjs.tz(tourDate, LV_TZ).startOf('day').valueOf()
  if (!Number.isFinite(startOfTourDate)) return false
  return nowMs >= startOfTourDate - PHOTO_OPEN_BEFORE_PICKUP_MINUTES * 60 * 1000
}

/** 오늘 진행 중인 투어, 또는 내일 투어의 최초 픽업 30분 전부터 촬영 가능 */
export function isTourEligibleForGuidePhotos(
  tour: TodayPhotoTourRow,
  todayYmd: string,
  nowMs: number,
  pickupTime?: string | null
): boolean {
  if (tourCoversCalendarDate(tour, todayYmd)) return true
  if (tour.tour_date <= todayYmd) return false
  const firstMs = firstPickupMsFromParts(tour.tour_date, pickupTime, tour.tour_start_datetime)
  return isPhotoShootingOpen(nowMs, firstMs, tour.tour_date)
}

export function selectEligiblePhotoTours(
  tours: TodayPhotoTourRow[],
  email: string,
  todayYmd: string,
  nowMs: number,
  pickupTimeByTourId: Map<string, string | null>
): TodayPhotoTourRow[] {
  return tours.filter((tour) => {
    if (!isGuideAssignedToTour(email, tour) || isTourCancelled(tour.tour_status)) return false
    return isTourEligibleForGuidePhotos(tour, todayYmd, nowMs, pickupTimeByTourId.get(tour.id) ?? null)
  })
}

/** 당일 투어 + 1박2일 2일차처럼 오늘이 진행 구간에 들어가는 투어 */
export function toursCoveringDate(tours: TodayPhotoTourRow[], dateYmd: string): TodayPhotoTourRow[] {
  return tours.filter((tour) => tourCoversCalendarDate(tour, dateYmd))
}

function unwrapProduct(products: unknown): {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
} | null {
  if (!products) return null
  if (Array.isArray(products)) {
    const first = products[0]
    return first && typeof first === 'object' ? (first as { name?: string | null; name_ko?: string | null; name_en?: string | null }) : null
  }
  if (typeof products === 'object') {
    return products as { name?: string | null; name_ko?: string | null; name_en?: string | null }
  }
  return null
}

export function productNameForLocale(products: unknown, locale: string): string {
  const product = unwrapProduct(products)
  if (!product) return ''
  if (locale === 'en') {
    return (product.name_en || product.name || product.name_ko || '').trim()
  }
  return (product.name_ko || product.name || product.name_en || '').trim()
}

function isInactiveReservationStatus(status: string | null | undefined): boolean {
  const value = (status || '').toLowerCase()
  return value.includes('cancel') || value === 'deleted' || value === 'no_show'
}

async function loadEarliestPickupTimeByTourId(
  db: SupabaseClient<Database>,
  tours: TodayPhotoTourRow[]
): Promise<Map<string, string | null>> {
  const pickupTimeByTourId = new Map<string, string | null>()
  const reservationToTours = new Map<string, string[]>()
  for (const tour of tours) {
    pickupTimeByTourId.set(tour.id, null)
    for (const reservationId of normalizeReservationIds(tour.reservation_ids)) {
      const owners = reservationToTours.get(reservationId) || []
      owners.push(tour.id)
      reservationToTours.set(reservationId, owners)
    }
  }
  const reservationIds = [...reservationToTours.keys()]
  if (reservationIds.length === 0) return pickupTimeByTourId

  const { data, error } = await db
    .from('reservations')
    .select('id, pickup_time, status')
    .in('id', reservationIds)
  if (error) throw error

  const timesByTour = new Map<string, string[]>()
  for (const row of data || []) {
    if (isInactiveReservationStatus(row.status)) continue
    const time = row.pickup_time?.trim()
    if (!time) continue
    for (const tourId of reservationToTours.get(row.id) || []) {
      const list = timesByTour.get(tourId) || []
      list.push(time)
      timesByTour.set(tourId, list)
    }
  }

  for (const tour of tours) {
    pickupTimeByTourId.set(tour.id, earliestPickupTime(tour.tour_date, timesByTour.get(tour.id) || []))
  }
  return pickupTimeByTourId
}

export async function resolveTodayPhotoTourForGuide(
  db: SupabaseClient<Database>,
  email: string,
  locale: string,
  nowMs: number = Date.now()
): Promise<{
  today: string
  tour: TodayPhotoTourMatch | null
  photoCount: number
  recentPhotos: TodayPhotoThumb[]
}> {
  const today = todayInLasVegas()
  const empty = { today, tour: null, photoCount: 0, recentPhotos: [] as TodayPhotoThumb[] }
  const needle = email.toLowerCase().trim()
  if (!needle) return empty

  const lookbackStart = photoTourLookbackStart(today)
  const lookaheadEnd = photoTourLookaheadEnd(today)
  const { data, error } = await db
    .from('tours')
    .select(
      'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_start_datetime, tour_end_datetime, reservation_ids, product_id, products(name, name_ko, name_en)'
    )
    .gte('tour_date', lookbackStart)
    .lte('tour_date', lookaheadEnd)

  if (error) throw error

  const rows = (data || []) as TodayPhotoTourRow[]
  const assigned = rows.filter(
    (tour) => isGuideAssignedToTour(needle, tour) && !isTourCancelled(tour.tour_status)
  )
  const pickupTimeByTourId = await loadEarliestPickupTimeByTourId(db, assigned)
  const eligible = selectEligiblePhotoTours(assigned, needle, today, nowMs, pickupTimeByTourId)
  const picked = pickTodayPhotoTour(eligible, needle, nowMs)
  if (!picked) return empty

  const candidateCount = eligible.length

  const { count } = await db
    .from('tour_photos')
    .select('id', { count: 'exact', head: true })
    .eq('tour_id', picked.id)

  const { data: recent } = await db
    .from('tour_photos')
    .select('id, file_name, file_path, thumbnail_path')
    .eq('tour_id', picked.id)
    .order('created_at', { ascending: false })
    .limit(12)

  return {
    today,
    tour: {
      id: picked.id,
      tourDate: picked.tour_date,
      productName: productNameForLocale(picked.products, locale) || (locale === 'en' ? 'Today\'s tour' : '오늘 투어'),
      productId: picked.product_id,
      startDatetime: picked.tour_start_datetime,
      isBackup: isBackupCandidate(picked),
      candidateCount,
    },
    photoCount: count ?? 0,
    recentPhotos: (recent || []).map((photo) => ({
      id: photo.id,
      fileName: photo.file_name,
      filePath: photo.file_path,
      thumbnailPath: photo.thumbnail_path ?? null,
    })),
  }
}
