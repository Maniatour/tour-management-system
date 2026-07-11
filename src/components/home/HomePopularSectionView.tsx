'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomePopularToursBlock, { type PopularToursBlockProps } from '@/components/home/HomePopularToursBlock'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'

function getDefaultTitle(
  variant: PopularStructureVariant,
  t: (key: string) => string
): string {
  if (variant === 'attraction-cards') return t('homeAttractionsTitle')
  if (variant === 'activity-cards') return t('homeActivitiesTitle')
  return t('popularTours')
}

export default function HomePopularSectionView({
  locale,
  t,
  variant,
  popularProps,
  titleOverride,
  zoneId = 'home-popular',
}: {
  locale: string
  t: (key: string) => string
  variant: PopularToursBlockProps['variant']
  popularProps: Omit<PopularToursBlockProps, 'variant' | 'locale' | 't'>
  titleOverride?: string
  zoneId?: string
}) {
  const isCarouselVariant = variant === 'attraction-cards' || variant === 'activity-cards'
  const title = titleOverride ?? getDefaultTitle(variant, t)

  if (isCarouselVariant) {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section">
          <div className="gyg-container">
            <h2 className="gyg-section-title">{title}</h2>
            <HomePopularToursBlock variant={variant} locale={locale} t={t} {...popularProps} />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className={`mb-6 md:mb-8 ${variant === 'stacked-list' ? 'text-left' : 'text-center'}`}>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
          {!titleOverride && <p className="cp-ui-muted mt-2">{t('popularToursDesc')}</p>}
        </div>
        <HomePopularToursBlock variant={variant} locale={locale} t={t} {...popularProps} />
        <div className="text-center mt-10">
          <Link href={`/${locale}/products`} className="cp-ui-btn-outline inline-flex items-center px-6 py-3 rounded-xl font-medium">
            {t('viewAllTours')}<ArrowRight className="ml-2" size={20} />
          </Link>
        </div>
      </div>
    </CustomerPageZone>
  )
}
