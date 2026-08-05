'use client'

import { useParams } from 'next/navigation'
import GuideReviewsSection from '@/components/guide/GuideReviewsSection'

export default function GuideReviewsPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'ko'

  return (
    <div className="w-full min-h-full bg-white">
      <GuideReviewsSection locale={locale === 'en' ? 'en' : 'ko'} />
    </div>
  )
}
