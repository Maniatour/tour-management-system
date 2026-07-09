'use client'

import type { ReactNode } from 'react'
import type { HomePageSectionEntry } from '@/lib/customerPageHomeSectionCatalog'
import { getCatalogItem, getBuiltinZoneId, resolveSectionStructureVariant } from '@/lib/customerPageHomeSectionCatalog'
import { sectionPresetToCssProperties } from '@/lib/customerPageHomeSectionUi'
import { useCustomerPageHomeStructure } from '@/hooks/useCustomerPageHomeStructure'
import { useHomeSectionProducts } from '@/hooks/useHomeSectionProducts'
import HomeHeroSectionView from '@/components/home/HomeHeroSectionView'
import HomeCategoriesSectionView from '@/components/home/HomeCategoriesSectionView'
import HomeStatsSectionView from '@/components/home/HomeStatsSectionView'
import HomePopularSectionView from '@/components/home/HomePopularSectionView'
import HomeFeaturesSectionView from '@/components/home/HomeFeaturesSectionView'
import HomeCtaSectionView from '@/components/home/HomeCtaSectionView'
import HomeReviewsSectionView from '@/components/home/HomeReviewsSectionView'
import HomeFaqSectionView from '@/components/home/HomeFaqSectionView'
import HomeGallerySectionView from '@/components/home/HomeGallerySectionView'
import HomeLogosSectionView from '@/components/home/HomeLogosSectionView'
import HomeVideoSectionView from '@/components/home/HomeVideoSectionView'
import HomeNewsletterSectionView from '@/components/home/HomeNewsletterSectionView'
import HomePromoSectionView from '@/components/home/HomePromoSectionView'
import HomeRichTextSectionView from '@/components/home/HomeRichTextSectionView'
import type { PopularProductView } from '@/components/home/HomePopularToursBlock'
import type { CategoriesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { HeroStructureVariant } from '@/lib/customerPageHomeStructure'
import type { StatsStructureVariant } from '@/lib/customerPageHomeStructure'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'
import type { FeaturesStructureVariant } from '@/lib/customerPageHomeStructure'
import type { CtaStructureVariant } from '@/lib/customerPageHomeStructure'
import {
  getSectionProductDepartureLine,
  getSectionProductDescription,
  getSectionProductName,
  getSectionProductPrice,
} from '@/lib/customerPageHomeSectionDisplay'

type CategoryTagItem = {
  labelKey: string
  tagQuery: string
  emoji: string
  gradient: string
  hoverGradient: string
}

type StatItem = { number: string; label: string }
type FeatureItem = { icon: import('lucide-react').LucideIcon; title: string; description: string }

type HomeSectionRendererProps = {
  section: HomePageSectionEntry
  locale: string
  t: (key: string) => string
  categoryTags: CategoryTagItem[]
  stats: StatItem[]
  features: FeatureItem[]
  bindingsActive: boolean
  bindingRevision: number
  isAdmin: boolean
  isChangingOrder: boolean
  showCardEditZones: boolean
  isPreview: boolean
  isEditMode: boolean
  onChangeFavoriteOrder: (productId: string, direction: 'up' | 'down') => void | Promise<void>
  getPriceLabel: (price: number | null) => string
}

function CardListSectionBody({
  section,
  locale,
  t,
  bindingsActive,
  bindingRevision,
  isAdmin,
  isChangingOrder,
  showCardEditZones,
  onChangeFavoriteOrder,
  getPriceLabel,
  globalStructure,
}: Omit<HomeSectionRendererProps, 'categoryTags' | 'stats' | 'features'> & {
  globalStructure: ReturnType<typeof useCustomerPageHomeStructure>
}) {
  const { products, loading, error } = useHomeSectionProducts(section)
  const variant = resolveSectionStructureVariant(section, globalStructure) as PopularStructureVariant

  void bindingRevision

  const popularProps = {
    popularTours: products,
    popularLoading: loading,
    popularError: error,
    isAdmin,
    isChangingOrder,
    showCardEditZones,
    getProductName: (product: PopularProductView) =>
      getSectionProductName(section, product as Record<string, unknown>, locale, bindingsActive),
    getProductDescription: (product: PopularProductView) =>
      getSectionProductDescription(section, product as Record<string, unknown>, locale, bindingsActive),
    getCardDepartureLine: (product: PopularProductView) =>
      getSectionProductDepartureLine(section, product as Record<string, unknown>, locale, bindingsActive),
    getCardPrice: (product: PopularProductView) =>
      getSectionProductPrice(section, product as Record<string, unknown>, bindingsActive),
    getPriceLabel,
    onChangeFavoriteOrder,
  }

  const customTitle = section.config.title?.trim()

  return (
    <HomePopularSectionView
      locale={locale}
      t={t}
      variant={variant}
      popularProps={popularProps}
      {...(customTitle ? { titleOverride: customTitle } : {})}
      zoneId={getBuiltinZoneId(section)}
    />
  )
}

export default function HomeSectionRenderer(props: HomeSectionRendererProps) {
  const globalStructure = useCustomerPageHomeStructure()
  const { section, locale, t, categoryTags, stats, features } = props
  const inlineStyle = sectionPresetToCssProperties(section)
  const zoneId = getBuiltinZoneId(section)

  let content: ReactNode = null

  switch (section.kind) {
    case 'hero':
      content = (
        <HomeHeroSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as HeroStructureVariant}
          locale={locale}
          t={t}
        />
      )
      break
    case 'categories':
      content = (
        <HomeCategoriesSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as CategoriesStructureVariant}
          locale={locale}
          t={t}
          categoryTags={categoryTags}
        />
      )
      break
    case 'stats':
      content = (
        <HomeStatsSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as StatsStructureVariant}
          stats={stats}
        />
      )
      break
    case 'card-list':
      content = <CardListSectionBody {...props} globalStructure={globalStructure} />
      break
    case 'features':
      content = (
        <HomeFeaturesSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as FeaturesStructureVariant}
          t={t}
          features={features}
        />
      )
      break
    case 'cta':
      content = (
        <HomeCtaSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as CtaStructureVariant}
          locale={locale}
          t={t}
        />
      )
      break
    case 'reviews':
      content = (
        <HomeReviewsSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeReviewsSectionView').ReviewsStructureVariant}
          t={t}
          zoneId={zoneId}
          itemCount={section.config.itemCount ?? getCatalogItem('reviews').defaultConfig.itemCount ?? 3}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'faq':
      content = (
        <HomeFaqSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeFaqSectionView').FaqStructureVariant}
          t={t}
          zoneId={zoneId}
          itemCount={section.config.itemCount ?? getCatalogItem('faq').defaultConfig.itemCount ?? 5}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'gallery':
      content = (
        <HomeGallerySectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeGallerySectionView').GalleryStructureVariant}
          t={t}
          zoneId={zoneId}
          itemCount={section.config.itemCount ?? getCatalogItem('gallery').defaultConfig.itemCount ?? 6}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'logos':
      content = (
        <HomeLogosSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeLogosSectionView').LogosStructureVariant}
          t={t}
          zoneId={zoneId}
          itemCount={section.config.itemCount ?? getCatalogItem('logos').defaultConfig.itemCount ?? 6}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'video':
      content = (
        <HomeVideoSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeVideoSectionView').VideoStructureVariant}
          t={t}
          zoneId={zoneId}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'newsletter':
      content = (
        <HomeNewsletterSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeNewsletterSectionView').NewsletterStructureVariant}
          t={t}
          zoneId={zoneId}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'promo':
      content = (
        <HomePromoSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomePromoSectionView').PromoStructureVariant}
          t={t}
          locale={locale}
          zoneId={zoneId}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
    case 'rich-text':
      content = (
        <HomeRichTextSectionView
          variant={resolveSectionStructureVariant(section, globalStructure) as import('@/components/home/HomeRichTextSectionView').RichTextStructureVariant}
          t={t}
          zoneId={zoneId}
          {...(section.config.title?.trim() ? { titleOverride: section.config.title.trim() } : {})}
        />
      )
      break
  }

  if (!inlineStyle) return content

  return (
    <div className="cp-home-section-themed" style={inlineStyle}>
      {content}
    </div>
  )
}
