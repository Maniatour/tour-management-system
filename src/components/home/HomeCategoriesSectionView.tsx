'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Tag } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeTourCategoryGrid from '@/components/home/HomeTourCategoryGrid'
import type { CategoriesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { CategoryTagItem } from '@/components/home/homeSectionTypes'
import { getHomeCategoryIcon } from '@/lib/homeCategoryIcons'
import { HOME_DESTINATIONS } from '@/lib/homeDestinationData'
import { buildHomeAdventureGridItems, getHomeDestinationLabel, resolveHomeDestinationsForDisplay } from '@/lib/customerPageHomeContent'
import { loadCustomerPageHomeContent } from '@/lib/customerPageHomeContentPersistence'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import HomeManiaTourSectionHeader, {
  HomeManiaTourSectionViewAllFooter,
} from '@/components/home/HomeManiaTourSectionHeader'

type Props = {
  variant: CategoriesStructureVariant
  locale: string
  t: (key: string) => string
  categoryTags: CategoryTagItem[]
  zoneId?: string
}

const tileClass =
  'flex flex-col items-center justify-center rounded-feature border border-border/60 bg-card p-4 text-center transition-all duration-300 hover:border-booking/30 hover:shadow-card'

const pillClass =
  'inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-booking/30 hover:bg-muted/50'

function categoryItemKey(item: CategoryTagItem): string {
  return item.id ?? item.labelKey ?? item.tagQuery
}

function categoryItemLabel(item: CategoryTagItem, t: (key: string) => string): string {
  return item.label ?? (item.labelKey ? t(item.labelKey) : item.tagQuery)
}

function categoryIconKey(item: CategoryTagItem): string {
  return item.labelKey ?? 'dayTour'
}

function CategoryIconGridSection({
  locale,
  t,
  categoryTags,
}: {
  locale: string
  t: (key: string) => string
  categoryTags: CategoryTagItem[]
}) {
  return (
    <section className="gyg-section gyg-section--muted">
      <div className="gyg-container">
        <h2 className="gyg-section-title">{t('findToursByCategory')}</h2>
        <HomeTourCategoryGrid locale={locale} t={t} items={categoryTags} />
        <div className="mt-6 text-center">
          <Link
            href={`/${locale}/products/tags`}
            className="gyg-text-link inline-flex items-center gap-2 text-sm font-semibold"
          >
            <Tag className="h-4 w-4" aria-hidden />
            {t('viewAllTags')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function HomeCategoriesSectionView({ variant, locale, t, categoryTags, zoneId = 'home-categories' }: Props) {
  const { revision } = useCustomerPageFieldBindings()
  const destinations = (() => {
    void revision
    const configured = loadCustomerPageHomeContent().destinations
    return resolveHomeDestinationsForDisplay(configured.length > 0 ? configured : HOME_DESTINATIONS)
  })()
  const adventureItems = (() => {
    void revision
    return buildHomeAdventureGridItems(locale, t, loadCustomerPageHomeContent())
  })()
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

  const renderIcon = (item: CategoryTagItem, sizeClass = 'h-7 w-7') => {
    const Icon = getHomeCategoryIcon(categoryIconKey(item))
    return <Icon className={`${sizeClass} cp-ui-icon-accent mb-2`} aria-hidden />
  }

  if (variant === 'maniatour-destinations') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section">
          <div className="kv-container">
            <HomeManiaTourSectionHeader
              title={t('homeDestinationsManiaTourTitle')}
              viewAllHref={`/${locale}/products/tags`}
              viewAllLabel={t('homeViewAllDestinations')}
            />
            <div className="kv-dest-grid">
              {destinations.map((destination) => (
                <Link
                  key={destination.id}
                  href={`/${locale}/products?tag=${encodeURIComponent(destination.tagQuery)}`}
                  className="kv-dest-card group"
                >
                  <div className="kv-dest-image">
                    <Image
                      src={destination.imageUrl}
                      alt={getHomeDestinationLabel(destination, locale, t)}
                      fill
                      sizes="(max-width: 640px) 50vw, 220px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="kv-dest-overlay" />
                    <span className="kv-dest-name">{getHomeDestinationLabel(destination, locale, t)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <HomeManiaTourSectionViewAllFooter
              href={`/${locale}/products/tags`}
              label={t('homeViewAllDestinations')}
            />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'travel-style-cards') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section">
          <div className="kv-container">
            <HomeManiaTourSectionHeader title={t('homeTravelStyleTitle')} />
            <HomeTourCategoryGrid locale={locale} t={t} items={adventureItems} variant="boxed" />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'destination-cities') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section">
          <div className="gyg-container">
            <h2 className="gyg-section-title">{t('homeDestinationsTitle')}</h2>
            <div className="gyg-dest-grid">
              {HOME_DESTINATIONS.map((destination) => (
                <Link
                  key={destination.id}
                  href={`/${locale}/products?tag=${encodeURIComponent(destination.tagQuery)}`}
                  className="gyg-dest-card group"
                >
                  <div className="gyg-dest-image">
                    <Image
                      src={destination.imageUrl}
                      alt={t(destination.labelKey)}
                      fill
                      sizes="(max-width: 768px) 45vw, 160px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <span className="gyg-dest-name">{t(destination.labelKey)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <CategoryIconGridSection locale={locale} t={t} categoryTags={categoryTags} />
      </CustomerPageZone>
    )
  }

  if (variant === 'grid-icons') {
    return (
      <CustomerPageZone zone={zoneId}>
        <CategoryIconGridSection locale={locale} t={t} categoryTags={categoryTags} />
      </CustomerPageZone>
    )
  }

  if (variant === 'horizontal-scroll') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section">
          <div className="gyg-container">
            <h2 className="gyg-section-title">{t('findToursByCategory')}</h2>
            <div className="cp-home-scroll-row flex gap-4 pb-2">
              {categoryTags.map((c) => (
                <Link
                  key={categoryItemKey(c)}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} min-w-[150px] shrink-0`}
                >
                  {renderIcon(c)}
                  <div className="text-sm font-semibold">{categoryItemLabel(c, t)}</div>
                </Link>
              ))}
            </div>
            {footer}
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'large-tiles') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section">
          <div className="gyg-container">
            <h2 className="gyg-section-title">{t('findToursByCategory')}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {categoryTags.map((c) => (
                <Link
                  key={categoryItemKey(c)}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} aspect-[4/3]`}
                >
                  {renderIcon(c, 'h-9 w-9')}
                  <span className="text-sm font-bold">{categoryItemLabel(c, t)}</span>
                </Link>
              ))}
            </div>
            {footer}
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-pills') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section">
          <div className="gyg-container">
            <h2 className="gyg-section-title text-center">{t('findToursByCategory')}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {categoryTags.map((c) => {
                const Icon = getHomeCategoryIcon(categoryIconKey(c))
                return (
                  <Link
                    key={categoryItemKey(c)}
                    href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                    className={pillClass}
                  >
                    <Icon className="h-4 w-4 cp-ui-icon-accent" aria-hidden />
                    {categoryItemLabel(c, t)}
                  </Link>
                )
              })}
            </div>
            {footer}
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'bento-asymmetric') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="gyg-section gyg-section--muted">
          <div className="gyg-container">
            <h2 className="gyg-section-title">{t('findToursByCategory')}</h2>
            <div className="grid auto-rows-[130px] grid-cols-2 gap-3 md:grid-cols-4">
              {categoryTags.map((c, i) => (
                <Link
                  key={categoryItemKey(c)}
                  href={`/${locale}/products?tag=${encodeURIComponent(c.tagQuery)}`}
                  className={`${tileClass} ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:col-span-2' : ''}`}
                >
                  {renderIcon(c, i === 0 ? 'h-10 w-10' : 'h-7 w-7')}
                  <span className="px-2 text-center text-xs font-semibold">{categoryItemLabel(c, t)}</span>
                </Link>
              ))}
            </div>
            {footer}
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <CategoryIconGridSection locale={locale} t={t} categoryTags={categoryTags} />
    </CustomerPageZone>
  )
}
