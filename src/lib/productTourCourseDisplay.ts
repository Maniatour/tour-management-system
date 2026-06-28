import type { ProductTourCourse, TourCourse } from '@/components/product/productDetailTypes'

export function getCourseDisplayName(course: TourCourse, isEnglish: boolean): string {
  return isEnglish
    ? (course.customer_name_en || course.customer_name_ko || course.name_en || course.name_ko || '')
    : (course.customer_name_ko || course.customer_name_en || course.name_ko || course.name_en || '')
}

export function getCourseDescription(course: TourCourse, isEnglish: boolean): string {
  return isEnglish
    ? (course.customer_description_en || course.customer_description_ko || '')
    : (course.customer_description_ko || course.customer_description_en || '')
}

export function getFullCoursePath(
  course: TourCourse,
  tourCourses: ProductTourCourse[],
  isEnglish: boolean
): string {
  const path: string[] = []
  let current: TourCourse | undefined = course
  const visited = new Set<string>()

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const courseName = getCourseDisplayName(current, isEnglish)

    if (courseName.trim()) {
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

export function getValidTourCourses(tourCourses: ProductTourCourse[], isEnglish: boolean): TourCourse[] {
  return tourCourses
    .map((ptc) => ptc.tour_course)
    .filter((course): course is TourCourse => {
      if (!course) return false
      const courseName = getCourseDisplayName(course, isEnglish)
      const courseDescription = getCourseDescription(course, isEnglish)
      return courseName.trim() !== '' || courseDescription.trim() !== ''
    })
}

export function groupCoursesByParent(validCourses: TourCourse[]): Map<string, TourCourse[]> {
  const groupedCourses = new Map<string, TourCourse[]>()
  validCourses.forEach((course) => {
    const parentId = course.parent_id || 'root'
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
  isEnglish: boolean
): string {
  if (parentId === 'root') return ''

  const parentCourse = tourCourses.find((ptc) => ptc.tour_course?.id === parentId)?.tour_course
  if (!parentCourse) return ''

  const parentName = getCourseDisplayName(parentCourse, isEnglish)

  if (parentCourse.parent_id) {
    const grandParent = tourCourses.find((ptc) => ptc.tour_course?.id === parentCourse.parent_id)?.tour_course
    if (grandParent) {
      const grandParentName = getCourseDisplayName(grandParent, isEnglish)
      if (grandParentName.trim()) {
        return `${grandParentName} > ${parentName}`
      }
    }
  }

  return parentName
}
