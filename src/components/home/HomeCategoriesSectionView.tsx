'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { CategoriesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { CategoryTagItem } from '@/components/home/homeSectionTypes'

type Props = {
  variant: CategoriesStructureVariant
  locale: string
  t: (key: string) => string
  categoryTags: CategoryTagItem[]
}

export default function HomeCategoriesSectionView({ variant, locale, t, categoryTags }: Props) {
  const footer = (
    <div className="text-center mt-8">
      <Link href={`/${locale}/products/tags`} className="cp-ui-btn-outline inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-medium">
        🏷️ {t('viewAllTags')}<ArrowRight className="ml-2" size={18} />
      </Link>
    </div>
  )

  if (variant === 'horizontal-scroll') {
    return (
      <CustomerPageZone zone="home-categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">{t('findToursByCategory')}</h2>
          <div className="cp-home-scroll-row flex gap-4 pb-2">
            {categoryTags.map((c) => (
              <Link key={c.labelKey} href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`} className={`shrink-0 min-w-[150px] p-5 rounded-2xl bg-gradient-to-br ${c.gradient} text-center hover:shadow-lg`}>
                <div className="text-3xl mb-2">{c.emoji}</div>
                <div className="text-sm font-semibold">{t(c.labelKey)}</div>
              </Link>
            ))}
          </div>
          {footer}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'large-tiles') {
    return (
      <CustomerPageZone zone="home-categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">{t('findToursByCategory')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categoryTags.map((c) => (
              <Link key={c.labelKey} href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`} className={`aspect-[4/3] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} hover:scale-[1.02] hover:shadow-xl transition-all`}>
                <span className="text-4xl mb-2">{c.emoji}</span>
                <span className="font-bold text-sm">{t(c.labelKey)}</span>
              </Link>
            ))}
          </div>
          {footer}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-pills') {
    return (
      <CustomerPageZone zone="home-categories">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold mb-4">{t('findToursByCategory')}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {categoryTags.map((c) => (
              <Link key={c.labelKey} href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-white hover:shadow-md text-sm font-medium">
                {c.emoji} {t(c.labelKey)}
              </Link>
            ))}
          </div>
          {footer}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'bento-asymmetric') {
    return (
      <CustomerPageZone zone="home-categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">{t('findToursByCategory')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[130px]">
            {categoryTags.map((c, i) => (
              <Link key={c.labelKey} href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`} className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} hover:shadow-lg ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:col-span-2' : ''}`}>
                <span className={i === 0 ? 'text-5xl mb-2' : 'text-3xl mb-1'}>{c.emoji}</span>
                <span className="text-xs font-semibold text-center px-2">{t(c.labelKey)}</span>
              </Link>
            ))}
          </div>
          {footer}
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-categories">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-4xl font-bold mb-3">{t('findToursByCategory')}</h2>
          <p className="cp-ui-muted">{t('findToursByCategoryDesc')}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categoryTags.map((c) => (
            <Link key={c.labelKey} href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`} className={`flex flex-col items-center p-4 rounded-xl bg-gradient-to-br ${c.gradient} hover:scale-105 hover:shadow-lg transition-all ${c.hoverGradient}`}>
              <div className="text-3xl mb-2">{c.emoji}</div>
              <h3 className="text-xs font-semibold text-center">{t(c.labelKey)}</h3>
            </Link>
          ))}
        </div>
        {footer}
      </div>
    </CustomerPageZone>
  )
}
