export type TourCoursePhotoLike = {
  photo_url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export function sortTourCoursePhotos<T extends TourCoursePhotoLike>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order || 0) - (b.sort_order || 0)
  })
}

export function getPrimaryTourCoursePhoto<T extends TourCoursePhotoLike>(
  photos: T[] | null | undefined
): T | null {
  if (!photos?.length) return null
  const sorted = sortTourCoursePhotos(photos)
  return sorted.find((photo) => photo.is_primary) || sorted[0] || null
}

export function getTourCoursePhotoPublicUrl(
  photo?: TourCoursePhotoLike | null
): string | null {
  const path = photo?.photo_url || photo?.thumbnail_url || null
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return path
  return `${base}/storage/v1/object/public/tour-course-photos/${path}`
}
