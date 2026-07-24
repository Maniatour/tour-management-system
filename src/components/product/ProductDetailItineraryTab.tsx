'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import type { ProductTourCourse, TourCourse, TourCoursePhoto } from '@/components/product/productDetailTypes'
import {
  getCourseDescription,
  getFullCoursePath,
  getValidTourCourses,
} from '@/lib/productTourCourseDisplay'

type ProductDetailItineraryTabProps = {
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  /** Site locale code, or legacy boolean (true = en) */
  locale?: string
  /** @deprecated Prefer locale */
  isEnglish?: boolean
}

type TourCourseItemProps = {
  course: TourCourse
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  displayLocale: string
}

function TourCourseItem({
  course,
  tourCourses,
  tourCoursePhotos,
  displayLocale,
}: TourCourseItemProps) {
  const t = useTranslations('productDetail')
  const tCommon = useTranslations('common')
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const fullCourseName = getFullCoursePath(course, tourCourses, displayLocale)
  const courseDescription = getCourseDescription(course, displayLocale)
  const hasDescription = Boolean(courseDescription?.trim())

  const coursePhotos = (
    course.photos ||
    tourCoursePhotos.filter((photo) => photo.course_id === course.id)
  ).sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order || 0) - (b.sort_order || 0)
  })

  const primaryPhoto = coursePhotos.find((photo) => photo.is_primary) || coursePhotos[0]
  const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null

  let fullPhotoUrl = photoUrl
  if (photoUrl && !photoUrl.startsWith('http')) {
    fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
  }

  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {fullPhotoUrl ? (
          <div className="w-full shrink-0 sm:w-40 lg:w-48">
            <img
              src={fullPhotoUrl}
              alt={fullCourseName || t('courseImageAlt')}
              className="h-40 w-full rounded-lg object-cover sm:h-32"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {fullCourseName.trim() !== '' ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold text-gray-900 sm:mb-2 sm:text-base">
                {fullCourseName}
              </div>
              {hasDescription ? (
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-booking underline underline-offset-2 sm:hidden"
                  onClick={() => setMobileExpanded((current) => !current)}
                  aria-expanded={mobileExpanded}
                >
                  {mobileExpanded ? tCommon('less') : tCommon('more')}
                </button>
              ) : null}
            </div>
          ) : null}
          {hasDescription ? (
            <div
              className={`text-xs leading-relaxed text-gray-700 sm:mt-0 sm:block sm:text-sm ${
                mobileExpanded ? 'mt-1.5 block' : 'hidden'
              }`}
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(courseDescription),
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailItineraryTab({
  tourCourses,
  tourCoursePhotos,
  locale,
  isEnglish = false,
}: ProductDetailItineraryTabProps) {
  const t = useTranslations('productDetail')
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
              <TourCourseItem
                key={course.id}
                course={course}
                tourCourses={tourCourses}
                tourCoursePhotos={tourCoursePhotos}
                displayLocale={displayLocale}
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
