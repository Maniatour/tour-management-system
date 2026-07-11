'use client'

import Link from 'next/link'
import { ArrowRight, Tag } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionHeader } from '@/components/ui/section-header'
import type { CategoriesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { CategoryTagItem } from '@/components/home/homeSectionTypes'
import { getHomeCategoryIcon } from '@/lib/homeCategoryIcons'

type Props = {
  variant: CategoriesStructureVariant
  locale: string
  t: (key: string) => string
  categoryTags: CategoryTagItem[]
}

const tileClass =
  'flex flex-col items-center justify-center rounded-feature border border-border/60 bg-card p-4 text-center transition-all duration-300 hover:border-booking/30 hover:shadow-card'

const pillClass =
  'inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-booking/30 hover:bg-muted/50'

export default function HomeCategoriesSectionView({ variant, locale, t, categoryTags }: Props) {
  const footer = (
    <div className="mt-8 text-center">
      <Link
        href={`/${locale}/products/tags`}
        className="cp-ui-btn-outline inline-flex items-center rounded-btn px-5 py-2.5 text-sm font-medium"
      >
        <Tag className="mr-2 h-4 w-4" aria-hidden />
        {t('viewAllTags')}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
      </Link>
    </div>
  )

  const renderIcon = (labelKey: string, sizeClass = 'h-7 w-7') => {
    const Icon = getHomeCategoryIcon(labelKey)
    return <Icon className={`${sizeClass} cp-ui-icon-accent mb-2`} aria-hidden />
  }

  if (variant === 'horizontal-scroll') {
    return (
      <CustomerPageZone zone="home-categories">
        <Section spacing="compact">
          <Container>
            <SectionHeader heading={t('findToursByCategory')} />
            <div className="cp-home-scroll-row flex gap-4 pb-2">
              {categoryTags.map((c) => (
                <Link
                  key={c.labelKey}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} min-w-[150px] shrink-0`}
                >
                  {renderIcon(c.labelKey)}
                  <div className="text-sm font-semibold">{t(c.labelKey)}</div>
                </Link>
              ))}
            </div>
            {footer}
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  if (variant === 'large-tiles') {
    return (
      <CustomerPageZone zone="home-categories">
        <Section spacing="compact">
          <Container>
            <SectionHeader heading={t('findToursByCategory')} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {categoryTags.map((c) => (
                <Link
                  key={c.labelKey}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} aspect-[4/3]`}
                >
                  {renderIcon(c.labelKey, 'h-9 w-9')}
                  <span className="text-sm font-bold">{t(c.labelKey)}</span>
                </Link>
              ))}
            </div>
            {footer}
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-pills') {
    return (
      <CustomerPageZone zone="home-categories">
        <Section spacing="compact">
          <Container>
            <SectionHeader heading={t('findToursByCategory')} align="center" />
            <div className="flex flex-wrap justify-center gap-2">
              {categoryTags.map((c) => {
                const Icon = getHomeCategoryIcon(c.labelKey)
                return (
                  <Link
                    key={c.labelKey}
                    href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                    className={pillClass}
                  >
                    <Icon className="h-4 w-4 cp-ui-icon-accent" aria-hidden />
                    {t(c.labelKey)}
                  </Link>
                )
              })}
            </div>
            {footer}
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  if (variant === 'bento-asymmetric') {
    return (
      <CustomerPageZone zone="home-categories">
        <Section spacing="compact">
          <Container>
            <SectionHeader heading={t('findToursByCategory')} />
            <div className="grid auto-rows-[130px] grid-cols-2 gap-3 md:grid-cols-4">
              {categoryTags.map((c, i) => (
                <Link
                  key={c.labelKey}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:col-span-2' : ''}`}
                >
                  {renderIcon(c.labelKey, i === 0 ? 'h-10 w-10' : 'h-7 w-7')}
                  <span className="px-2 text-center text-xs font-semibold">{t(c.labelKey)}</span>
                </Link>
              ))}
            </div>
            {footer}
          </Container>
        </Section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-categories">
      <Section spacing="compact" variant="muted">
        <Container>
          <SectionHeader
            heading={t('findToursByCategory')}
            subtitle={t('findToursByCategoryDesc')}
            align="center"
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categoryTags.map((c) => (
              <Link
                key={c.labelKey}
                href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                className={tileClass}
              >
                {renderIcon(c.labelKey)}
                <h3 className="text-center text-xs font-semibold">{t(c.labelKey)}</h3>
              </Link>
            ))}
          </div>
          {footer}
        </Container>
      </Section>
    </CustomerPageZone>
  )
}
