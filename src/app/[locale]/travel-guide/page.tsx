'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import TravelGuideListingView from '@/components/travel-guide/TravelGuideListingView'

export default function TravelGuidePage() {
  const locale = useLocale()
  const t = useTranslations('common')

  return <TravelGuideListingView locale={locale} t={t} />
}
