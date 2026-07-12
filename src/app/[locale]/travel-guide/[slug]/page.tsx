'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import TravelGuideArticleView from '@/components/travel-guide/TravelGuideArticleView'

export default function TravelGuideArticlePage() {
  const locale = useLocale()
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const t = useTranslations('common')

  return <TravelGuideArticleView locale={locale} slug={slug} t={t} />
}
