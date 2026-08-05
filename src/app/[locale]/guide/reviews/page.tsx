'use client'

import { useParams } from 'next/navigation'
import GuideReviewsSection from '@/components/guide/GuideReviewsSection'

export default function GuideReviewsPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'ko'

  return (
    <div className="pb-0 lg:pb-4">
      <GuideReviewsSection locale={locale === 'en' ? 'en' : 'ko'} />
    </div>
  )
}
