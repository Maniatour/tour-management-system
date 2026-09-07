import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import dayjs from 'dayjs'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { isGuideBackupTour } from '@/lib/guideBackupTour'
import { tourCoversCalendarDate } from '@/lib/scheduleVehicleOilMaintenance'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeReservationIds, parseTourAssignmentEmails } from '@/utils/tourUtils'

/** MNGC3N 최대 4일. 시작일이 이 구간 안인 투어만 조회한다. */
export const PHOTO_TOUR_MAX_SPAN_DAYS = 4

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
  const { data, error } = await db
    .from('tours')
    .select(
      'id, tour_date, tour_status, assignment_status, tour_guide_id, assistant_id, tour_start_datetime, tour_end_datetime, reservation_ids, product_id, products(name, name_ko, name_en)'
    )
    .gte('tour_date', lookbackStart)
    .lte('tour_date', today)

  if (error) throw error

  const covering = toursCoveringDate((data || []) as TodayPhotoTourRow[], today)
  const picked = pickTodayPhotoTour(covering, needle, nowMs)
  if (!picked) return empty

  const candidateCount = covering.filter(
    (tour) => isGuideAssignedToTour(needle, tour) && !isTourCancelled(tour.tour_status)
  ).length

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
