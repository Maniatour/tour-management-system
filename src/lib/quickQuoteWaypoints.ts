export type QuickQuoteCity = 'lv' | 'la'
export type QuickHotelSeason = 'high' | 'low'

export type GeoPoint = { lat: number; lng: number }

export const QUICK_HOTEL_HIGH_RATE = 150
export const QUICK_HOTEL_LOW_RATE = 100
export const QUICK_HOTEL_GUIDE_ROOMS = 1
export const QUICK_STAY_NIGHTS = [0, 1, 2, 3, 4, 5, 6] as const
export type QuickStayNights = (typeof QUICK_STAY_NIGHTS)[number]

export function quickStayTourDays(nights: number): number {
  return Math.max(0, nights) + 1
}

export const QUICK_CITIES: Record<QuickQuoteCity, GeoPoint & { nameKo: string; nameEn: string }> = {
  lv: { lat: 36.1699, lng: -115.1398, nameKo: '라스베가스', nameEn: 'Las Vegas' },
  la: { lat: 34.0522, lng: -118.2437, nameKo: 'LA', nameEn: 'Los Angeles' },
}

export const QUICK_DEPART_IDS: Record<QuickQuoteCity, string> = {
  lv: '__quick_depart_lv__',
  la: '__quick_depart_la__',
}

export const QUICK_ARRIVE_IDS: Record<QuickQuoteCity, string> = {
  lv: '__quick_arrive_lv__',
  la: '__quick_arrive_la__',
}

export type QuickWaypointKind = 'depart' | 'arrive'

export type QuickQuoteWaypoint = {
  id: string
  city: QuickQuoteCity
  kind: QuickWaypointKind
  name_ko: string
  name_en: string
  start_latitude: number
  start_longitude: number
  duration_hours: number
  parent_id: null
  category: string
}

const WAYPOINTS: Record<string, QuickQuoteWaypoint> = {
  [QUICK_DEPART_IDS.lv]: {
    id: QUICK_DEPART_IDS.lv,
    city: 'lv',
    kind: 'depart',
    name_ko: '라스베가스 출발',
    name_en: 'Las Vegas Departure',
    start_latitude: QUICK_CITIES.lv.lat,
    start_longitude: QUICK_CITIES.lv.lng,
    duration_hours: 0,
    parent_id: null,
    category: '출발',
  },
  [QUICK_DEPART_IDS.la]: {
    id: QUICK_DEPART_IDS.la,
    city: 'la',
    kind: 'depart',
    name_ko: 'LA 출발',
    name_en: 'LA Departure',
    start_latitude: QUICK_CITIES.la.lat,
    start_longitude: QUICK_CITIES.la.lng,
    duration_hours: 0,
    parent_id: null,
    category: '출발',
  },
  [QUICK_ARRIVE_IDS.lv]: {
    id: QUICK_ARRIVE_IDS.lv,
    city: 'lv',
    kind: 'arrive',
    name_ko: '라스베가스 도착',
    name_en: 'Las Vegas Arrival',
    start_latitude: QUICK_CITIES.lv.lat,
    start_longitude: QUICK_CITIES.lv.lng,
    duration_hours: 0,
    parent_id: null,
    category: '도착',
  },
  [QUICK_ARRIVE_IDS.la]: {
    id: QUICK_ARRIVE_IDS.la,
    city: 'la',
    kind: 'arrive',
    name_ko: 'LA 도착',
    name_en: 'LA Arrival',
    start_latitude: QUICK_CITIES.la.lat,
    start_longitude: QUICK_CITIES.la.lng,
    duration_hours: 0,
    parent_id: null,
    category: '도착',
  },
}

export function isQuickQuoteWaypointId(id: string): boolean {
  return id in WAYPOINTS
}

export function getQuickQuoteWaypoint(id: string): QuickQuoteWaypoint | null {
  return WAYPOINTS[id] ?? null
}

export function getQuickDepartId(city: QuickQuoteCity): string {
  return QUICK_DEPART_IDS[city]
}

export function getQuickArriveId(city: QuickQuoteCity): string {
  return QUICK_ARRIVE_IDS[city]
}

export function parseQuickDepartCity(id: string): QuickQuoteCity | null {
  if (id === QUICK_DEPART_IDS.lv) return 'lv'
  if (id === QUICK_DEPART_IDS.la) return 'la'
  return null
}

export function parseQuickArriveCity(id: string): QuickQuoteCity | null {
  if (id === QUICK_ARRIVE_IDS.lv) return 'lv'
  if (id === QUICK_ARRIVE_IDS.la) return 'la'
  return null
}

export function isQuickQuoteOneWay(
  departure: QuickQuoteCity | null,
  arrival: QuickQuoteCity | null
): boolean {
  return Boolean(departure && arrival && departure !== arrival)
}

export function hotelNightlyRate(season: QuickHotelSeason): number {
  return season === 'high' ? QUICK_HOTEL_HIGH_RATE : QUICK_HOTEL_LOW_RATE
}

export function calcQuickHotelRooms(customerRooms: number): number {
  return Math.max(1, customerRooms) + QUICK_HOTEL_GUIDE_ROOMS
}

export function calcQuickHotelCost(
  season: QuickHotelSeason,
  customerRooms: number,
  nights: number
): number {
  return calcQuickHotelRooms(customerRooms) * hotelNightlyRate(season) * Math.max(0, nights)
}

export function suggestedCustomerRooms(participantCount: number): number {
  return Math.max(1, Math.ceil(Math.max(1, participantCount) / 2))
}

type CoordCourse = {
  id: string
  parent_id?: string | null
  start_latitude?: number | string | null
  start_longitude?: number | string | null
}

function toCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : null
}

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function resolveScheduleStopCoords(
  courseId: string,
  allCourses: CoordCourse[]
): GeoPoint | null {
  const waypoint = getQuickQuoteWaypoint(courseId)
  if (waypoint) {
    return { lat: waypoint.start_latitude, lng: waypoint.start_longitude }
  }
  return getCourseMapCoords(allCourses.find((course) => course.id === courseId), allCourses)
}

export function getCourseMapCoords(
  course: CoordCourse | undefined,
  allCourses: CoordCourse[],
  visited = new Set<string>()
): GeoPoint | null {
  if (!course) return null
  if (visited.has(course.id)) return null
  visited.add(course.id)

  const lat = toCoord(course.start_latitude)
  const lng = toCoord(course.start_longitude)
  if (lat != null && lng != null) return { lat, lng }

  const children = allCourses.filter((item) => item.parent_id === course.id)
  for (const child of children) {
    const childCoords = getCourseMapCoords(child, allCourses, visited)
    if (childCoords) return childCoords
  }
  return null
}

export function orderQuickQuoteStops(options: {
  departure: QuickQuoteCity | null
  arrival: QuickQuoteCity | null
  destinationIds: string[]
  getCoords: (id: string) => GeoPoint | null
}): string[] {
  const { departure, arrival, destinationIds, getCoords } = options
  const withCoords: string[] = []
  const withoutCoords: string[] = []
  for (const id of destinationIds) {
    if (getCoords(id)) withCoords.push(id)
    else withoutCoords.push(id)
  }

  const implicitStart = departure ? QUICK_CITIES[departure] : QUICK_CITIES.lv
  const ordered: string[] = []
  if (departure) ordered.push(getQuickDepartId(departure))

  let current: GeoPoint = implicitStart
  const remaining = [...withCoords]
  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((id, index) => {
      const coords = getCoords(id)
      if (!coords) return
      const distance = haversineMiles(current, coords)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    const nextId = remaining.splice(bestIndex, 1)[0]
    ordered.push(nextId)
    current = getCoords(nextId) ?? current
  }

  ordered.push(...withoutCoords)

  if (arrival) ordered.push(getQuickArriveId(arrival))

  return ordered
}
