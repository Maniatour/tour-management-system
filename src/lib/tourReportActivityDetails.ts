import type { CourseForMainStops } from '@/lib/tourReportMainStops'
import { displayCourseName } from '@/lib/tourReportMainStops'
import { isEnglishTourReportLocale } from '@/lib/tourReportExtras'
import { normalizeTourReportEmail } from '@/lib/tourReportMissing'

export type HorseshoeBendActivity = 'hiking' | 'parking_wait' | 'antelope_checkin'
export type SunrisePointKey = 'grandview' | 'mather' | 'navajo' | 'yavapai'
export type SunriseActivity = 'vehicle_wait' | 'photography'
export type DrivingSeat = 'me' | 'partner' | 'none'

export type DrivingClaim = {
  segmentId: string
  fromEmail: string
  fromName: string
  claimedAt: string
}

export type DrivingRoster = {
  selfSegmentIds: string[]
  partnerSegmentIds: string[]
  claims: DrivingClaim[]
}

export type TourReportActivityDetails = {
  horseshoeBend?: Record<string, HorseshoeBendActivity>
  sunrise?: {
    pointKey: SunrisePointKey
    courseId: string | null
    activity: SunriseActivity
  }
  drivingRoster?: DrivingRoster
}

export type PartnerDrivingReport = {
  id: string
  user_email: string
  userName: string
  driving_segment_ids: string[]
  activity_details: TourReportActivityDetails
  submitted_on: string | null
  updated_at: string | null
}

export const HORSESHOE_BEND_ACTIVITIES: {
  value: HorseshoeBendActivity
  ko: string
  en: string
}[] = [
  { value: 'hiking', ko: '하이킹', en: 'Hiking' },
  { value: 'parking_wait', ko: '주차장 대기', en: 'Waited at parking lot' },
  { value: 'antelope_checkin', ko: '앤텔롭캐년 체크인 다녀옴', en: 'Went to Antelope Canyon check-in' },
]

export const SUNRISE_POINTS: {
  key: SunrisePointKey
  ko: string
  en: string
}[] = [
  { key: 'grandview', ko: '그랜드뷰 포인트', en: 'Grand View Point' },
  { key: 'mather', ko: '마더 포인트', en: 'Mather Point' },
  { key: 'navajo', ko: '나바호 포인트', en: 'Navajo Point' },
  { key: 'yavapai', ko: '야바파이 포인트', en: 'Yavapai Point' },
]

export const SUNRISE_ACTIVITIES: {
  value: SunriseActivity
  ko: string
  en: string
}[] = [
  { value: 'vehicle_wait', ko: '일출 시간에 차량 대기', en: 'Waited in the vehicle at sunrise' },
  { value: 'photography', ko: '사진 촬영', en: 'Took photos' },
]

function joinedCourseText(course: Pick<CourseForMainStops, 'name_ko' | 'name_en' | 'customer_name_ko' | 'customer_name_en'>): string {
  return [course.name_ko, course.name_en, course.customer_name_ko, course.customer_name_en]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
}

export function isHorseshoeBendCourse(
  course: Pick<CourseForMainStops, 'name_ko' | 'name_en' | 'customer_name_ko' | 'customer_name_en'>
): boolean {
  const text = joinedCourseText(course)
  if (!text) return false
  return /홀스슈|홀슈|호스슈|horseshoe/i.test(text)
}

export function sunrisePointKeyFromCourse(
  course: Pick<CourseForMainStops, 'name_ko' | 'name_en' | 'customer_name_ko' | 'customer_name_en'>
): SunrisePointKey | null {
  const text = joinedCourseText(course)
  if (!text) return null
  if (/림\s*트레일|rim\s*trail/i.test(text)) return null
  if (/그랜드\s*뷰|grand\s*view|grandview/i.test(text)) return 'grandview'
  if (/매더|마더|mather/i.test(text)) return 'mather'
  if (/나바호|navajo/i.test(text)) return 'navajo'
  if (/야바파이|yavapai/i.test(text)) return 'yavapai'
  return null
}

export function displayHorseshoeBendActivity(value: string, locale: string): string {
  const opt = HORSESHOE_BEND_ACTIVITIES.find((item) => item.value === value)
  if (!opt) return value
  return isEnglishTourReportLocale(locale) ? opt.en : opt.ko
}

export function displaySunrisePoint(key: string, locale: string): string {
  const opt = SUNRISE_POINTS.find((item) => item.key === key)
  if (!opt) return key
  return isEnglishTourReportLocale(locale) ? opt.en : opt.ko
}

export function displaySunriseActivity(value: string, locale: string): string {
  const opt = SUNRISE_ACTIVITIES.find((item) => item.value === value)
  if (!opt) return value
  return isEnglishTourReportLocale(locale) ? opt.en : opt.ko
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item || '').trim()).filter(Boolean)
}

function parseHorseshoeMap(raw: unknown): Record<string, HorseshoeBendActivity> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const allowed = new Set<string>(HORSESHOE_BEND_ACTIVITIES.map((item) => item.value))
  const out: Record<string, HorseshoeBendActivity> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(id).trim()
    const activity = String(value || '').trim()
    if (!key || !allowed.has(activity)) continue
    out[key] = activity as HorseshoeBendActivity
  }
  return out
}

function parseClaims(raw: unknown): DrivingClaim[] {
  if (!Array.isArray(raw)) return []
  const out: DrivingClaim[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const rec = row as Record<string, unknown>
    const segmentId = String(rec.segmentId || '').trim()
    const fromEmail = normalizeTourReportEmail(String(rec.fromEmail || ''))
    const fromName = String(rec.fromName || '').trim()
    const claimedAt = String(rec.claimedAt || '').trim()
    if (!segmentId || !fromEmail) continue
    out.push({
      segmentId,
      fromEmail,
      fromName: fromName || fromEmail,
      claimedAt: claimedAt || new Date().toISOString(),
    })
  }
  return out
}

export function parseActivityDetails(raw: unknown): TourReportActivityDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rec = raw as Record<string, unknown>
  const out: TourReportActivityDetails = {}

  const horseshoe = parseHorseshoeMap(rec.horseshoeBend)
  if (Object.keys(horseshoe).length > 0) out.horseshoeBend = horseshoe

  if (rec.sunrise && typeof rec.sunrise === 'object' && !Array.isArray(rec.sunrise)) {
    const sun = rec.sunrise as Record<string, unknown>
    const pointKey = String(sun.pointKey || '').trim() as SunrisePointKey
    const activity = String(sun.activity || '').trim() as SunriseActivity
    if (SUNRISE_POINTS.some((item) => item.key === pointKey) && SUNRISE_ACTIVITIES.some((item) => item.value === activity)) {
      const courseId = String(sun.courseId || '').trim()
      out.sunrise = {
        pointKey,
        courseId: courseId || null,
        activity,
      }
    }
  }

  if (rec.drivingRoster && typeof rec.drivingRoster === 'object' && !Array.isArray(rec.drivingRoster)) {
    const roster = rec.drivingRoster as Record<string, unknown>
    out.drivingRoster = {
      selfSegmentIds: asStringArray(roster.selfSegmentIds),
      partnerSegmentIds: asStringArray(roster.partnerSegmentIds),
      claims: parseClaims(roster.claims),
    }
  }

  return out
}

export function emptyDrivingAssignment(segmentIds: string[]): Record<string, DrivingSeat> {
  const out: Record<string, DrivingSeat> = {}
  for (const id of segmentIds) out[id] = 'none'
  return out
}

export function assignmentFromRoster(
  segmentIds: string[],
  roster: DrivingRoster | undefined,
  fallbackSelfIds: string[],
  fallbackPartnerIds: string[]
): Record<string, DrivingSeat> {
  const out = emptyDrivingAssignment(segmentIds)
  const self = new Set(roster?.selfSegmentIds?.length ? roster.selfSegmentIds : fallbackSelfIds)
  const partner = new Set(roster?.partnerSegmentIds?.length ? roster.partnerSegmentIds : fallbackPartnerIds)
  for (const id of segmentIds) {
    if (self.has(id)) out[id] = 'me'
    else if (partner.has(id)) out[id] = 'partner'
  }
  return out
}

/** 파트너가 자기 것이라고 한 구간 */
export function partnerSelfSegmentIds(partner: PartnerDrivingReport | undefined): string[] {
  if (!partner) return []
  const roster = partner.activity_details.drivingRoster
  if (roster?.selfSegmentIds?.length) return [...new Set(roster.selfSegmentIds)]
  return [...new Set(partner.driving_segment_ids)]
}

/** 파트너가 ‘당신이 운전했다’고 표시한 구간 */
export function partnerAssignedToMeSegmentIds(partner: PartnerDrivingReport | undefined): string[] {
  if (!partner) return []
  return [...new Set(partner.activity_details.drivingRoster?.partnerSegmentIds ?? [])]
}

/**
 * 파트너 일정표를 내 시점으로 뒤집기.
 * 상대 self → 내 파트너 칸, 상대가 나에게 준 구간 → 내 자신 칸.
 */
export function flippedAssignmentFromPartner(
  segmentIds: string[],
  partner: PartnerDrivingReport | undefined
): Record<string, DrivingSeat> {
  const out = emptyDrivingAssignment(segmentIds)
  if (!partner) return out
  const theirSelf = new Set(partnerSelfSegmentIds(partner))
  const assignedToMe = new Set(partnerAssignedToMeSegmentIds(partner))
  for (const id of segmentIds) {
    if (theirSelf.has(id)) out[id] = 'partner'
    else if (assignedToMe.has(id)) out[id] = 'me'
  }
  return out
}

export function rosterFromAssignment(
  assignment: Record<string, DrivingSeat>,
  partnerSelfIds: string[],
  partnerEmail: string,
  partnerName: string,
  previousClaims: DrivingClaim[]
): DrivingRoster {
  const selfSegmentIds: string[] = []
  const partnerSegmentIds: string[] = []
  const partnerSelf = new Set(partnerSelfIds)
  const prevBySegment = new Map(previousClaims.map((claim) => [claim.segmentId, claim] as const))
  const claims: DrivingClaim[] = []
  const now = new Date().toISOString()

  for (const [segmentId, seat] of Object.entries(assignment)) {
    if (seat === 'me') {
      selfSegmentIds.push(segmentId)
      if (partnerSelf.has(segmentId) && partnerEmail) {
        claims.push(
          prevBySegment.get(segmentId) ?? {
            segmentId,
            fromEmail: partnerEmail,
            fromName: partnerName,
            claimedAt: now,
          }
        )
      }
    } else if (seat === 'partner') {
      partnerSegmentIds.push(segmentId)
    }
  }

  return { selfSegmentIds, partnerSegmentIds, claims }
}

export function unassignedDrivingIds(
  segmentIds: string[],
  assignment: Record<string, DrivingSeat>
): string[] {
  return segmentIds.filter((id) => (assignment[id] || 'none') === 'none')
}

export function overlapDrivingIds(
  selfIds: string[],
  partnerIds: string[]
): string[] {
  const mine = new Set(selfIds)
  return partnerIds.filter((id) => mine.has(id))
}

export type ResolvedDrivingSegment = {
  segmentId: string
  driverEmail: string | null
  driverName: string | null
  claim: DrivingClaim | null
}

export function resolveTourDriving(
  segmentIds: string[],
  reports: PartnerDrivingReport[]
): ResolvedDrivingSegment[] {
  const sorted = [...reports].sort((a, b) => {
    const at = Date.parse(a.updated_at || a.submitted_on || '') || 0
    const bt = Date.parse(b.updated_at || b.submitted_on || '') || 0
    return at - bt
  })
  const latestRoster = [...sorted].reverse().find((row) => row.activity_details.drivingRoster)

  if (latestRoster?.activity_details.drivingRoster) {
    const roster = latestRoster.activity_details.drivingRoster
    const myEmail = normalizeTourReportEmail(latestRoster.user_email)
    const claimBySeg = new Map(roster.claims.map((claim) => [claim.segmentId, claim] as const))
    const partner = sorted.find((row) => normalizeTourReportEmail(row.user_email) !== myEmail)
    return segmentIds.map((segmentId) => {
      const claim = claimBySeg.get(segmentId) ?? null
      if (roster.selfSegmentIds.includes(segmentId)) {
        return {
          segmentId,
          driverEmail: myEmail,
          driverName: latestRoster.userName,
          claim,
        }
      }
      if (roster.partnerSegmentIds.includes(segmentId)) {
        return {
          segmentId,
          driverEmail: partner ? normalizeTourReportEmail(partner.user_email) : null,
          driverName: partner?.userName ?? null,
          claim: null,
        }
      }
      return { segmentId, driverEmail: null, driverName: null, claim: null }
    })
  }

  const driverBySeg = new Map<string, { email: string; name: string }>()
  for (const row of sorted) {
    for (const id of row.driving_segment_ids) {
      driverBySeg.set(id, {
        email: normalizeTourReportEmail(row.user_email),
        name: row.userName,
      })
    }
  }
  return segmentIds.map((segmentId) => {
    const driver = driverBySeg.get(segmentId)
    return {
      segmentId,
      driverEmail: driver?.email ?? null,
      driverName: driver?.name ?? null,
      claim: null,
    }
  })
}

export function claimsAgainstEmail(
  reports: PartnerDrivingReport[],
  email: string
): DrivingClaim[] {
  const target = normalizeTourReportEmail(email)
  const out: DrivingClaim[] = []
  for (const row of reports) {
    if (normalizeTourReportEmail(row.user_email) === target) continue
    for (const claim of row.activity_details.drivingRoster?.claims ?? []) {
      if (claim.fromEmail === target) out.push(claim)
    }
  }
  return out
}

export function sunriseCourseIdForKey(
  key: SunrisePointKey,
  courses: CourseForMainStops[]
): string | null {
  const match = courses.find((course) => sunrisePointKeyFromCourse(course) === key)
  return match?.id ?? null
}

export function horseshoeStopIds(courses: { id: string; course: CourseForMainStops }[]): string[] {
  return courses.filter((row) => isHorseshoeBendCourse(row.course)).map((row) => row.id)
}

export function sunriseLabelForCourse(course: CourseForMainStops, locale: string): string {
  const key = sunrisePointKeyFromCourse(course)
  if (key) return displaySunrisePoint(key, locale)
  return displayCourseName(course, locale)
}
