/**
 * 투어 비용 계산기 「빠른 견적」용 대표 관광지.
 * 최하위 뷰포인트(리판 포인트 등)·휴게소·식사는 빼고,
 * 사우스림·앤텔롭·홀스슈 밴드처럼 견적에 쓰는 코스만 남긴다.
 */

export type RepresentativeCourseLike = {
  id: string
  parent_id: string | null
  name_ko?: string | null
  name_en?: string | null
  category?: string | null
  location?: string | null
  sort_order?: number | null
}

export type RepresentativeCourseGroup<T extends RepresentativeCourseLike> = {
  id: string
  nameKo: string
  nameEn: string
  sortOrder: number
  courses: T[]
}

const STANDALONE_GROUP_ID = '__standalone__'

function haystack(course: RepresentativeCourseLike): string {
  return `${course.category || ''} ${course.name_ko || ''} ${course.name_en || ''} ${course.location || ''}`.toLowerCase()
}

export function isNonDestinationCourse(course: RepresentativeCourseLike): boolean {
  const text = haystack(course)
  const excluded = [
    '휴게',
    'rest stop',
    'rest area',
    'restroom',
    '식사',
    '식당',
    'restaurant',
    '음식',
    'food',
    '숙박',
    'hotel',
    'accommodation',
    '주유',
    'gas station',
    '쇼핑',
    'shopping',
  ]
  return excluded.some((token) => text.includes(token))
}

export function isRepresentativeTourCourse<T extends RepresentativeCourseLike>(
  course: T,
  allCourses: T[]
): boolean {
  if (isNonDestinationCourse(course)) return false

  const children = allCourses.filter((c) => c.parent_id === course.id)

  if (children.length === 0 && !course.parent_id) return true
  if (children.length === 0 && course.parent_id) return false

  return children.some((child) => !allCourses.some((c) => c.parent_id === child.id))
}

export function getRepresentativeTourCourses<T extends RepresentativeCourseLike>(courses: T[]): T[] {
  return courses.filter((course) => isRepresentativeTourCourse(course, courses))
}

function compareCourses<T extends RepresentativeCourseLike>(a: T, b: T): number {
  const sortDiff = (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
  if (sortDiff !== 0) return sortDiff
  return (a.name_ko || a.name_en || '').localeCompare(b.name_ko || b.name_en || '', 'ko')
}

export function groupRepresentativeTourCourses<T extends RepresentativeCourseLike>(
  representatives: T[],
  allCourses: T[]
): RepresentativeCourseGroup<T>[] {
  const byId = new Map(allCourses.map((course) => [course.id, course]))
  const groups = new Map<string, RepresentativeCourseGroup<T>>()

  for (const course of representatives) {
    const parent = course.parent_id ? byId.get(course.parent_id) : undefined
    const groupId = parent?.id ?? STANDALONE_GROUP_ID
    const existing = groups.get(groupId)
    if (existing) {
      existing.courses.push(course)
      continue
    }
    groups.set(groupId, {
      id: groupId,
      nameKo: parent ? parent.name_ko || parent.name_en || '' : '',
      nameEn: parent ? parent.name_en || parent.name_ko || '' : '',
      sortOrder: parent?.sort_order ?? 9999,
      courses: [course],
    })
  }

  return [...groups.values()]
    .map((group) => ({ ...group, courses: [...group.courses].sort(compareCourses) }))
    .sort((a, b) => {
      if (a.id === STANDALONE_GROUP_ID) return 1
      if (b.id === STANDALONE_GROUP_ID) return -1
      const sortDiff = a.sortOrder - b.sortOrder
      if (sortDiff !== 0) return sortDiff
      return a.nameKo.localeCompare(b.nameKo, 'ko')
    })
}

export function matchesCourseSearch(course: RepresentativeCourseLike, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true
  const needle = searchTerm.trim().toLowerCase()
  return (
    (course.name_ko || '').toLowerCase().includes(needle) ||
    (course.name_en || '').toLowerCase().includes(needle) ||
    (course.location || '').toLowerCase().includes(needle)
  )
}
