'use client'

import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import type { ProductTourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'
import {
  getCourseDescription,
  getFullCoursePath,
  getValidTourCourses,
} from '@/lib/productTourCourseDisplay'

type ProductDetailItineraryTabProps = {
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  isEnglish: boolean
}

export default function ProductDetailItineraryTab({
  tourCourses,
  tourCoursePhotos,
  isEnglish,
}: ProductDetailItineraryTabProps) {
  const t = useTranslations('productDetail')

  const validCourses = getValidTourCourses(tourCourses, isEnglish)

  const courseElements: JSX.Element[] = []
  validCourses.forEach((course) => {
    const fullCourseName = getFullCoursePath(course, tourCourses, isEnglish)
      const courseDescription = getCourseDescription(course, isEnglish)

      const coursePhotos = (course.photos || tourCoursePhotos.filter((p) => p.course_id === course.id))
        .sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.sort_order || 0) - (b.sort_order || 0)
        })

      const primaryPhoto = coursePhotos.find((p) => p.is_primary) || coursePhotos[0]
      const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null

      let fullPhotoUrl = photoUrl
      if (photoUrl && !photoUrl.startsWith('http')) {
        fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
      }

      courseElements.push(
        <div key={course.id} className="border-b border-slate-100 py-4 last:border-b-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            {fullPhotoUrl && (
              <div className="w-full shrink-0 sm:w-40 lg:w-48">
                <img
                  src={fullPhotoUrl}
                  alt={fullCourseName || t('courseImageAlt')}
                  className="h-40 w-full rounded-lg object-cover sm:h-32"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {fullCourseName.trim() !== '' && (
                <div className="mb-1.5 text-sm font-semibold text-gray-900 sm:mb-2 sm:text-base">
                  {fullCourseName}
                </div>
              )}
              {courseDescription && courseDescription.trim() !== '' && (
                <div
                  className="text-xs leading-relaxed text-gray-700 sm:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(courseDescription),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )
  })

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold sm:mb-4 sm:text-xl">
        <MapPin className="h-4 w-4 shrink-0 text-booking sm:h-5 sm:w-5" aria-hidden />
        {t('tourCourseDescription')}
      </h2>
      <div>
        {tourCourses.length > 0 ? (
          validCourses.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500 sm:text-sm">
              {t('noTourCourseInfo')}
            </p>
          ) : (
            courseElements
          )
        ) : (
          <p className="py-6 text-center text-xs text-gray-500 sm:text-sm">
            {t('noTourCourseInfo')}
          </p>
        )}
      </div>
    </div>
  )
}
