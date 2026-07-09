'use client'

import Link from 'next/link'
import CustomerPageZone from '@/components/product/CustomerPageZone'

export type PromoStructureVariant = 'full-band' | 'split-cta' | 'countdown-style'

export default function HomePromoSectionView({
  variant,
  t,
  locale,
  zoneId,
  titleOverride,
}: {
  variant: PromoStructureVariant
  t: (key: string) => string
  locale: string
  zoneId: string
  titleOverride?: string
}) {
  const title = titleOverride?.trim() || t('promoTitle')
  const cta = (
    <Link href={`/${locale}/products`} className="cp-ui-btn-primary px-6 py-3 rounded-xl font-semibold inline-flex">
      {t('promoCta')}
    </Link>
  )

  if (variant === 'split-cta') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="cp-ui-card-surface rounded-2xl border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm cp-ui-muted mt-1">{t('promoDesc')}</p>
            </div>
            {cta}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'countdown-style') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="cp-home-cta-band rounded-2xl p-8 text-center">
            <p className="text-xs uppercase tracking-widest opacity-80 mb-2">{t('promoLimited')}</p>
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="cp-ui-muted mb-4">{t('promoDesc')}</p>
            <div className="flex justify-center gap-3 mb-6 text-sm font-mono">
              {['12', '08', '45'].map((n, i) => (
                <span key={i} className="rounded-lg bg-black/10 px-3 py-2 min-w-[3rem]">
                  {n}
                </span>
              ))}
            </div>
            {cta}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="cp-home-cta-band rounded-3xl px-8 py-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h2>
          <p className="cp-ui-muted mb-6">{t('promoDesc')}</p>
          {cta}
        </div>
      </div>
    </CustomerPageZone>
  )
}
