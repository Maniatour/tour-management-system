import {
  displayMainStopLabel,
  excludeAncestorStopsWhenChildrenPresent,
  expandDbKeyCandidates,
  getCourseFromByIdMap,
  isNonAttractionReportStop,
  type CourseForMainStops,
} from '@/lib/tourReportMainStops'
import type { SkippedStopsMap } from '@/lib/tourReportExtras'

export type ReportStopRole = 'required' | 'alternate' | 'optional'

export const REPORT_STOP_ROLES: ReportStopRole[] = ['required', 'alternate', 'optional']

/** 필수 방문 미달 시 skipped_stops에 넣는 단일 키 */
export const TOUR_REPORT_QUOTA_SKIP_KEY = 'required_quota'

export function isQuotaSkipKey(id: string): boolean {
  return id === TOUR_REPORT_QUOTA_SKIP_KEY
}

export function quotaSkipDisplayLabel(locale: string): string {
  return locale === 'en' || locale.startsWith('en')
    ? 'Required viewpoints not met'
    : '필수 방문지 미달'
}

export function parseReportStopRole(raw: unknown): ReportStopRole | null {
  return raw === 'required' || raw === 'alternate' || raw === 'optional' ? raw : null
}

export function reportStopRoleLabel(role: ReportStopRole, locale: string): string {
  const english = locale === 'en' || locale.startsWith('en')
  if (role === 'required') return english ? 'Required' : '필수'
  if (role === 'alternate') return english ? 'Alternate' : '대체'
  return english ? 'Optional' : '선택'
}

export function reportStopRoleFromMap(
  roles: Map<string, ReportStopRole>,
  courseId: string
): ReportStopRole | null {
  for (const key of expandDbKeyCandidates(courseId)) {
    const role = roles.get(key)
    if (role) return role
  }
  return null
}

export function hasConfiguredReportStopRoles(roles: Map<string, ReportStopRole>): boolean {
  for (const role of roles.values()) {
    if (role === 'required' || role === 'alternate' || role === 'optional') return true
  }
  return false
}

function pushVisibleStop(
  out: string[],
  seen: Set<string>,
  id: string,
  byId: Map<string, CourseForMainStops>
) {
  const course = getCourseFromByIdMap(byId, id)
  if (!course || isNonAttractionReportStop(course)) return
  if (seen.has(course.id)) return
  seen.add(course.id)
  out.push(course.id)
}

/**
 * 상품에 연결된 투어 포인트는 항상 보여 준다.
 * 필수·대체는 배지·쿼터용이며, 정차·휴게소·상위 폴더는 빼 실제 포인트만 남긴다.
 */
export function filterMainStopIdsByReportRoles(
  optionIds: string[],
  byId: Map<string, CourseForMainStops>,
  roles: Map<string, ReportStopRole>
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const id of optionIds) {
    pushVisibleStop(out, seen, id, byId)
  }

  if (hasConfiguredReportStopRoles(roles)) {
    for (const [id, role] of roles) {
      if (role !== 'required' && role !== 'alternate' && role !== 'optional') continue
      pushVisibleStop(out, seen, id, byId)
    }
  }

  return excludeAncestorStopsWhenChildrenPresent(out, byId)
}

export function countRequiredReportStops(
  roles: Map<string, ReportStopRole>,
  optionIds?: string[],
  byId?: Map<string, CourseForMainStops>
): number {
  if (!optionIds) {
    let count = 0
    for (const role of roles.values()) {
      if (role === 'required') count += 1
    }
    return count
  }
  const seen = new Set<string>()
  let count = 0
  for (const id of optionIds) {
    const course = byId ? getCourseFromByIdMap(byId, id) : undefined
    const canonical = course?.id ?? id
    if (seen.has(canonical)) continue
    seen.add(canonical)
    if (reportStopRoleFromMap(roles, canonical) === 'required') count += 1
  }
  return count
}

export function countQualifyingVisitedStops(
  visitedIds: string[],
  roles: Map<string, ReportStopRole>,
  byId: Map<string, CourseForMainStops>
): number {
  let count = 0
  const seen = new Set<string>()
  for (const id of visitedIds) {
    const course = getCourseFromByIdMap(byId, id)
    const canonical = course?.id ?? id
    if (seen.has(canonical)) continue
    const role = reportStopRoleFromMap(roles, canonical)
    if (role !== 'required' && role !== 'alternate') continue
    seen.add(canonical)
    count += 1
  }
  return count
}

export function reportStopQuotaShortfall(
  requiredCount: number,
  qualifyingVisited: number
): number {
  return Math.max(0, requiredCount - qualifyingVisited)
}

export function hasQuotaSkipReason(skipped: SkippedStopsMap): boolean {
  const entry = skipped[TOUR_REPORT_QUOTA_SKIP_KEY]
  if (!entry) return false
  return Boolean(entry.reason?.trim() || entry.note?.trim())
}

export function displaySkippedStopLabel(
  stopId: string,
  byId: Map<string, CourseForMainStops>,
  locale: string
): string | null {
  if (isQuotaSkipKey(stopId)) return quotaSkipDisplayLabel(locale)
  return displayMainStopLabel(stopId, byId, locale)
}
