'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Heart, Share2, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailAirbnbGallery from '@/components/product/ProductDetailAirbnbGallery'
import ProductDetailAirbnbBody from '@/components/product/ProductDetailAirbnbBody'
import ProductDetailAirbnbBookingCard from '@/components/product/ProductDetailAirbnbBookingCard'
import ProductDetailAirbnbOptionsSection from '@/components/product/ProductDetailAirbnbOptionsSection'
import ProductDetailDateTravelersPickers from '@/components/product/ProductDetailDateTravelersPickers'
import ProductDetailMobileStickyCta from '@/components/product/ProductDetailMobileStickyCta'
import ProductDetailPromoCodesBox from '@/components/product/ProductDetailPromoCodesBox'
import ProductDetailRecommendations from '@/components/product/ProductDetailRecommendations'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ReviewSummary from '@/components/customer/ui/ReviewSummary'
import { useProductDetailAppliedPromo } from '@/hooks/useProductDetailAppliedPromo'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import {
  DEFAULT_TRAVELER_AGE_LIMITS,
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
  tagLabelMap: TagLabelMap
  showDetail: (field: string) => boolean
  reviews: ProductReviewItem[]
  reviewRating?: number
  reviewCount?: number
  totalPrice: number
  /** 상세 페이지에서 선택한 날짜 (예약 모달로 그대로 전달) */
  selectedDate: string
  onSelectedDateChange: (date: string) => void
  /** 상세 페이지에서 선택한 인원 (예약 모달로 그대로 전달) */
  travelerCounts: TravelerCounts
  onTravelerCountsChange: (counts: TravelerCounts) => void
  /** 관리자 직접 편집 화면에서는 날짜 선택 전에도 옵션 영역 표시 */
  forceShowOptions?: boolean
  /** 관리자 직접 편집 화면에서는 날짜 선택 전에도 프로모 코드 영역 표시 */
  forceShowPromo?: boolean
  bookingPanelProps: {
    basePrice: number | null
    /** 기본가가 0일 때 초이스 최저가를 반영한 표시용 가격 */
    displayBasePrice: number
    /** 상품 초이스 표시 방식: list(리스트) | card(사진 카드뷰) */
    choicesDisplayMode: 'list' | 'card'
    maxParticipants: number | null
    durationLabel: string
    groupSize: string | null
    totalPrice: number
    groupedChoices: Record<string, ProductDetailChoiceGroup>
    selectedOptions: Record<string, string>
    selectedChoiceQuantities?: Record<string, Record<string, number>>
    partySize?: number
    includedHtml?: string | null
    notIncludedHtml?: string | null
    showIncluded: boolean
    showNotIncluded: boolean
    isEnglish: boolean
    onOptionChange: (choiceId: string, optionId: string) => void
    onQuantityChange?: (choiceId: string, optionId: string, quantity: number) => void
    onCompareOptions: () => void
    onBookNow: () => void
    bookDisabled?: boolean
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
  tagLabelMap,
  showDetail,
  reviews,
  reviewRating,
  reviewCount,
  totalPrice,
  selectedDate,
  onSelectedDateChange: setSelectedDate,
  travelerCounts,
  onTravelerCountsChange: setTravelerCounts,
  forceShowOptions = false,
  forceShowPromo = false,
  bookingPanelProps,
}: ProductDetailAirbnbViewProps) {
  const t = useTranslations('productDetail')
  const trustBadges = useProductDetailTrustBadges()
  const optionsAnchorRef = useRef<HTMLDivElement>(null)
  const previousDateRef = useRef('')
  const locationLine = product.departure_city || 'Las Vegas'
  const promo = useProductDetailAppliedPromo(
    productId,
    bookingPanelProps.basePrice,
    totalPrice
  )

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
        <CustomerPageZone zone="detail-header" productId={productId}>
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
        </CustomerPageZone>

        <CustomerPageZone zone="detail-gallery" productId={productId}>
          <ProductDetailAirbnbGallery
            productMedia={productMedia}
            tourCoursePhotos={tourCoursePhotos}
            displayName={displayName}
            isEnglish={isEnglish}
          />
        </CustomerPageZone>

        <div className="airbnb-detail-layout">
          <div className="airbnb-detail-main">
            <div className="airbnb-detail-mobile-booking lg:hidden">
              <ProductDetailDateTravelersPickers
                productId={productId}
                product={product}
                customerTourName={displayName}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                travelerCounts={travelerCounts}
                onTravelerCountsChange={setTravelerCounts}
                ageLimits={ageLimits}
              />
            </div>

            {selectedDate || forceShowOptions ? (
              <div ref={optionsAnchorRef} className="airbnb-detail-options-anchor">
                <CustomerPageZone zone="detail-sidebar-options" productId={productId}>
                  {Object.keys(bookingPanelProps.groupedChoices).length > 0 ? (
                    <ProductDetailAirbnbOptionsSection
                      groupedChoices={bookingPanelProps.groupedChoices}
                      selectedOptions={bookingPanelProps.selectedOptions}
                      {...(bookingPanelProps.selectedChoiceQuantities
                        ? {
                            selectedChoiceQuantities:
                              bookingPanelProps.selectedChoiceQuantities,
                          }
                        : {})}
                      {...(bookingPanelProps.partySize != null
                        ? { partySize: bookingPanelProps.partySize }
                        : {})}
                      displayMode={bookingPanelProps.choicesDisplayMode}
                      onOptionChange={bookingPanelProps.onOptionChange}
                      {...(bookingPanelProps.onQuantityChange
                        ? { onQuantityChange: bookingPanelProps.onQuantityChange }
                        : {})}
                      onCompareOptions={bookingPanelProps.onCompareOptions}
                      onBookNow={bookingPanelProps.onBookNow}
                      totalPrice={totalPrice}
                      displayTotalPrice={promo.displayTotalPrice}
                      promoDiscountAmount={promo.discountAmount}
                      appliedPromoCode={promo.appliedCoupon?.code ?? null}
                      selectedDate={selectedDate || 'admin-preview'}
                      isEnglish={isEnglish}
                      {...(bookingPanelProps.bookDisabled != null
                        ? { bookDisabled: bookingPanelProps.bookDisabled }
                        : {})}
                    />
                  ) : (
                    <section className="airbnb-detail-section airbnb-detail-options airbnb-detail-options-panel">
                      <h2 className="airbnb-detail-section-title mb-2">
                        {t('bookingOptionsTitle')}
                      </h2>
                      <p className="text-sm text-[#6b7280]">
                        {isEnglish
                          ? 'No choices or options have been configured yet.'
                          : '아직 설정된 초이스 또는 옵션이 없습니다.'}
                      </p>
                    </section>
                  )}
                </CustomerPageZone>
                <CustomerPageZone zone="detail-promo-codes" productId={productId}>
                  <div className="mt-4 lg:hidden">
                    <ProductDetailPromoCodesBox productId={productId} promo={promo} />
                  </div>
                </CustomerPageZone>
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
              tagLabelMap={tagLabelMap}
              showDetail={showDetail}
              reviews={reviews}
              selectedDate={selectedDate}
              {...(reviewRating != null ? { reviewRating } : {})}
            />
          </div>

          <aside className="airbnb-detail-aside hidden lg:block">
            <div className="airbnb-detail-sticky">
              <CustomerPageZone zone="detail-sidebar" productId={productId}>
                <ProductDetailAirbnbBookingCard
                  productId={productId}
                  product={product}
                  customerTourName={displayName}
                  basePrice={bookingPanelProps.basePrice}
                  displayBasePrice={bookingPanelProps.displayBasePrice}
                  totalPrice={totalPrice}
                  groupedChoices={bookingPanelProps.groupedChoices}
                  selectedOptions={bookingPanelProps.selectedOptions}
                  {...(bookingPanelProps.selectedChoiceQuantities
                    ? {
                        selectedChoiceQuantities:
                          bookingPanelProps.selectedChoiceQuantities,
                      }
                    : {})}
                  isEnglish={isEnglish}
                  selectedDate={selectedDate}
                  travelerCounts={travelerCounts}
                  onDateChange={setSelectedDate}
                  onTravelerCountsChange={setTravelerCounts}
                  ageLimits={ageLimits}
                  onBookNow={bookingPanelProps.onBookNow}
                  promo={promo}
                  forceShowPromo={forceShowPromo}
                  {...(bookingPanelProps.bookDisabled != null
                    ? { bookDisabled: bookingPanelProps.bookDisabled }
                    : {})}
                />
              </CustomerPageZone>
              <TrustBadgeRow items={trustBadges} className="mt-4 justify-center" compact />
            </div>
          </aside>
        </div>

        <ProductDetailRecommendations productId={productId} locale={locale} />

        <div className="mt-8 lg:hidden">
          <Link
            href={`/${locale}/products`}
            className="text-sm font-semibold text-[#1a2b49] underline underline-offset-4"
          >
            {t('backToProductList')}
          </Link>
        </div>
      </div>

      <ProductDetailMobileStickyCta
        totalPrice={promo.displayTotalPrice}
        {...(promo.hasPromoApplied ? { originalTotalPrice: totalPrice } : {})}
        onBookNow={bookingPanelProps.onBookNow}
      />
    </div>
  )
}
