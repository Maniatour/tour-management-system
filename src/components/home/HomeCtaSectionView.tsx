'use client'

import Link from 'next/link'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { CtaStructureVariant } from '@/lib/customerPageHomeStructure'

export default function HomeCtaSectionView({
  variant,
  locale,
  t,
}: {
  variant: CtaStructureVariant
  locale: string
  t: (key: string) => string
}) {
  if (variant === 'split-actions') {
    return (
      <CustomerPageZone zone="home-cta">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 cp-ui-card-surface rounded-2xl border p-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('startYourJourney')}</h2>
              <p className="cp-ui-muted">{t('contactUs')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={`/${locale}/products`} className="cp-ui-btn-primary px-6 py-3 rounded-xl font-semibold text-center">{t('browseTours')}</Link>
              <a href="mailto:info@maniatour.com" className="cp-ui-btn-outline px-6 py-3 rounded-xl font-semibold text-center border-2">{t('contact')}</a>
            </div>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'full-band') {
    return (
      <CustomerPageZone zone="home-cta">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="cp-home-cta-band rounded-3xl p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">{t('startYourJourney')}</h2>
            <p className="cp-ui-muted mb-6">{t('contactUs')}</p>
            <Link href={`/${locale}/products`} className="cp-ui-btn-primary inline-flex px-8 py-4 rounded-xl font-semibold">{t('browseTours')}</Link>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'inline-minimal') {
    return (
      <CustomerPageZone zone="home-cta">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t">
          <h2 className="text-xl font-bold">{t('startYourJourney')}</h2>
          <Link href={`/${locale}/products`} className="cp-ui-btn-primary px-6 py-3 rounded-xl font-semibold text-center">{t('browseTours')}</Link>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-cta">
      <div className="max-w-7xl mx-auto px-4 text-center py-6">
        <h2 className="text-2xl sm:text-4xl font-bold mb-3">{t('startYourJourney')}</h2>
        <p className="cp-ui-muted mb-6">{t('contactUs')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/${locale}/products`} className="cp-ui-btn-primary px-8 py-3 rounded-xl font-semibold">{t('browseTours')}</Link>
          <a href="mailto:info@maniatour.com" className="cp-ui-btn-outline border-2 px-8 py-3 rounded-xl font-semibold">{t('contact')}</a>
        </div>
      </div>
    </CustomerPageZone>
  )
}
