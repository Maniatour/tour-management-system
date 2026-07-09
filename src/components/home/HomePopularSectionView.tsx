'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomePopularToursBlock, { type PopularToursBlockProps } from '@/components/home/HomePopularToursBlock'

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
  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mb-8 ${variant === 'stacked-list' ? 'text-left' : 'text-center'}`}>
          <h2 className="text-2xl sm:text-4xl font-bold mb-2">
            {titleOverride ?? t('popularTours')}
          </h2>
          {!titleOverride && <p className="cp-ui-muted">{t('popularToursDesc')}</p>}
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
