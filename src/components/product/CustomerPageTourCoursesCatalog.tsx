'use client'

import TourCoursesLibraryWorkspace from '@/components/tour-courses/TourCoursesLibraryWorkspace'

type CustomerPageTourCoursesCatalogProps = {
  locale: string
  onSaved?: () => void
}

export default function CustomerPageTourCoursesCatalog({
  locale,
  onSaved,
}: CustomerPageTourCoursesCatalogProps) {
  return (
    <TourCoursesLibraryWorkspace
      compact
      locale={locale}
      {...(onSaved ? { onSaved } : {})}
    />
  )
}
