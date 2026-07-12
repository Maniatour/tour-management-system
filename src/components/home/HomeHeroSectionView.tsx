'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Play } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeSearchBar from '@/components/home/HomeSearchBar'
import type { HeroStructureVariant } from '@/lib/customerPageHomeStructure'
import { MANIATOUR_HERO_IMAGE, MANIATOUR_HERO_STATS } from '@/lib/maniatourHomeData'
import { loadCustomerPageHomeContent } from '@/lib/customerPageHomeContentPersistence'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'

type Props = {
  variant: HeroStructureVariant
  locale: string
  t: (key: string) => string
}

export default function HomeHeroSectionView({ variant, locale, t }: Props) {
  const { revision } = useCustomerPageFieldBindings()
  const heroImage =
    (() => {
      void revision
      return loadCustomerPageHomeContent().heroImageUrl ?? MANIATOUR_HERO_IMAGE
    })()
  const ctaPrimary = (
    <Link
      href={`/${locale}/products`}
      className="cp-ui-btn-primary px-6 sm:px-8 py-3.5 rounded-xl text-base font-semibold inline-flex items-center justify-center"
    >
      {t('browseTours')}
      <ArrowRight className="ml-2" size={20} />
    </Link>
  )
  const ctaSecondary = (
    <button type="button" className="cp-ui-btn-secondary px-6 py-3.5 rounded-xl text-base font-semibold inline-flex items-center justify-center">
      <Play className="mr-2" size={20} />
      {t('watchIntroVideo')}
    </button>
  )

  if (variant === 'maniatour-southwest') {
    return (
      <CustomerPageZone zone="home-hero">
        <section className="kv-hero">
          <Image
            src={heroImage}
            alt={t('homeManiaTourHeroTitle')}
            fill
            priority
            sizes="100vw"
            className="kv-hero-bg object-cover"
          />
          <div className="kv-hero-overlay" aria-hidden />
          <div className="kv-hero-content">
            <div className="kv-container">
              <h1 className="kv-hero-title">{t('homeManiaTourHeroTitle')}</h1>
              <p className="kv-hero-subtitle">{t('homeManiaTourHeroSubtitle')}</p>
              <Link href={`/${locale}/products`} className="kv-hero-cta">
                {t('homeManiaTourHeroCta')}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <div className="kv-hero-stats">
                {MANIATOUR_HERO_STATS.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.textKey} className="kv-hero-stat">
                      <Icon className="kv-hero-stat-icon" aria-hidden />
                      <div className="kv-hero-stat-text">{t(stat.textKey)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'split-editorial') {
    return (
      <CustomerPageZone zone="home-hero" className="relative">
        <div className="absolute inset-0 cp-ui-hero-overlay" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-left">
              <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight">
                {t('unforgettable')}
                <br />
                {t('specialTravelExperience')}
              </h1>
              <p className="cp-ui-muted mb-6">{t('heroSubtitle1')}</p>
              <div className="flex flex-col sm:flex-row gap-3">{ctaPrimary}{ctaSecondary}</div>
            </div>
            <div className="flex min-h-[280px] items-center justify-center rounded-feature border border-border/60 bg-primary/90 text-primary-foreground">
              <Play className="h-14 w-14 opacity-90" aria-hidden />
            </div>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'left-minimal') {
    return (
      <CustomerPageZone zone="home-hero" className="relative">
        <div className="absolute inset-0 cp-ui-hero-overlay opacity-60" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-20">
          <div className="max-w-2xl text-left">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('unforgettable')}</h1>
            <p className="cp-ui-muted mb-8">{t('heroSubtitle2')}</p>
            {ctaPrimary}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'full-immersive') {
    return (
      <CustomerPageZone zone="home-hero" className="relative min-h-[65vh] flex items-end">
        <div className="absolute inset-0 cp-ui-hero-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative w-full max-w-7xl mx-auto px-4 pb-12 pt-24">
          <h1 className="text-4xl sm:text-6xl font-bold mb-4 max-w-3xl">{t('specialTravelExperience')}</h1>
          <p className="cp-ui-muted mb-8 max-w-2xl opacity-90">{t('heroSubtitle1')}</p>
          <div className="flex flex-wrap gap-3">{ctaPrimary}{ctaSecondary}</div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-bar') {
    return (
      <CustomerPageZone zone="home-hero" className="relative">
        <div className="absolute inset-0 cp-ui-hero-overlay" />
        <div className="relative max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('unforgettable')}</h1>
            <p className="text-sm cp-ui-muted">{t('heroSubtitle2')}</p>
          </div>
          {ctaPrimary}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'search-discovery') {
    const participantOptions =
      locale === 'en'
        ? ['1 participant', '2 participants', '3 participants', '4 participants', '5+ participants']
        : ['1명', '2명', '3명', '4명', '5명 이상']

    return (
      <CustomerPageZone zone="home-hero">
        <section className="gyg-hero">
          <div className="gyg-container">
            <h1 className="gyg-hero-title">{t('homeHeroDiscoverTitle')}</h1>
            <HomeSearchBar
              locale={locale}
              searchPlaceholder={t('homeSearchPlaceholder')}
              anytimeLabel={t('homeSearchAnytime')}
              participantLabel={t('homeSearchParticipants')}
              participantOptions={participantOptions}
              searchButtonLabel={t('search')}
            />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-hero" className="relative">
      <div className="absolute inset-0 cp-ui-hero-overlay" />
      <div className="relative max-w-7xl mx-auto px-4 text-center py-10 sm:py-14">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4">
          {t('unforgettable')}
          <br />
          {t('specialTravelExperience')}
        </h1>
        <p className="text-lg cp-ui-muted mb-8">{t('heroSubtitle1')}<br />{t('heroSubtitle2')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">{ctaPrimary}{ctaSecondary}</div>
      </div>
    </CustomerPageZone>
  )
}
