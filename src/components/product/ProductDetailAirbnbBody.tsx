'use client'

import { Check, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductDetailOverviewTab from '@/components/product/ProductDetailOverviewTab'
import ProductDetailWhyChooseSection from '@/components/product/ProductDetailWhyChooseSection'
import ProductDetailItineraryTab from '@/components/product/ProductDetailItineraryTab'
import ProductDetailReviewsSection, {
  type ProductReviewItem,
} from '@/components/product/ProductDetailReviewsSection'
import ProductDetailFaqSection from '@/components/product/ProductDetailFaqSection'
import ProductDetailThingsToKnowAccordion from '@/components/product/ProductDetailThingsToKnowAccordion'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import { resolveProductDetailSectionTitle } from '@/lib/productDetailSectionTitles'
import { collectVisibleTourHighlightSlogans } from '@/lib/tourHighlightSlogans'
import TourHighlightItemLabel from '@/components/product/TourHighlightItemLabel'
import { formatProductDepartureArrivalHighlight } from '@/lib/productDetailDisplay'
import { buildTourLanguageHighlightChips } from '@/lib/tourHighlightLanguages'
import {
  buildTourHighlightItems,
  parseTourHighlightIcons,
  parseTourHighlightLabels,
  resolveTourHighlightIconComponent,
  resolveTourHighlightLabel,
} from '@/lib/tourHighlightIcons'
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
    slogan4?: string | null
    slogan5?: string | null
    greeting?: string | null
    section_titles?: unknown
  } | null
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  displayName: string
  categoryLabel: string
  durationLabel: string
  groupSize?: string | null
  tagLabelMap: TagLabelMap
  showDetail: (field: string) => boolean
  reviews: ProductReviewItem[]
  reviewRating?: number
  selectedDate?: string
}

function AirbnbSectionDivider() {
  return <hr className="airbnb-detail-divider" />
}

export default function ProductDetailAirbnbBody({
  productId,
  locale,
  isEnglish: _isEnglish,
  product,
  productDetails,
  tourCourses,
  tourCoursePhotos,
  displayName,
  categoryLabel,
  durationLabel,
  groupSize,
  tagLabelMap,
  showDetail,
  reviews,
  reviewRating,
  selectedDate = '',
}: ProductDetailAirbnbBodyProps) {
  const t = useTranslations('productDetail')
  const sectionTitles = productDetails?.section_titles
  const tags = productDetails?.tags || product.tags || []
  const mainSlogan = showDetail('slogan1') ? (productDetails?.slogan1?.trim() ?? '') : ''
  const subSlogan = showDetail('slogan2') ? (productDetails?.slogan2?.trim() ?? '') : ''
  const highlightSlogans = collectVisibleTourHighlightSlogans(
    productDetails as Record<string, unknown> | null | undefined,
    showDetail
  )
  const locationLine = product.departure_city || 'Las Vegas'
  const highlightIcons = parseTourHighlightIcons(
    (product as { tour_highlight_icons?: unknown }).tour_highlight_icons
  )
  const highlightLabels = parseTourHighlightLabels(
    (product as { tour_highlight_labels?: unknown }).tour_highlight_labels
  )

  const languageChips = buildTourLanguageHighlightChips(product.languages, locale)
  const departureArrivalLabel = formatProductDepartureArrivalHighlight(product, locale)

  const highlightItems = buildTourHighlightItems({
    durationLabel,
    groupSize: groupSize ?? null,
    categoryLabel,
    locationLine,
    languageChips,
    departureArrivalLabel,
    trustLicensedOperator: resolveTourHighlightLabel(
      highlightLabels,
      'trustLicensedOperator',
      locale,
      t('trustLicensedOperator')
    ),
    trustSmallGroup: resolveTourHighlightLabel(
      highlightLabels,
      'trustSmallGroup',
      locale,
      t('trustSmallGroup')
    ),
    trustFreeCancellation: resolveTourHighlightLabel(
      highlightLabels,
      'trustFreeCancellation',
      locale,
      t('trustFreeCancellation')
    ),
    icons: highlightIcons,
  })

  const tourHighlightsTitle = resolveProductDetailSectionTitle(
    'slogan3',
    sectionTitles,
    t,
    'tourHighlights'
  )

  return (
    <div className="airbnb-detail-body">
      {highlightItems.length > 0 ? (
        <>
          <CustomerPageZone zone="detail-highlights" productId={productId}>
            <section>
              <ul className="airbnb-detail-highlights">
                {highlightItems.map((item) => {
                  const Icon = resolveTourHighlightIconComponent(item.iconKey)
                  return (
                    <li key={item.id} className="airbnb-detail-highlight-item">
                      <Icon className="airbnb-detail-highlight-icon shrink-0 text-[#1a2b49]" strokeWidth={1.5} aria-hidden />
                      <TourHighlightItemLabel item={item} />
                    </li>
                  )
                })}
              </ul>
            </section>
          </CustomerPageZone>
          <AirbnbSectionDivider />
        </>
      ) : null}

      {(mainSlogan || subSlogan) ? (
        <>
          <CustomerPageZone zone="detail-overview-slogan" productId={productId}>
            <section className="airbnb-detail-slogan-block">
              {mainSlogan ? <p className="airbnb-detail-slogan-main">{mainSlogan}</p> : null}
              {subSlogan ? <p className="airbnb-detail-slogan-sub">{subSlogan}</p> : null}
            </section>
          </CustomerPageZone>
          <AirbnbSectionDivider />
        </>
      ) : null}

      {highlightSlogans.length > 0 ? (
        <>
          <CustomerPageZone zone="detail-tour-highlight-bullet" productId={productId}>
            <section className="airbnb-detail-section">
              <h2 className="airbnb-detail-section-title">{tourHighlightsTitle}</h2>
              <p className="airbnb-detail-highlights-desc">{t('tourHighlightsSubtitle')}</p>
              <ul className="airbnb-detail-highlight-list">
                {highlightSlogans.map((text, index) => (
                  <li key={`highlight-${index}`} className="airbnb-detail-highlight-row">
                    <span className="airbnb-detail-highlight-check" aria-hidden>
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span className="airbnb-detail-highlight-text">{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </CustomerPageZone>
          <AirbnbSectionDivider />
        </>
      ) : null}

      <CustomerPageZone zone="detail-tab-overview" productId={productId}>
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
                  slogan4: string | null
                  slogan5: string | null
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
      </CustomerPageZone>

      <ProductDetailWhyChooseSection productId={productId} variant="airbnb" />

      {tourCourses.length > 0 ? (
        <>
          <AirbnbSectionDivider />
          <CustomerPageZone zone="detail-tab-itinerary" productId={productId}>
            <section className="airbnb-detail-section">
              <h2 className="airbnb-detail-section-title">{t('tabItinerary')}</h2>
              <div className="airbnb-detail-section-content">
                <ProductDetailItineraryTab
                  tourCourses={tourCourses}
                  tourCoursePhotos={tourCoursePhotos}
                  locale={locale}
                />
              </div>
            </section>
          </CustomerPageZone>
        </>
      ) : null}

      {tags.length > 0 ? (
        <>
          <AirbnbSectionDivider />
          <section className="airbnb-detail-section">
            <CustomerPageZone zone="detail-tour-offers-heading">
              <h2 className="airbnb-detail-section-title">{t('whatThisTourOffers')}</h2>
            </CustomerPageZone>
            <CustomerPageZone zone="detail-overview-tags" productId={productId}>
              <ul className="airbnb-detail-amenities">
                {tags.slice(0, 10).map((tag) => (
                  <li key={tag} className="airbnb-detail-amenity">
                    <MapPin className="h-6 w-6 shrink-0 text-[#1a2b49]" strokeWidth={1.5} aria-hidden />
                    <span>{resolveTagLabel(tag, locale, tagLabelMap)}</span>
                  </li>
                ))}
              </ul>
            </CustomerPageZone>
          </section>
        </>
      ) : null}

      <AirbnbSectionDivider />

      <CustomerPageZone zone="detail-tab-schedule" productId={productId}>
        <section className="airbnb-detail-section">
          <div className="airbnb-detail-section-content">
            <TourScheduleSection
              productId={productId}
              teamType={null}
              locale={locale}
              variant="customer-itinerary"
              selectedDate={selectedDate}
              product={product}
            />
          </div>
        </section>
      </CustomerPageZone>

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

      <CustomerPageZone zone="detail-tab-details" productId={productId}>
        <section className="airbnb-detail-section">
          <ProductDetailThingsToKnowAccordion
            productId={productId}
            product={product}
            productDetails={productDetails}
            categoryLabel={categoryLabel}
            durationLabel={durationLabel}
            locale={locale}
            tagLabelMap={tagLabelMap}
          />
        </section>
      </CustomerPageZone>

      <AirbnbSectionDivider />

      <section className="airbnb-detail-section">
        <ProductDetailFaqSection productId={productId} variant="airbnb" />
      </section>
    </div>
  )
}
