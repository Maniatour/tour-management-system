'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomePopularToursBlock, { type PopularToursBlockProps } from '@/components/home/HomePopularToursBlock'
import HomeManiaTourSectionHeader, {
  HomeManiaTourSectionViewAllFooter,
} from '@/components/home/HomeManiaTourSectionHeader'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'

export default function HomePopularSectionView({
  locale,
  t,
  variant,
  popularProps,
  zoneId = 'home-popular',
}: {
  locale: string
  t: (key: string) => string
  variant: PopularToursBlockProps['variant']
  popularProps: Omit<PopularToursBlockProps, 'variant' | 'locale' | 't'>
  zoneId?: string
}) {
  const isManiaTour = variant === 'maniatour-carousel'
  const gygVariant: PopularStructureVariant =
    variant === 'activity-cards' ? 'activity-cards' : variant === 'maniatour-carousel' ? 'maniatour-carousel' : 'attraction-cards'

  if (isManiaTour) {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section">
          <div className="kv-container">
            <HomeManiaTourSectionHeader
              title={t('homePopularToursTitle')}
              viewAllHref={`/${locale}/products`}
              viewAllLabel={t('homeViewAllTours')}
            />
            <HomePopularToursBlock
              variant={gygVariant}
              locale={locale}
              t={t}
              {...popularProps}
            />
            <HomeManiaTourSectionViewAllFooter
              href={`/${locale}/products`}
              label={t('homeViewAllTours')}
            />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  const title =
    gygVariant === 'activity-cards' ? t('homeActivitiesTitle') : t('homeAttractionsTitle')

  return (
    <CustomerPageZone zone={zoneId}>
      <section className="gyg-section">
        <div className="gyg-container">
          <h2 className="gyg-section-title">{title}</h2>
          <HomePopularToursBlock variant={gygVariant} locale={locale} t={t} {...popularProps} />
        </div>
      </section>
    </CustomerPageZone>
  )
}
