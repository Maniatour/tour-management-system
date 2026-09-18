import {
  displayCourseName,
  excludeAncestorStopsWhenChildrenPresent,
  isNonAttractionReportStop,
  type CourseForMainStops,
} from '@/lib/tourReportMainStops'

export const PHOTO_STOP_ENOUGH_COUNT = 2
export const PHOTO_STOP_MATCH_MAX_KM = 3

export type GuidePhotoStop = {
  id: string
  label: string
  latitude: number | null
  longitude: number | null
}

export type PhotoStopStatus = 'missing' | 'low' | 'ok'

type CourseWithCoords = CourseForMainStops & {
  start_latitude?: number | null
  start_longitude?: number | null
}

const MAP_PREFIX = 'kovegas.guide.photoStopMap:'

function mapKey(tourId: string) {
  return `${MAP_PREFIX}${tourId}`
}

export function photoStopStatus(count: number): PhotoStopStatus {
  if (count <= 0) return 'missing'
  if (count < PHOTO_STOP_ENOUGH_COUNT) return 'low'
  return 'ok'
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

export function nearestPhotoStop(
  stops: GuidePhotoStop[],
  latitude: number,
  longitude: number,
  maxKm = PHOTO_STOP_MATCH_MAX_KM
): GuidePhotoStop | null {
  let best: GuidePhotoStop | null = null
  let bestKm = maxKm
  for (const stop of stops) {
    if (stop.latitude == null || stop.longitude == null) continue
    const km = haversineKm(latitude, longitude, stop.latitude, stop.longitude)
    if (km <= bestKm) {
      bestKm = km
      best = stop
    }
  }
  return best
}

export function countPhotosByStop(
  items: Array<{ stopId?: string | null; kind?: string | null }>
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (!item.stopId || item.kind === 'receipt') continue
    counts[item.stopId] = (counts[item.stopId] || 0) + 1
  }
  return counts
}

export function readPhotoStopMap(tourId: string): Record<string, string> {
  if (typeof window === 'undefined' || !tourId) return {}
  try {
    const raw = window.localStorage.getItem(mapKey(tourId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [id, stopId] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof stopId === 'string' && stopId) out[id] = stopId
    }
    return out
  } catch {
    return {}
  }
}

export function recordPhotoStop(tourId: string, photoId: string, stopId: string): void {
  if (typeof window === 'undefined' || !tourId || !photoId || !stopId) return
  try {
    const next = { ...readPhotoStopMap(tourId), [photoId]: stopId }
    window.localStorage.setItem(mapKey(tourId), JSON.stringify(next))
  } catch {
    // ignore storage failures
  }
}

export function forgetPhotoStop(tourId: string, photoId: string): void {
  if (typeof window === 'undefined' || !tourId || !photoId) return
  try {
    const next = { ...readPhotoStopMap(tourId) }
    delete next[photoId]
    window.localStorage.setItem(mapKey(tourId), JSON.stringify(next))
  } catch {
    // ignore storage failures
  }
}

export function selectGuidePhotoStops(courses: CourseWithCoords[], locale: string): GuidePhotoStop[] {
  const byId = new Map<string, CourseForMainStops>()
  for (const course of courses) byId.set(course.id, course)
  const attractionIds = courses.filter((course) => !isNonAttractionReportStop(course)).map((course) => course.id)
  const ids = excludeAncestorStopsWhenChildrenPresent(attractionIds, byId)
  return ids
    .map((id) => {
      const course = byId.get(id) as CourseWithCoords | undefined
      if (!course) return null
      const label = displayCourseName(course, locale).trim()
      if (!label) return null
      return {
        id: course.id,
        label,
        latitude: Number.isFinite(course.start_latitude) ? (course.start_latitude as number) : null,
        longitude: Number.isFinite(course.start_longitude) ? (course.start_longitude as number) : null,
      } satisfies GuidePhotoStop
    })
    .filter((stop): stop is GuidePhotoStop => Boolean(stop))
}
