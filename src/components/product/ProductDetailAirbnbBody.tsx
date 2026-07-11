'use client'

import {
  BadgeCheck,
  Bus,
  Check,
  Clock,
  MapPin,
  Shield,
  Users2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailOverviewTab from '@/components/product/ProductDetailOverviewTab'
import ProductDetailItineraryTab from '@/components/product/ProductDetailItineraryTab'
import ProductDetailDetailsTab from '@/components/product/ProductDetailDetailsTab'
import ProductDetailReviewsSection, {
  type ProductReviewItem,
} from '@/components/product/ProductDetailReviewsSection'
import ProductDetailFaqSection from '@/components/product/ProductDetailFaqSection'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import type {
  ProductDetailsFields,
  ProductDetailsTabProduct,
  ProductTourCourse,
  TourCoursePhoto,
} from '@/components/product/productDetailTypes'

type ProductDetailAirbnbBodyProps = {
  productId: string
  locale: string
  isEnglish: boolean
  product: ProductDetailsTabProduct & {
    name: string
    customer_name_ko: string
    customer_name_en: string
    description: string | null
    summary_ko?: string | null
    summary_en?: string | null
    departure_city?: string | null
  }
  productDetails: ProductDetailsFields & {
    slogan1?: string | null
    slogan2?: string | null
    slogan3?: string | null
    greeting?: string | null
  } | null
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  displayName: string
  categoryLabel: string
  durationLabel: string
  groupSize?: string | null
  slogans: Array<string | null | undefined>
  showSlogans: boolean
  tagLabelMap: TagLabelMap
  showDetail: (field: string) => boolean
  reviews: ProductReviewItem[]
  reviewRating?: number
}

function AirbnbSectionDivider() {
  return <hr className="airbnb-detail-divider" />
}

export default function ProductDetailAirbnbBody({
  productId,
  locale,
  isEnglish,
  product,
  productDetails,
  tourCourses,
  tourCoursePhotos,
  displayName,
  categoryLabel,
  durationLabel,
  groupSize,
  slogans,
  showSlogans,
  tagLabelMap,
  showDetail,
  reviews,
  reviewRating,
}: ProductDetailAirbnbBodyProps) {
  const t = useTranslations('productDetail')
  const tags = productDetails?.tags || product.tags || []
  const sloganItems = slogans.filter((s): s is string => Boolean(s?.trim()))
  const mainSlogan = productDetails?.slogan1?.trim() ?? ''
  const subSlogan = productDetails?.slogan2?.trim() ?? ''
  const locationLine = product.departure_city || 'Las Vegas'

  const highlightItems = [
    durationLabel ? { icon: Clock, label: durationLabel } : null,
    groupSize ? { icon: Users2, label: groupSize } : null,
    categoryLabel
      ? { icon: MapPin, label: `${categoryLabel} · ${locationLine}` }
      : null,
    { icon: BadgeCheck, label: t('trustLicensedOperator') },
    { icon: Bus, label: t('trustSmallGroup') },
    { icon: Shield, label: t('trustFreeCancellation') },
  ].filter(Boolean) as Array<{ icon: typeof Clock; label: string }>

  return (
    <div className="airbnb-detail-body">
      {highlightItems.length > 0 ? (
        <>
          <section>
            <ul className="airbnb-detail-highlights">
              {highlightItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label} className="airbnb-detail-highlight-item">
                    <Icon className="h-6 w-6 shrink-0 text-[#1a2b49]" strokeWidth={1.5} aria-hidden />
                    <span>{item.label}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <AirbnbSectionDivider />
        </>
      ) : null}

      {showSlogans && (mainSlogan || subSlogan) ? (
        <>
          <section className="airbnb-detail-slogan-block">
            {mainSlogan ? <p className="airbnb-detail-slogan-main">{mainSlogan}</p> : null}
            {subSlogan ? <p className="airbnb-detail-slogan-sub">{subSlogan}</p> : null}
          </section>
          <AirbnbSectionDivider />
        </>
      ) : null}

      {showSlogans && sloganItems.length > 0 ? (
        <>
          <section className="airbnb-detail-section">
            <h2 className="airbnb-detail-section-title">{t('tourHighlights')}</h2>
            <p className="airbnb-detail-highlights-desc">{t('tourHighlightsSubtitle')}</p>
            <ul className="airbnb-detail-highlight-list">
              {sloganItems.map((text, index) => (
                <li key={`highlight-${index}`} className="airbnb-detail-highlight-row">
                  <span className="airbnb-detail-highlight-check" aria-hidden>
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <span className="airbnb-detail-highlight-text">{text}</span>
                </li>
              ))}
            </ul>
          </section>
          <AirbnbSectionDivider />
        </>
      ) : null}

      <section className="airbnb-detail-section">
        <h2 className="airbnb-detail-section-title">{t('aboutThisTour')}</h2>
        <div className="airbnb-detail-section-content">
          <ProductDetailOverviewTab
            product={product}
            productDetails={
              productDetails as {
                slogan1: string | null
                slogan2: string | null
                slogan3: string | null
                greeting: string | null
                description: string | null
                tags: string[] | null
              } | null
            }
            displayName={displayName}
            durationLabel={durationLabel}
            categoryLabel={categoryLabel}
            locale={locale}
            showDetail={showDetail}
            tagLabelMap={tagLabelMap}
            variant="airbnb"
          />
        </div>
      </section>

      {tourCourses.length > 0 ? (
        <>
          <AirbnbSectionDivider />
          <section className="airbnb-detail-section">
            <h2 className="airbnb-detail-section-title">{t('tabItinerary')}</h2>
            <div className="airbnb-detail-section-content">
              <ProductDetailItineraryTab
                tourCourses={tourCourses}
                tourCoursePhotos={tourCoursePhotos}
                isEnglish={isEnglish}
              />
            </div>
          </section>
        </>
      ) : null}

      <AirbnbSectionDivider />

      <section className="airbnb-detail-section">
        <h2 className="airbnb-detail-section-title">{t('detailTabIncluded')}</h2>
        <div className="airbnb-detail-section-content">
          <ProductDetailDetailsTab
            product={product}
            productDetails={productDetails}
            categoryLabel={categoryLabel}
            durationLabel={durationLabel}
            locale={locale}
            tagLabelMap={tagLabelMap}
            section="included"
            variant="airbnb"
          />
        </div>
      </section>

      {tags.length > 0 ? (
        <>
          <AirbnbSectionDivider />
          <section className="airbnb-detail-section">
            <h2 className="airbnb-detail-section-title">{t('whatThisTourOffers')}</h2>
            <ul className="airbnb-detail-amenities">
              {tags.slice(0, 10).map((tag) => (
                <li key={tag} className="airbnb-detail-amenity">
                  <MapPin className="h-6 w-6 shrink-0 text-[#1a2b49]" strokeWidth={1.5} aria-hidden />
                  <span>{resolveTagLabel(tag, locale, tagLabelMap)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <AirbnbSectionDivider />

      <section className="airbnb-detail-section">
        <TourScheduleSection productId={productId} teamType={null} locale={locale} />
      </section>

      {reviews.length > 0 ? (
        <>
          <AirbnbSectionDivider />
          <ProductDetailReviewsSection
            reviews={reviews}
            variant="airbnb"
            {...(reviewRating != null ? { averageRating: reviewRating } : {})}
          />
        </>
      ) : null}

      <AirbnbSectionDivider />

      <section className="airbnb-detail-section airbnb-detail-things-to-know">
        <h2 className="airbnb-detail-section-title">{t('thingsToKnow')}</h2>
        <div className="space-y-8">
          <div>
            <h3 className="airbnb-detail-things-heading mb-4 text-lg font-semibold">{t('detailTabPolicy')}</h3>
            <ProductDetailDetailsTab
              product={product}
              productDetails={productDetails}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              locale={locale}
              tagLabelMap={tagLabelMap}
              section="policy"
              variant="default"
            />
          </div>
          <div>
            <h3 className="airbnb-detail-things-heading mb-4 text-lg font-semibold">{t('detailTabLogistics')}</h3>
            <ProductDetailDetailsTab
              product={product}
              productDetails={productDetails}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              locale={locale}
              tagLabelMap={tagLabelMap}
              section="logistics"
              variant="default"
            />
          </div>
          <div>
            <h3 className="airbnb-detail-things-heading mb-4 text-lg font-semibold">{t('detailTabBasic')}</h3>
            <ProductDetailDetailsTab
              product={product}
              productDetails={productDetails}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              locale={locale}
              tagLabelMap={tagLabelMap}
              section="basic"
              variant="default"
            />
          </div>
        </div>
      </section>

      <AirbnbSectionDivider />

      <section className="airbnb-detail-section">
        <ProductDetailFaqSection productId={productId} variant="airbnb" />
      </section>
    </div>
  )
}
