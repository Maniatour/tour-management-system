'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeManiaTourSectionHeader from '@/components/home/HomeManiaTourSectionHeader'
import type { FeaturesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { FeatureItem } from '@/components/home/homeSectionTypes'
import { MANIATOUR_FEATURE_ITEMS } from '@/lib/maniatourHomeData'

export default function HomeFeaturesSectionView({
  variant,
  t,
  features,
}: {
  variant: FeaturesStructureVariant
  t: (key: string) => string
  features: FeatureItem[]
}) {
  if (variant === 'maniatour-trust-six') {
    return (
      <CustomerPageZone zone="home-features">
        <section className="kv-section kv-section--muted">
          <div className="kv-container">
            <HomeManiaTourSectionHeader title={t('homeWhyManiaTourTitle')} />
            <div className="kv-features-grid">
              {MANIATOUR_FEATURE_ITEMS.map((feature) => {
                const Icon = feature.icon
                return (
                  <div key={feature.titleKey} className="kv-feature-item">
                    <div className="kv-feature-icon-wrap">
                      <Icon className="kv-feature-icon" aria-hidden />
                    </div>
                    <h3 className="kv-feature-title">{t(feature.titleKey)}</h3>
                    <p className="kv-feature-desc">{t(feature.descKey)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-features">
      <section className="gyg-section gyg-section--muted">
        <div className="gyg-container">
          <div className="gyg-features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="gyg-feature-item">
                  <div className="gyg-feature-icon-wrap">
                    <Icon className="gyg-feature-icon" aria-hidden />
                  </div>
                  <h3 className="gyg-feature-title">{feature.title}</h3>
                  <p className="gyg-feature-desc">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </CustomerPageZone>
  )
}
