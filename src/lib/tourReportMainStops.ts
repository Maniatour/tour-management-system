/** 투어 리포트「주요 방문지」: 상품에 연결된 투어 코스 중 투어 포인트만 (정차·픽업/드롭 제외) */

/**
 * DB에 저장된 키가 UUID 대소문자·하이픈 유무 등으로 달라도 매칭되게 후보 목록 확장.
 * UUID가 아니면 trim 된 원문만 사용(임의 텍스트 id 대소문자 변경은 하지 않음).
 */
export function expandDbKeyCandidates(raw: string | null | undefined): string[] {
  if (raw == null) return []
  const t = String(raw).trim()
  if (!t) return []
  const out = new Set<string>([t])
  const hex = t.replace(/-/g, '').toLowerCase()
  if (hex.length === 32 && /^[0-9a-f]{32}$/.test(hex)) {
    const dashed = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    out.add(dashed)
    out.add(hex)
    out.add(t.toLowerCase())
  }
  return [...out]
}

export function expandManyDbKeyCandidates(ids: string[]): string[] {
  const u = new Set<string>()
  for (const id of ids) {
    for (const c of expandDbKeyCandidates(id)) u.add(c)
  }
  return [...u]
}

/** UUID(하이픈 유무)처럼 사람 눈에 보이면 안 되는 저장용 키 */
export function isOpaqueRecordId(value: string | null | undefined): boolean {
  if (value == null) return false
  const t = String(value).trim()
  if (!t) return false
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return true
  }
  const hex = t.replace(/-/g, '')
  return hex.length === 32 && /^[0-9a-f]{32}$/i.test(hex)
}

/** 코스에 없을 때 Main Stops에 넣는 나바호 포인트 */
export const NAVAJO_POINT_MAIN_STOP_ID = 'tour-report-stop:navajo-point'

export function navajoPointMainStopCourse(): CourseForMainStops {
  return {
    id: NAVAJO_POINT_MAIN_STOP_ID,
    parent_id: null,
    name_ko: '나바호 포인트',
    name_en: 'Navajo Point',
    customer_name_ko: '나바호 포인트',
    customer_name_en: 'Navajo Point',
    category: 'tour point',
    category_id: null,
    path: null,
    sort_order: 10_000,
  }
}

/** byId 키는 DB가 준 id(단일 형식)만 둔다고 가정하고, 요청 id의 후보로 조회 */
export function getCourseFromByIdMap(
  byId: Map<string, CourseForMainStops>,
  id: string
): CourseForMainStops | undefined {
  for (const a of expandDbKeyCandidates(id)) {
    const c = byId.get(a)
    if (c) return c
  }
  return undefined
}

export function resolveCanonicalCourseIds(
  requestedIds: string[],
  byId: Map<string, CourseForMainStops>
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of requestedIds) {
    const c = getCourseFromByIdMap(byId, id)
    if (c && !seen.has(c.id)) {
      seen.add(c.id)
      out.push(c.id)
    }
  }
  return out
}

export type TourCourseCategoryJoin = {
  name_ko: string
  name_en: string
} | null

export type CourseForMainStops = {
  id: string
  parent_id: string | null
  name_ko: string
  name_en: string
  customer_name_ko: string | null
  customer_name_en: string | null
  category: string | null
  category_id: string | null
  path: string | null
  sort_order: number | null
  tour_course_categories?: TourCourseCategoryJoin | TourCourseCategoryJoin[]
}

function normalizedCategoryJoin(
  c: CourseForMainStops
): { name_ko: string; name_en: string } | null {
  const raw = c.tour_course_categories
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  return row?.name_ko ? row : null
}

function normalizeStopName(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}

export function isHotelPickupOrDropCourse(course: CourseForMainStops): boolean {
  const names = [
    course.name_ko,
    course.name_en,
    course.customer_name_ko,
    course.customer_name_en,
  ]
  return names.some((name) => {
    const normalized = normalizeStopName(name)
    return (
      normalized === '호텔 픽업' ||
      normalized === '호텔픽업' ||
      normalized === '호텔 드롭' ||
      normalized === '호텔드롭' ||
      normalized === '호텔 드랍' ||
      normalized === '호텔드랍' ||
      normalized === '호텔 하차' ||
      normalized === '호텔하차' ||
      normalized === 'hotel pickup' ||
      normalized === 'hotel pick up' ||
      normalized === 'hotel drop off' ||
      normalized === 'hotel dropoff'
    )
  })
}

function categoryLabels(course: CourseForMainStops): { ko: string; en: string; legacy: string } {
  const cat = normalizedCategoryJoin(course)
  return {
    ko: (cat?.name_ko || '').trim(),
    en: (cat?.name_en || '').trim().toLowerCase(),
    legacy: (course.category || '').trim(),
  }
}

/** 관광지가 아닌 정차(픽업·드롭 등) */
export function isOperationalStopCourse(course: CourseForMainStops): boolean {
  if (isHotelPickupOrDropCourse(course)) return true
  const { ko, en, legacy } = categoryLabels(course)
  if (ko === '정차' || ko.includes('정차')) return true
  if (en === 'stop' || en === 'operational stop' || en.includes('operational stop')) return true
  if (legacy === '정차') return true
  if (legacy.toLowerCase() === 'stop' || legacy.toLowerCase() === 'operational stop') return true
  return false
}

/** 휴게소·식사 등 관광지가 아닌 중간 정차 */
export function isRestOrMealStopCourse(course: CourseForMainStops): boolean {
  const { ko, en, legacy } = categoryLabels(course)
  if (ko === '휴게소' || ko.includes('휴게')) return true
  if (ko === '식사' || ko.includes('식사')) return true
  if (
    en === 'restroom break' ||
    en.includes('rest stop') ||
    en.includes('restroom') ||
    en.includes('meal stop') ||
    en === 'meal'
  ) {
    return true
  }
  const legacyLower = legacy.toLowerCase()
  if (legacy === '휴게소' || legacy.includes('휴게')) return true
  if (legacy === '식사' || legacy.includes('식사')) return true
  if (legacyLower.includes('rest stop') || legacyLower.includes('restroom') || legacyLower.includes('meal')) {
    return true
  }
  return false
}

export function isNonAttractionReportStop(course: CourseForMainStops): boolean {
  return isOperationalStopCourse(course) || isRestOrMealStopCourse(course)
}

export function isTourPointCategory(course: CourseForMainStops): boolean {
  if (isNonAttractionReportStop(course)) return false
  const cat = normalizedCategoryJoin(course)
  if (cat) {
    const ko = (cat.name_ko || '').trim()
    const en = (cat.name_en || '').trim().toLowerCase()
    if (ko === '투어 포인트' || ko.includes('투어 포인트')) return true
    if (en === 'tour point' || en.includes('tour point')) return true
  }
  const legacy = (course.category || '').trim().toLowerCase()
  return legacy.includes('tour point') || legacy.includes('투어 포인트')
}

export function displayCourseName(course: CourseForMainStops, locale: string): string {
  const en = (course.customer_name_en || course.name_en || '').trim()
  const ko = (course.customer_name_ko || course.name_ko || '').trim()
  if (locale === 'en' || locale.startsWith('en')) {
    return en || ko
  }
  return ko || en
}

/** 정류장 표시명. UUID만 있으면 숨기기 위해 null */
export function displayMainStopLabel(
  stopId: string,
  byId: Map<string, CourseForMainStops>,
  locale: string
): string | null {
  if (stopId === NAVAJO_POINT_MAIN_STOP_ID) {
    return locale === 'en' || locale.startsWith('en') ? 'Navajo Point' : '나바호 포인트'
  }
  const course = getCourseFromByIdMap(byId, stopId)
  if (course) {
    const name = displayCourseName(course, locale).trim()
    if (name && !isOpaqueRecordId(name)) return name
  }
  const raw = String(stopId || '').trim()
  if (!raw || isOpaqueRecordId(raw)) return null
  return raw
}

export function hasChildInMap(courseId: string, byId: Map<string, CourseForMainStops>): boolean {
  for (const c of byId.values()) {
    if (c.parent_id === courseId) return true
  }
  return false
}

/**
 * product_tour_courses에 포함된 코스 ID 집합 중, 투어 포인트만 반영.
 * 형제 코스(다른 지역 변형 등)는 상품에 직접 연결되지 않으면 넣지 않는다.
 */
export function buildMainStopCourseIds(
  selectedLinkCourseIds: Set<string>,
  coursesById: Map<string, CourseForMainStops>
): string[] {
  const result = new Set<string>()

  for (const id of selectedLinkCourseIds) {
    const c = getCourseFromByIdMap(coursesById, id)
    if (!c || !isTourPointCategory(c)) continue
    result.add(c.id)
  }

  return [...result]
}

/** 자식 방문지가 같이 있으면 그랜드캐년·사우스림 같은 상위 폴더는 빼 실제 포인트만 남긴다. */
export function excludeAncestorStopsWhenChildrenPresent(
  ids: string[],
  byId: Map<string, CourseForMainStops>
): string[] {
  const canonical = [...new Set(ids.map((id) => getCourseFromByIdMap(byId, id)?.id ?? id))]
  const selected = new Set(canonical)
  return canonical.filter((id) => {
    const course = getCourseFromByIdMap(byId, id)
    if (!course) return true
    for (const otherId of selected) {
      if (otherId === id) continue
      let cur = getCourseFromByIdMap(byId, otherId)
      while (cur?.parent_id) {
        const parent = getCourseFromByIdMap(byId, cur.parent_id)
        if (!parent) break
        if (parent.id === course.id) return false
        cur = parent
      }
    }
    return true
  })
}

/** 상품에 연결된 코스(또는 가장 가까운 연결 조상)의 순서 */
export function productOrderForCourse(
  courseId: string,
  byId: Map<string, CourseForMainStops>,
  linkedOrder: Map<string, number>
): number {
  let cur: CourseForMainStops | null | undefined = getCourseFromByIdMap(byId, courseId)
  while (cur) {
    for (const key of expandDbKeyCandidates(cur.id)) {
      const order = linkedOrder.get(key)
      if (order != null) return order
    }
    cur = cur.parent_id ? getCourseFromByIdMap(byId, cur.parent_id) ?? null : null
  }
  return 10_000
}

function courseAncestorChain(
  byId: Map<string, CourseForMainStops>,
  id: string
): CourseForMainStops[] {
  const chain: CourseForMainStops[] = []
  let cur: CourseForMainStops | null | undefined = getCourseFromByIdMap(byId, id)
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent_id ? getCourseFromByIdMap(byId, cur.parent_id) ?? null : null
  }
  return chain
}

export type MainStopOption = {
  id: string
  course: CourseForMainStops
  sort_order: number
  product_order?: number
}

/** 주요 방문지: 상품 코스 순서 우선, 같으면 부모→자식 순 + 들여쓰기용 depth(0=최상위) */
export function sortMainStopsIndented(
  byId: Map<string, CourseForMainStops>,
  options: MainStopOption[]
): (MainStopOption & { depth: number })[] {
  return [...options]
    .map((o) => {
      const chain = courseAncestorChain(byId, o.id)
      return {
        ...o,
        depth: Math.max(0, chain.length - 1),
      }
    })
    .sort((a, b) => {
      const pa = a.product_order ?? 10_000
      const pb = b.product_order ?? 10_000
      if (pa !== pb) return pa - pb
      const ca = courseAncestorChain(byId, a.id)
      const cb = courseAncestorChain(byId, b.id)
      const minLen = Math.min(ca.length, cb.length)
      for (let i = 0; i < minLen; i++) {
        const sa = ca[i].sort_order ?? 0
        const sb = cb[i].sort_order ?? 0
        if (sa !== sb) return sa - sb
        const ida = ca[i].id
        const idb = cb[i].id
        if (ida !== idb) return ida.localeCompare(idb)
      }
      return ca.length - cb.length
    })
}

export type MainStopGroup = {
  id: string
  title: string
  productOrder: number
  stops: (MainStopOption & { depth: number })[]
}

export type MainStopGroupRow = {
  groups: MainStopGroup[]
}

function groupKeyForStop(
  course: CourseForMainStops,
  byId: Map<string, CourseForMainStops>
): { id: string; titleCourse: CourseForMainStops } {
  const parent = course.parent_id ? getCourseFromByIdMap(byId, course.parent_id) : undefined
  if (parent) return { id: parent.id, titleCourse: parent }
  return { id: course.id, titleCourse: course }
}

function siblingFamilyId(
  groupId: string,
  byId: Map<string, CourseForMainStops>
): string | null {
  const node = getCourseFromByIdMap(byId, groupId)
  if (!node?.parent_id) return null
  const grand = getCourseFromByIdMap(byId, node.parent_id)
  return grand?.id ?? node.parent_id
}

/**
 * 사우스림 | 이스트림처럼 같은 상위 아래 형제 그룹은 한 행에 나란히 둔다.
 */
export function groupMainStopsForReport(
  byId: Map<string, CourseForMainStops>,
  options: MainStopOption[],
  locale: string
): MainStopGroupRow[] {
  const sorted = sortMainStopsIndented(byId, options)
  const groupMap = new Map<string, MainStopGroup>()
  const groupOrder: string[] = []

  for (const stop of sorted) {
    const { id, titleCourse } = groupKeyForStop(stop.course, byId)
    let group = groupMap.get(id)
    if (!group) {
      group = {
        id,
        title: displayCourseName(titleCourse, locale),
        productOrder: stop.product_order ?? 10_000,
        stops: [],
      }
      groupMap.set(id, group)
      groupOrder.push(id)
    }
    group.stops.push(stop)
    group.productOrder = Math.min(group.productOrder, stop.product_order ?? 10_000)
  }

  const groups = groupOrder.map((id) => groupMap.get(id)!)
  const familyMembers = new Map<string, MainStopGroup[]>()
  for (const group of groups) {
    const family = siblingFamilyId(group.id, byId)
    if (!family) continue
    const list = familyMembers.get(family) ?? []
    list.push(group)
    familyMembers.set(family, list)
  }

  const used = new Set<string>()
  const rows: MainStopGroupRow[] = []
  for (const group of groups) {
    if (used.has(group.id)) continue
    const family = siblingFamilyId(group.id, byId)
    const siblings = family ? familyMembers.get(family) : undefined
    if (siblings && siblings.length >= 2) {
      for (const sibling of siblings) used.add(sibling.id)
      rows.push({ groups: siblings })
      continue
    }
    used.add(group.id)
    rows.push({ groups: [group] })
  }
  return rows
}
