'use client'

import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProductTourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'
import TourCourseStopCard from '@/components/tour-courses/TourCourseStopCard'
import {
  getCourseDescription,
  getFullCoursePath,
  getValidTourCourses,
} from '@/lib/productTourCourseDisplay'

type ProductDetailItineraryTabProps = {
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  locale?: string
  isEnglish?: boolean
}

export default function ProductDetailItineraryTab({
  tourCourses,
  tourCoursePhotos,
  locale,
  isEnglish = false,
}: ProductDetailItineraryTabProps) {
  const t = useTranslations('productDetail')
  const tCommon = useTranslations('common')
  const displayLocale = locale ?? (isEnglish ? 'en' : 'ko')
  const validCourses = getValidTourCourses(tourCourses, displayLocale)

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
            validCourses.map((course) => (
              <TourCourseStopCard
                key={course.id}
                course={course}
                title={getFullCoursePath(course, tourCourses, displayLocale)}
                description={getCourseDescription(course, displayLocale)}
                photos={
                  course.photos ||
                  tourCoursePhotos.filter((photo) => photo.course_id === course.id)
                }
                imageAlt={t('courseImageAlt')}
                moreLabel={tCommon('more')}
                lessLabel={tCommon('less')}
              />
            ))
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
