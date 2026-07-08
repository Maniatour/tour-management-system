import { supabase } from '@/lib/supabase'

/** 상품 대표 이미지 URL (없으면 null). 0건일 때 406이 나지 않도록 maybeSingle 사용 */
export async function fetchProductPrimaryImage(productId: string): Promise<string | null> {
  const { data: primaryMedia } = await supabase
    .from('product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .eq('is_primary', true)
    .maybeSingle()

  if (primaryMedia && 'file_url' in primaryMedia && primaryMedia.file_url) {
    return primaryMedia.file_url as string
  }

  const { data: firstMedia } = await supabase
    .from('product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstMedia && 'file_url' in firstMedia && firstMedia.file_url) {
    return firstMedia.file_url as string
  }

  const { data: tourCoursesData } = await supabase
    .from('product_tour_courses')
    .select('tour_course:tour_courses(id)')
    .eq('product_id', productId)

  if (!tourCoursesData?.length) return null

  const courseIds = tourCoursesData
    .map((tc) => (tc as { tour_course?: { id: string } }).tour_course?.id)
    .filter((id): id is string => id != null)

  if (courseIds.length === 0) return null

  const { data: photoData } = await supabase
    .from('tour_course_photos')
    .select('photo_url')
    .in('course_id', courseIds)
    .eq('is_primary', true)
    .maybeSingle()

  if (photoData && 'photo_url' in photoData && photoData.photo_url) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoData.photo_url}`
  }

  const { data: firstPhotoData } = await supabase
    .from('tour_course_photos')
    .select('photo_url')
    .in('course_id', courseIds)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstPhotoData && 'photo_url' in firstPhotoData && firstPhotoData.photo_url) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${firstPhotoData.photo_url}`
  }

  return null
}
