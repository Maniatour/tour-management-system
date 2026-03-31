/** 투어 리포트「주요 방문지」: 상품에 연결된 투어 코스 중 투어 포인트만, leaf면 형제 포인트까지 펼침 */

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

export function isTourPointCategory(course: CourseForMainStops): boolean {
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
  if (locale === 'en') {
    const v = (course.customer_name_en || course.name_en || '').trim()
    return v || course.name_en
  }
  const v = (course.customer_name_ko || course.name_ko || '').trim()
  return v || course.name_ko
}

export function hasChildInMap(courseId: string, byId: Map<string, CourseForMainStops>): boolean {
  for (const c of byId.values()) {
    if (c.parent_id === courseId) return true
  }
  return false
}

/**
 * product_tour_courses에 포함된 코스 ID 집합 중, 투어 포인트만 반영.
 * 선택된 노드가 leaf 투어 포인트면 같은 parent 아래 투어 포인트 전부 포함.
 */
export function buildMainStopCourseIds(
  selectedLinkCourseIds: Set<string>,
  coursesById: Map<string, CourseForMainStops>
): string[] {
  const result = new Set<string>()

  for (const id of selectedLinkCourseIds) {
    const c = coursesById.get(id)
    if (!c || !isTourPointCategory(c)) continue

    if (!hasChildInMap(c.id, coursesById)) {
      const pid = c.parent_id
      if (pid) {
        for (const s of coursesById.values()) {
          if (s.parent_id === pid && isTourPointCategory(s)) {
            result.add(s.id)
          }
        }
      } else {
        result.add(c.id)
      }
    } else {
      result.add(c.id)
    }
  }

  return [...result]
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

/** 주요 방문지: 부모→자식 순으로 정렬 + 들여쓰기용 depth(0=최상위) */
export function sortMainStopsIndented(
  byId: Map<string, CourseForMainStops>,
  options: { id: string; course: CourseForMainStops; sort_order: number }[]
): { id: string; course: CourseForMainStops; sort_order: number; depth: number }[] {
  return [...options]
    .map((o) => {
      const chain = courseAncestorChain(byId, o.id)
      return {
        ...o,
        depth: Math.max(0, chain.length - 1),
      }
    })
    .sort((a, b) => {
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
