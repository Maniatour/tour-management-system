import type { ProductTourCourse, TourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'
import type { ReportStopRole } from '@/lib/tourReportStopRoles'

export type TourCourseAdminPhoto = TourCoursePhoto & {
  uploaded_by?: string | null
  created_at?: string | null
}

export type TourCourseAdminRow = {
  id: string
  name_ko: string | null
  name_en: string | null
  team_name_ko?: string | null
  team_name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
  customer_description_ko?: string | null
  customer_description_en?: string | null
  content_i18n?: TourCourse['content_i18n']
  location?: string | null
  category?: string | null
  parent_id?: string | null
  point_name?: string | null
  sort_order?: number | null
  is_active?: boolean | null
  is_favorite?: boolean | null
  favorite_order?: number | null
  difficulty_level?: 'easy' | 'medium' | 'hard' | null
  duration_hours?: number | null
  photos?: TourCourseAdminPhoto[] | null
  [key: string]: unknown
}

export function emptyTourCourseDraft(): TourCourseAdminRow {
  return {
    id: '',
    name_ko: '',
    name_en: '',
    team_name_ko: '',
    team_name_en: '',
    customer_name_ko: '',
    customer_name_en: '',
    is_active: true,
    duration_hours: 0,
    difficulty_level: 'easy',
    photos: [],
  }
}

export function copyTourCourseDraft(
  course: TourCourseAdminRow,
  suffix: string
): TourCourseAdminRow {
  const nameKo = course.team_name_ko || course.name_ko || ''
  const nameEn = course.team_name_en || course.name_en || ''
  return {
    ...course,
    id: '',
    name_ko: nameKo ? `${nameKo} ${suffix}` : suffix,
    name_en: nameEn ? `${nameEn} ${suffix}` : suffix,
    team_name_ko: nameKo ? `${nameKo} ${suffix}` : suffix,
    team_name_en: nameEn ? `${nameEn} ${suffix}` : suffix,
    photos: [],
  }
}

export function toDisplayTourCourse(row: TourCourseAdminRow): TourCourse {
  return {
    id: row.id,
    name: String(row.team_name_ko || row.name_ko || row.customer_name_ko || ''),
    name_ko: row.team_name_ko || row.name_ko || row.customer_name_ko || null,
    name_en: row.team_name_en || row.name_en || row.customer_name_en || null,
    customer_name_ko: row.customer_name_ko ?? null,
    customer_name_en: row.customer_name_en ?? null,
    customer_description_ko: row.customer_description_ko ?? null,
    customer_description_en: row.customer_description_en ?? null,
    content_i18n: row.content_i18n ?? null,
    description: row.customer_description_ko ?? null,
    duration: null,
    duration_hours: row.duration_hours ?? null,
    difficulty: row.difficulty_level ?? null,
    difficulty_level: row.difficulty_level ?? null,
    highlights: null,
    itinerary: null,
    location: row.location ?? null,
    category: row.category ?? null,
    level: typeof row.level === 'number' ? row.level : null,
    path: typeof row.path === 'string' ? row.path : null,
    parent_id: row.parent_id ?? null,
    point_name: row.point_name ?? null,
    sort_order: row.sort_order ?? null,
    min_participants: null,
    max_participants: null,
    photos: (row.photos ?? []).map((photo) => ({
      id: photo.id,
      course_id: photo.course_id,
      photo_url: photo.photo_url,
      photo_alt_ko: photo.photo_alt_ko,
      photo_alt_en: photo.photo_alt_en,
      display_order: photo.display_order,
      is_primary: photo.is_primary,
      sort_order: photo.sort_order,
      thumbnail_url: photo.thumbnail_url,
    })),
  }
}

export function toProductTourCourseBridge(
  courses: TourCourse[],
  options?: {
    productId?: string
    roles?: Record<string, ReportStopRole>
  }
): ProductTourCourse[] {
  return courses.map((course) => {
    const role = options?.roles?.[course.id]
    return {
      id: course.id,
      product_id: options?.productId ?? '',
      tour_course_id: course.id,
      tour_course: course,
      report_stop_role: role === 'required' || role === 'alternate' ? role : null,
    }
  })
}

export function moveIdInList(order: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return order
  const next = [...order]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return order
  next.splice(toIndex, 0, moved)
  return next
}

export function moveIdAmongSubset(
  fullOrder: string[],
  subsetIds: Set<string>,
  fromSubsetIndex: number,
  toSubsetIndex: number
): string[] {
  const subset = fullOrder.filter((id) => subsetIds.has(id))
  const nextSubset = moveIdInList(subset, fromSubsetIndex, toSubsetIndex)
  let index = 0
  return fullOrder.map((id) => (subsetIds.has(id) ? nextSubset[index++] ?? id : id))
}

export function matchesTourCourseSearch(row: TourCourseAdminRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    row.team_name_ko,
    row.team_name_en,
    row.customer_name_ko,
    row.customer_name_en,
    row.name_ko,
    row.name_en,
    row.location,
    row.category,
    row.point_name,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}
