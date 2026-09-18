import { supabase } from '@/lib/supabase'
import { expandDbKeyCandidates, type CourseForMainStops } from '@/lib/tourReportMainStops'
import { selectGuidePhotoStops, type GuidePhotoStop } from '@/lib/guidePhotoStopCoverage'

type CourseWithCoords = CourseForMainStops & {
  start_latitude?: number | null
  start_longitude?: number | null
}

const COURSE_SELECT =
  'id, parent_id, name_ko, name_en, customer_name_ko, customer_name_en, category, category_id, path, sort_order, start_latitude, start_longitude, tour_course_categories(name_ko, name_en)'

export async function loadGuidePhotoStopsForProduct(
  productId: string | null | undefined,
  locale: string
): Promise<GuidePhotoStop[]> {
  const pid = (productId || '').trim()
  if (!pid) return []

  for (const cand of expandDbKeyCandidates(pid)) {
    const { data, error } = await supabase
      .from('product_tour_courses')
      .select(`tour_course_id, tour_courses(${COURSE_SELECT})`)
      .eq('product_id', cand)
      .order('order', { ascending: true })
    if (error || !data) continue
    const courses: CourseWithCoords[] = []
    for (const row of data) {
      const raw = (row as { tour_courses?: CourseWithCoords | CourseWithCoords[] | null }).tour_courses
      const course = Array.isArray(raw) ? raw[0] : raw
      if (course?.id) courses.push(course)
    }
    if (courses.length > 0) return selectGuidePhotoStops(courses, locale)
  }
  return []
}
