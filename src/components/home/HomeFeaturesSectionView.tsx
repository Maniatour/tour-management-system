'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionHeader } from '@/components/ui/section-header'
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
        <Section spacing="compact">
          <Container>
            <SectionHeader heading={t('whyChooseUs')} align="center" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={i} className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-booking/10">
                      <Icon className="h-6 w-6 cp-ui-icon-accent" aria-hidden />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
                    <p className="text-xs cp-ui-muted">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  if (variant === 'alternating-rows') {
    return (
      <CustomerPageZone zone="home-features">
        <Section spacing="compact" variant="muted">
          <Container>
            <SectionHeader heading={t('whyChooseUs')} align="center" />
            <div className="space-y-8">
              {features.map((f, i) => {
                const Icon = f.icon
                const rev = i % 2 === 1
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-4 ${rev ? 'md:flex-row-reverse' : 'md:flex-row'}`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-booking/10">
                      <Icon className="h-7 w-7 cp-ui-icon-accent" aria-hidden />
                    </div>
                    <div className={rev ? 'md:text-right' : ''}>
                      <h3 className="mb-1 font-semibold">{f.title}</h3>
                      <p className="text-sm cp-ui-muted">{f.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  if (variant === 'icon-row') {
    return (
      <CustomerPageZone zone="home-features">
        <Section spacing="compact">
          <Container>
            <div className="grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={i}>
                    <Icon className="mx-auto mb-2 h-7 w-7 cp-ui-icon-accent" aria-hidden />
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="line-clamp-2 text-xs cp-ui-muted">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-features">
      <Section spacing="compact">
        <Container>
          <SectionHeader heading={t('whyChooseUs')} align="center" />
          <div className="grid gap-8 md:grid-cols-2">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-booking/10">
                    <Icon className="h-5 w-5 cp-ui-icon-accent" aria-hidden />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">{f.title}</h3>
                    <p className="text-sm cp-ui-muted">{f.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Container>
      </Section>
    </CustomerPageZone>
  )
}
