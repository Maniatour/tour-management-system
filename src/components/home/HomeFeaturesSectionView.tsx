'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { FeaturesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { FeatureItem } from '@/components/home/homeSectionTypes'

export default function HomeFeaturesSectionView({
  variant,
  t,
  features,
}: {
  variant: FeaturesStructureVariant
  t: (key: string) => string
  features: FeatureItem[]
}) {
  if (variant === 'card-grid-four') {
    return (
      <CustomerPageZone zone="home-features">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">{t('whyChooseUs')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="cp-ui-card-surface rounded-2xl border p-5 text-center">
                  <Icon className="h-8 w-8 cp-ui-icon-accent mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-xs cp-ui-muted">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'alternating-rows') {
    return (
      <CustomerPageZone zone="home-features">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <h2 className="text-2xl font-bold text-center">{t('whyChooseUs')}</h2>
          {features.map((f, i) => {
            const Icon = f.icon
            const rev = i % 2 === 1
            return (
              <div key={i} className={`flex flex-col ${rev ? 'md:flex-row-reverse' : 'md:flex-row'} gap-4 items-center border rounded-2xl p-6 cp-ui-card-surface`}>
                <Icon className="h-10 w-10 cp-ui-icon-accent shrink-0" />
                <div className={rev ? 'md:text-right' : ''}>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm cp-ui-muted">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'icon-row') {
    return (
      <CustomerPageZone zone="home-features">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i}>
                <Icon className="h-7 w-7 cp-ui-icon-accent mx-auto mb-2" />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-xs cp-ui-muted line-clamp-2">{f.description}</p>
              </div>
            )
          })}
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-features">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl sm:text-4xl font-bold text-center mb-8">{t('whyChooseUs')}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} className="flex gap-3">
                <Icon className="h-7 w-7 cp-ui-icon-accent shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm cp-ui-muted">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </CustomerPageZone>
  )
}
