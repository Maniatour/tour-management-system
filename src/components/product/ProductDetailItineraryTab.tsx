'use client'

import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import type { ProductTourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'
import {
  getCourseDescription,
  getCourseGroupHeader,
  getFullCoursePath,
  getValidTourCourses,
  groupCoursesByParent,
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
  const groupedCourses = groupCoursesByParent(validCourses)

  const courseElements: JSX.Element[] = []
  groupedCourses.forEach((courses, parentId) => {
    const groupHeader = getCourseGroupHeader(parentId, tourCourses, isEnglish)

    if (groupHeader && courses.length > 0) {
      courseElements.push(
        <div key={`group-${parentId}`} className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="font-semibold text-gray-900">{groupHeader}</div>
        </div>
      )
    }

    courses.forEach((course) => {
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
        <div key={course.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex gap-4 items-start">
            {fullPhotoUrl && (
              <div className="flex-shrink-0 w-48">
                <img
                  src={fullPhotoUrl}
                  alt={fullCourseName || t('courseImageAlt')}
                  className="w-full h-36 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {fullCourseName.trim() !== '' && (
                <div className="font-semibold text-gray-900 mb-2">
                  {fullCourseName}
                </div>
              )}
              {courseDescription && courseDescription.trim() !== '' && (
                <div
                  className="text-sm text-gray-700 whitespace-pre-wrap"
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
  })

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {t('tourCourseDescription')}
        </h2>
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
          {tourCourses.length > 0 ? (
            validCourses.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {t('noTourCourseInfo')}
              </p>
            ) : (
              courseElements
            )
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              {t('noTourCourseInfo')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
