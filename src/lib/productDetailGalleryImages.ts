import type { ProductMedia, TourCoursePhoto } from '@/components/product/productDetailTypes'

export type GalleryImage = {
  id: string
  file_url: string
  alt_text: string
  file_name: string
}

export function buildProductGalleryImages(
  productMedia: ProductMedia[],
  tourCoursePhotos: TourCoursePhoto[]
): GalleryImage[] {
  const mediaImages = productMedia
    .filter((item) => item.file_type === 'image')
    .map((item) => ({
      id: item.id,
      file_url: item.file_url,
      alt_text: item.alt_text || item.file_name,
      file_name: item.file_name,
    }))

  const tourCourseImages = tourCoursePhotos.map((photo) => ({
    id: `tour-course-${photo.id}`,
    file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.photo_url}`,
    alt_text: photo.photo_alt_ko || photo.photo_alt_en || 'Tour course photo',
    file_name: photo.photo_url,
  }))

  return [...mediaImages, ...tourCourseImages]
}
