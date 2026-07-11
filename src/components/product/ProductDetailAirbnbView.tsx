'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart, Share2, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailAirbnbGallery from '@/components/product/ProductDetailAirbnbGallery'
import ProductDetailAirbnbBody from '@/components/product/ProductDetailAirbnbBody'
import ProductDetailAirbnbBookingCard from '@/components/product/ProductDetailAirbnbBookingCard'
import ProductDetailAirbnbOptionsSection from '@/components/product/ProductDetailAirbnbOptionsSection'
import ProductDetailDateTravelersPickers from '@/components/product/ProductDetailDateTravelersPickers'
import ProductDetailMobileStickyCta from '@/components/product/ProductDetailMobileStickyCta'
import ReviewSummary from '@/components/customer/ui/ReviewSummary'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import {
  DEFAULT_TRAVELER_AGE_LIMITS,
  DEFAULT_TRAVELER_COUNTS,
  type TravelerCounts,
} from '@/lib/productDetailTravelers'
import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'
import type {
  ProductDetailsFields,
  ProductDetailsTabProduct,
  ProductMedia,
  ProductTourCourse,
  TourCoursePhoto,
} from '@/components/product/productDetailTypes'
import type { TagLabelMap } from '@/lib/productTagDisplay'

type ProductDetailAirbnbViewProps = {
  locale: string
  isEnglish: boolean
  displayName: string
  categoryLabel: string
  durationLabel: string
  primaryTag?: string | null
  groupSize?: string | null
  productId: string
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
  productMedia: ProductMedia[]
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  slogans: Array<string | null | undefined>
  showSlogans: boolean
  tagLabelMap: TagLabelMap
  showDetail: (field: string) => boolean
  reviews: ProductReviewItem[]
  reviewRating?: number
  reviewCount?: number
  totalPrice: number
  bookingPanelProps: {
    basePrice: number | null
    maxParticipants: number | null
    durationLabel: string
    groupSize: string | null
    totalPrice: number
    groupedChoices: Record<string, ProductDetailChoiceGroup>
    selectedOptions: Record<string, string>
    includedHtml?: string | null
    notIncludedHtml?: string | null
    showIncluded: boolean
    showNotIncluded: boolean
    isEnglish: boolean
    onOptionChange: (choiceId: string, optionId: string) => void
    onCompareOptions: () => void
    onBookNow: () => void
  }
}

export default function ProductDetailAirbnbView({
  locale,
  isEnglish,
  displayName,
  categoryLabel,
  durationLabel,
  groupSize,
  productId,
  product,
  productDetails,
  productMedia,
  tourCourses,
  tourCoursePhotos,
  slogans,
  showSlogans,
  tagLabelMap,
  showDetail,
  reviews,
  reviewRating,
  reviewCount,
  totalPrice,
  bookingPanelProps,
}: ProductDetailAirbnbViewProps) {
  const t = useTranslations('productDetail')
  const trustBadges = useProductDetailTrustBadges()
  const [selectedDate, setSelectedDate] = useState('')
  const [travelerCounts, setTravelerCounts] = useState<TravelerCounts>(DEFAULT_TRAVELER_COUNTS)
  const optionsAnchorRef = useRef<HTMLDivElement>(null)
  const previousDateRef = useRef('')
  const locationLine = product.departure_city || 'Las Vegas'

  const ageLimits = {
    adultAge: product.adult_age ?? DEFAULT_TRAVELER_AGE_LIMITS.adultAge,
    childAgeMin: product.child_age_min ?? DEFAULT_TRAVELER_AGE_LIMITS.childAgeMin,
    childAgeMax: product.child_age_max ?? DEFAULT_TRAVELER_AGE_LIMITS.childAgeMax,
    infantAge: product.infant_age ?? DEFAULT_TRAVELER_AGE_LIMITS.infantAge,
    maxParticipants: product.max_participants ?? DEFAULT_TRAVELER_AGE_LIMITS.maxParticipants,
  }

  useEffect(() => {
    if (!selectedDate || selectedDate === previousDateRef.current) {
      previousDateRef.current = selectedDate
      return
    }

    previousDateRef.current = selectedDate

    const frame = window.requestAnimationFrame(() => {
      optionsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedDate])

  return (
    <div className="airbnb-detail min-h-screen bg-white pb-24 lg:pb-12">
      <div className="airbnb-detail-container">
        <div className="airbnb-detail-title-row">
          <div className="min-w-0 flex-1">
            <p className="airbnb-detail-meta-line">
              {t('tourInLocation', { location: locationLine })}
              {durationLabel ? ` · ${durationLabel}` : ''}
              {groupSize ? ` · ${groupSize}` : ''}
            </p>
            <h1 className="airbnb-detail-title">{displayName}</h1>
            {reviewRating != null && reviewCount != null && reviewCount > 0 ? (
              <ReviewSummary
                rating={reviewRating}
                reviewCount={reviewCount}
                reviewsLabel={t('reviewCount', { count: reviewCount })}
                className="mt-2"
              />
            ) : (
              <div className="mt-2 flex items-center gap-1 text-sm text-[#1a2b49]">
                <Star className="h-4 w-4 fill-[#1a2b49]" aria-hidden />
                <span className="font-semibold">{categoryLabel}</span>
              </div>
            )}
          </div>

          <div className="airbnb-detail-title-actions">
            <button type="button" className="airbnb-detail-text-action">
              <Share2 className="h-4 w-4" aria-hidden />
              <span>{t('share')}</span>
            </button>
            <button type="button" className="airbnb-detail-text-action">
              <Heart className="h-4 w-4" aria-hidden />
              <span>{t('save')}</span>
            </button>
          </div>
        </div>

        <ProductDetailAirbnbGallery
          productMedia={productMedia}
          tourCoursePhotos={tourCoursePhotos}
          displayName={displayName}
          isEnglish={isEnglish}
        />

        <div className="airbnb-detail-layout">
          <div className="airbnb-detail-main">
            <div className="airbnb-detail-mobile-booking lg:hidden">
              <ProductDetailDateTravelersPickers
                productId={productId}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                travelerCounts={travelerCounts}
                onTravelerCountsChange={setTravelerCounts}
                ageLimits={ageLimits}
              />
            </div>

            {selectedDate ? (
              <div ref={optionsAnchorRef} className="airbnb-detail-options-anchor">
                <ProductDetailAirbnbOptionsSection
                  groupedChoices={bookingPanelProps.groupedChoices}
                  selectedOptions={bookingPanelProps.selectedOptions}
                  onOptionChange={bookingPanelProps.onOptionChange}
                  onCompareOptions={bookingPanelProps.onCompareOptions}
                  onBookNow={bookingPanelProps.onBookNow}
                  totalPrice={totalPrice}
                  selectedDate={selectedDate}
                  isEnglish={isEnglish}
                />
                <hr className="airbnb-detail-divider" />
              </div>
            ) : null}

            <ProductDetailAirbnbBody
              productId={productId}
              locale={locale}
              isEnglish={isEnglish}
              product={product}
              productDetails={productDetails}
              tourCourses={tourCourses}
              tourCoursePhotos={tourCoursePhotos}
              displayName={displayName}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              {...(groupSize ? { groupSize } : {})}
              slogans={slogans}
              showSlogans={showSlogans}
              tagLabelMap={tagLabelMap}
              showDetail={showDetail}
              reviews={reviews}
              {...(reviewRating != null ? { reviewRating } : {})}
            />
          </div>

          <aside className="airbnb-detail-aside hidden lg:block">
            <div className="airbnb-detail-sticky">
              <ProductDetailAirbnbBookingCard
                productId={productId}
                basePrice={bookingPanelProps.basePrice}
                totalPrice={totalPrice}
                groupedChoices={bookingPanelProps.groupedChoices}
                selectedOptions={bookingPanelProps.selectedOptions}
                isEnglish={isEnglish}
                selectedDate={selectedDate}
                travelerCounts={travelerCounts}
                onDateChange={setSelectedDate}
                onTravelerCountsChange={setTravelerCounts}
                ageLimits={ageLimits}
                onBookNow={bookingPanelProps.onBookNow}
              />
              <TrustBadgeRow items={trustBadges} className="mt-4 justify-center" compact />
            </div>
          </aside>
        </div>

        <div className="mt-8 lg:hidden">
          <Link
            href={`/${locale}/products`}
            className="text-sm font-semibold text-[#1a2b49] underline underline-offset-4"
          >
            {t('backToProductList')}
          </Link>
        </div>
      </div>

      <ProductDetailMobileStickyCta totalPrice={totalPrice} onBookNow={bookingPanelProps.onBookNow} />
    </div>
  )
}
