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
        <section className="gyg-section gyg-section--cta">
          <div className="gyg-container">
            <div className="gyg-cta-split">
              <div>
                <h2 className="gyg-cta-title">{t('startYourJourney')}</h2>
                <p className="gyg-cta-subtitle">{t('contactUs')}</p>
              </div>
              <div className="gyg-cta-actions">
                <Link href={`/${locale}/products`} className="gyg-cta-btn gyg-cta-btn--primary">
                  {t('browseTours')}
                </Link>
                <a href="mailto:info@maniatour.com" className="gyg-cta-btn gyg-cta-btn--secondary">
                  {t('contact')}
                </a>
              </div>
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'inline-minimal') {
    return (
      <CustomerPageZone zone="home-cta">
        <section className="gyg-section gyg-section--cta-inline">
          <div className="gyg-container">
            <div className="gyg-cta-inline">
              <h2 className="gyg-cta-title gyg-cta-title--sm">{t('startYourJourney')}</h2>
              <Link href={`/${locale}/products`} className="gyg-cta-btn gyg-cta-btn--primary">
                {t('browseTours')}
              </Link>
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-cta">
      <section className="gyg-section gyg-section--cta-band">
        <div className="gyg-container">
          <div className="gyg-cta-band">
            <h2 className="gyg-cta-title">{t('startYourJourney')}</h2>
            <p className="gyg-cta-subtitle">{t('contactUs')}</p>
            <div className="gyg-cta-actions gyg-cta-actions--center">
              <Link href={`/${locale}/products`} className="gyg-cta-btn gyg-cta-btn--primary">
                {t('browseTours')}
              </Link>
              <a href="mailto:info@maniatour.com" className="gyg-cta-btn gyg-cta-btn--ghost">
                {t('contact')}
              </a>
            </div>
          </div>
        </div>
      </section>
    </CustomerPageZone>
  )
}
