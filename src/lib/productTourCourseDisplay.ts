import type { ProductTourCourse, TourCourse } from '@/components/product/productDetailTypes'
import {
  getTourCourseLocalizedText,
  resolveTourCourseLocale,
} from '@/lib/productTourCourseLocales'

const EXCLUDED_CUSTOMER_TOUR_COURSE_NAMES = new Set([
  'rest stop',
  'hotel drop off',
  'hotel pick up',
  'hotel pickup',
  'hotel dropoff',
  'hotel pick-up',
  'hotel drop-off',
  '휴게소',
  '호텔 픽업',
  '호텔픽업',
  '호텔 드랍',
  '호텔 드롭',
  '호텔드랍',
  '호텔드롭',
  '호텔 하차',
  '호텔하차',
])

function normalizeCourseNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}

function getCourseNameCandidates(course: TourCourse): string[] {
  const fromI18n = Object.values(course.content_i18n?.name || {})
  return [
    ...fromI18n,
    course.customer_name_en,
    course.customer_name_ko,
    course.name_en,
    course.name_ko,
    course.point_name,
    course.name,
  ].filter((name): name is string => typeof name === 'string' && name.trim() !== '')
}

export function isExcludedCustomerTourCourse(course: TourCourse): boolean {
  return getCourseNameCandidates(course).some((name) => {
    const normalized = normalizeCourseNameForMatch(name)
    return EXCLUDED_CUSTOMER_TOUR_COURSE_NAMES.has(normalized)
  })
}

function getNearestValidParentId(
  course: TourCourse,
  validCourseIds: Set<string>,
  tourCourses: ProductTourCourse[]
): string {
  let parentId = course.parent_id

  while (parentId) {
    const parent = tourCourses.find((item) => item.tour_course?.id === parentId)?.tour_course
    if (!parent) break
    if (isExcludedCustomerTourCourse(parent)) {
      parentId = parent.parent_id
      continue
    }
    if (validCourseIds.has(parent.id)) {
      return parent.id
    }
    parentId = parent.parent_id
  }

  return 'root'
}

function compareTourCoursesBySortOrder(a: TourCourse, b: TourCourse): number {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

export function sortTourCoursesForCustomerDisplay(
  validCourses: TourCourse[],
  tourCourses: ProductTourCourse[]
): TourCourse[] {
  if (validCourses.length <= 1) return validCourses

  const validCourseIds = new Set(validCourses.map((course) => course.id))
  const childrenByParent = new Map<string, TourCourse[]>()

  validCourses.forEach((course) => {
    const parentId = getNearestValidParentId(course, validCourseIds, tourCourses)
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, [])
    }
    childrenByParent.get(parentId)!.push(course)
  })

  childrenByParent.forEach((children) => {
    children.sort(compareTourCoursesBySortOrder)
  })

  const sorted: TourCourse[] = []
  const visited = new Set<string>()

  function walk(parentId: string) {
    const children = childrenByParent.get(parentId) ?? []
    children.forEach((child) => {
      if (visited.has(child.id)) return
      visited.add(child.id)
      sorted.push(child)
      walk(child.id)
    })
  }

  walk('root')

  validCourses.forEach((course) => {
    if (!visited.has(course.id)) {
      sorted.push(course)
    }
  })

  return sorted
}

export function getCourseDisplayName(
  course: TourCourse,
  localeOrIsEnglish: string | boolean
): string {
  return getTourCourseLocalizedText(course, 'name', resolveTourCourseLocale(localeOrIsEnglish))
}

export function getCourseDescription(
  course: TourCourse,
  localeOrIsEnglish: string | boolean
): string {
  return getTourCourseLocalizedText(
    course,
    'description',
    resolveTourCourseLocale(localeOrIsEnglish)
  )
}

export function getFullCoursePath(
  course: TourCourse,
  tourCourses: ProductTourCourse[],
  localeOrIsEnglish: string | boolean
): string {
  const path: string[] = []
  let current: TourCourse | undefined = course
  const visited = new Set<string>()

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const courseName = getCourseDisplayName(current, localeOrIsEnglish)

    if (courseName.trim() && !isExcludedCustomerTourCourse(current)) {
      path.unshift(courseName)
    }

    if (!current.parent_id) {
      break
    }

    const parentId: string | null = current.parent_id
    const parent: TourCourse | undefined = tourCourses.find((ptc) => ptc.tour_course?.id === parentId)?.tour_course
    if (parent) {
      current = parent
    } else {
      break
    }
  }

  return path.join(' > ')
}

export function getValidTourCourses(
  tourCourses: ProductTourCourse[],
  localeOrIsEnglish: string | boolean
): TourCourse[] {
  const validCourses = tourCourses
    .map((ptc) => ptc.tour_course)
    .filter((course): course is TourCourse => {
      if (!course || isExcludedCustomerTourCourse(course)) return false
      const courseName = getCourseDisplayName(course, localeOrIsEnglish)
      const courseDescription = getCourseDescription(course, localeOrIsEnglish)
      return courseName.trim() !== '' || courseDescription.trim() !== ''
    })

  return sortTourCoursesForCustomerDisplay(validCourses, tourCourses)
}

export function groupCoursesByParent(
  validCourses: TourCourse[],
  tourCourses: ProductTourCourse[] = []
): Map<string, TourCourse[]> {
  const validCourseIds = new Set(validCourses.map((course) => course.id))
  const groupedCourses = new Map<string, TourCourse[]>()
  validCourses.forEach((course) => {
    const parentId = getNearestValidParentId(course, validCourseIds, tourCourses)
    if (!groupedCourses.has(parentId)) {
      groupedCourses.set(parentId, [])
    }
    groupedCourses.get(parentId)!.push(course)
  })
  return groupedCourses
}

export function getCourseGroupHeader(
  parentId: string,
  tourCourses: ProductTourCourse[],
  localeOrIsEnglish: string | boolean
): string {
  if (parentId === 'root') return ''

  const parentCourse = tourCourses.find((ptc) => ptc.tour_course?.id === parentId)?.tour_course
  if (!parentCourse || isExcludedCustomerTourCourse(parentCourse)) return ''

  const parentName = getCourseDisplayName(parentCourse, localeOrIsEnglish)

  if (parentCourse.parent_id) {
    const grandParent = tourCourses.find((ptc) => ptc.tour_course?.id === parentCourse.parent_id)?.tour_course
    if (grandParent) {
      const grandParentName = getCourseDisplayName(grandParent, localeOrIsEnglish)
      if (grandParentName.trim() && !isExcludedCustomerTourCourse(grandParent)) {
        return `${grandParentName} > ${parentName}`
      }
    }
  }

  return parentName
}
