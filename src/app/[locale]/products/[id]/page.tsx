'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import ProductDetailImageGallery from '@/components/product/ProductDetailImageGallery'
import { useLocale } from 'next-intl'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import ProductDetailBookingSidebar from '@/components/product/ProductDetailBookingSidebar'
import ProductDetailHeader from '@/components/product/ProductDetailHeader'
import ProductDetailTabPanel from '@/components/product/ProductDetailTabPanel'
import ProductDetailHighlights from '@/components/product/ProductDetailHighlights'
import ProductDetailMobileBookingCard from '@/components/product/ProductDetailMobileBookingCard'
import ProductDetailMobileStickyCta from '@/components/product/ProductDetailMobileStickyCta'
import ProductDetailFaqSection from '@/components/product/ProductDetailFaqSection'
import ProductDetailReviewsSection, {
  type ProductReviewItem,
} from '@/components/product/ProductDetailReviewsSection'
import { fetchProductReviews } from '@/lib/fetchProductReviews'
import { ProductDetailErrorState, ProductDetailLoadingState } from '@/components/product/ProductDetailPageStates'
import ProductDetailCheckoutLayer, {
  useProductDetailCheckoutActions,
} from '@/components/product/ProductDetailCheckoutLayer'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import ProductDetailAirbnbView from '@/components/product/ProductDetailAirbnbView'
import type {
  Product,
  ProductChoice,
  ProductDetails,
  ProductMedia,
  ProductTourCourse,
  TourCoursePhoto,
} from '@/components/product/productDetailTypes'
import { fetchProductPageData } from '@/lib/fetchProductDetail'
import {
  formatProductDuration,
  getProductCategoryLabel,
  getProductCustomerDisplayName,
} from '@/lib/productDetailDisplay'
import {
  getPreviewDetailFieldHtml,
  getPreviewProductDisplayName,
} from '@/lib/customerPageDisplayFromBindings'
import { useCustomerPageDisplayBindings } from '@/hooks/useCustomerPageDisplayBindings'
import { fetchTagLabelMap, resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import { useProductDetailChoices } from '@/hooks/useProductDetailChoices'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import CustomerPageZoneLayoutGuideBar from '@/components/product/CustomerPageZoneLayoutGuideBar'
import CustomerPageZoneLayoutRenderer from '@/components/product/CustomerPageZoneLayoutRenderer'

function ProductDetailPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params.id as string
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const { active: bindingsActive, revision: bindingRevision } = useCustomerPageDisplayBindings()
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const layoutEditMode = isPreview && isEditMode

  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [tourCoursePhotos, setTourCoursePhotos] = useState<TourCoursePhoto[]>([])
  const [productMedia, setProductMedia] = useState<ProductMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagLabelMap, setTagLabelMap] = useState<TagLabelMap>({})
  const [productReviews, setProductReviews] = useState<ProductReviewItem[]>([])
  const [reviewRating, setReviewRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  const {
    showBookingFlow,
    setShowBookingFlow,
    showChoiceDescriptionModal,
    openBookingFlow,
    openChoiceDescriptionModal,
    closeChoiceDescriptionModal,
  } = useProductDetailCheckoutActions()

  const { selectedOptions, groupedChoices, totalPrice, handleOptionChange } =
    useProductDetailChoices(productChoices, product?.base_price, isEnglish)

  const showDetailOnCustomerPage = useCallback(
    (field: string) =>
      isProductDetailVisibleOnCustomerPage(
        productDetails?.customer_page_visibility,
        field
      ),
    [productDetails?.customer_page_visibility]
  )

  const loadProductData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!productId) return

      if (!options?.silent) {
        setLoading(true)
      }
      setError(null)

      const data = await fetchProductPageData(productId, locale, isEnglish)

      setProduct(data.product)
      setProductDetails(data.productDetails)
      setTourCourses(data.tourCourses)
      setProductChoices(data.productChoices)
      setProductMedia(data.productMedia)
      setTourCoursePhotos(data.tourCoursePhotos)
      setError(data.error)

      const reviewsData = await fetchProductReviews({
        productId: data.product?.id ?? productId,
        locale,
        limit: 12,
      })
      setProductReviews(reviewsData.reviews)
      setReviewRating(reviewsData.averageRating)
      setReviewCount(reviewsData.reviewCount)

      if (!options?.silent) {
        setLoading(false)
      }
    },
    [productId, locale, isEnglish]
  )

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await loadProductData()
      if (cancelled) return
    })()

    return () => {
      cancelled = true
    }
  }, [loadProductData])

  useCustomerPageSoftReload(() => loadProductData({ silent: true }))

  useEffect(() => {
    if (!product?.tags?.length) {
      setTagLabelMap({})
      return
    }
    void fetchTagLabelMap(product.tags).then(setTagLabelMap)
  }, [product?.tags])

  useEffect(() => {
    if (searchParams.get('preview') !== '1' || searchParams.get('openBooking') !== '1') return
    if (!product || loading) return
    const t = window.setTimeout(() => openBookingFlow(), 800)
    return () => window.clearTimeout(t)
  }, [searchParams, product, loading, openBookingFlow])

  if (loading) {
    return <ProductDetailLoadingState />
  }

  if (error || !product) {
    return <ProductDetailErrorState error={error} />
  }

  const displayName = (() => {
    void bindingRevision
    if (bindingsActive && product) {
      return getPreviewProductDisplayName('detail-header', product, locale)
    }
    return getProductCustomerDisplayName(product, locale)
  })()
  const categoryLabel = getProductCategoryLabel(product.category || '', isEnglish)
  const durationLabel = formatProductDuration(product.duration, isEnglish)
  const primaryTag = product.tags?.[0]
    ? resolveTagLabel(product.tags[0], locale, tagLabelMap)
    : null

  const tags = productDetails?.tags || product.tags || []
  const slogans = [
    productDetails?.slogan1,
    productDetails?.slogan2,
    productDetails?.slogan3,
  ]
  const showSlogans = Boolean(productDetails?.slogan1 && showDetailOnCustomerPage('slogan1'))

  const includedHtml = (() => {
    void bindingRevision
    if (bindingsActive) {
      return (
        getPreviewDetailFieldHtml(
          'detail-sidebar-included',
          'included',
          product as Record<string, unknown>,
          productDetails as Record<string, unknown> | null,
          productDetails?.included ?? null
        ) || null
      )
    }
    return productDetails?.included ?? null
  })()

  const notIncludedHtml = (() => {
    void bindingRevision
    if (bindingsActive) {
      return (
        getPreviewDetailFieldHtml(
          'detail-sidebar-included',
          'not_included',
          product as Record<string, unknown>,
          productDetails as Record<string, unknown> | null,
          productDetails?.not_included ?? null
        ) || null
      )
    }
    return productDetails?.not_included ?? null
  })()

  const bookingPanelProps = {
    basePrice: product.base_price,
    maxParticipants: product.max_participants,
    durationLabel,
    groupSize: product.group_size,
    totalPrice,
    groupedChoices,
    selectedOptions,
    includedHtml,
    notIncludedHtml,
    showIncluded: Boolean(includedHtml && showDetailOnCustomerPage('included')),
    showNotIncluded: Boolean(notIncludedHtml && showDetailOnCustomerPage('not_included')),
    isEnglish,
    onOptionChange: handleOptionChange,
    onCompareOptions: openChoiceDescriptionModal,
    onBookNow: openBookingFlow,
  }

  return (
    <CustomerPageShell locale={locale}>
      <div className={layoutEditMode ? 'min-h-screen bg-muted/30 pb-20 lg:pb-12' : ''}>
        <CustomerPagePreviewHighlightEffect />
      {layoutEditMode && <CustomerPageZoneLayoutGuideBar pageId="product-detail" />}
      {!layoutEditMode ? (
        <ProductDetailAirbnbView
          locale={locale}
          isEnglish={isEnglish}
          displayName={displayName}
          categoryLabel={categoryLabel}
          durationLabel={durationLabel}
          primaryTag={primaryTag}
          groupSize={product.group_size}
          productId={productId}
          product={product}
          productDetails={productDetails}
          productMedia={productMedia}
          tourCourses={tourCourses}
          tourCoursePhotos={tourCoursePhotos}
          slogans={slogans}
          showSlogans={showSlogans}
          tagLabelMap={tagLabelMap}
          showDetail={showDetailOnCustomerPage}
          reviews={productReviews}
          {...(reviewCount > 0 && reviewRating != null
            ? { reviewRating, reviewCount }
            : {})}
          totalPrice={totalPrice}
          bookingPanelProps={bookingPanelProps}
        />
      ) : (
      <CustomerPageZoneLayoutRenderer
        pageId="product-detail"
        layoutEditMode={layoutEditMode}
        productId={productId}
        renderBlock={(zoneId) => {
          if (zoneId === 'detail-header') {
            return (
              <ProductDetailHeader
                locale={locale}
                displayName={displayName}
                categoryLabel={categoryLabel}
                primaryTag={primaryTag}
                durationLabel={durationLabel}
                groupSize={product.group_size}
                totalPrice={totalPrice}
                {...(reviewCount > 0 && reviewRating != null
                  ? { reviewRating, reviewCount }
                  : {})}
                onBookNow={openBookingFlow}
              />
            )
          }

          if (zoneId === 'detail-gallery') {
            return (
              <ProductDetailImageGallery
                productMedia={productMedia}
                tourCoursePhotos={tourCoursePhotos}
                displayName={displayName}
                isEnglish={isEnglish}
              />
            )
          }

          if (zoneId === 'detail-mobile-booking') {
            return <ProductDetailMobileBookingCard {...bookingPanelProps} />
          }

          if (zoneId === 'detail-highlights') {
            return (
              <ProductDetailHighlights
                slogans={slogans}
                tags={tags}
                locale={locale}
                tagLabelMap={tagLabelMap}
                categoryLabel={categoryLabel}
                durationLabel={durationLabel}
                showSlogans={showSlogans}
              />
            )
          }

          if (zoneId === 'detail-tabs') {
            return (
              <ProductDetailTabPanel
                productId={productId}
                locale={locale}
                product={product}
                productDetails={productDetails}
                tourCourses={tourCourses}
                tourCoursePhotos={tourCoursePhotos}
                isEnglish={isEnglish}
                displayName={displayName}
                categoryLabel={categoryLabel}
                durationLabel={durationLabel}
                showDetail={showDetailOnCustomerPage}
              />
            )
          }

          if (zoneId === 'detail-reviews-section') {
            return (
              <ProductDetailReviewsSection
                reviews={productReviews}
                {...(reviewRating != null ? { averageRating: reviewRating } : {})}
              />
            )
          }

          if (zoneId === 'detail-faq-section') {
            return <ProductDetailFaqSection productId={productId} />
          }

          if (zoneId === 'detail-sidebar') {
            return <ProductDetailBookingSidebar {...bookingPanelProps} />
          }

          return null
        }}
      />
      )}

      {!layoutEditMode ? null : (
        <ProductDetailMobileStickyCta totalPrice={totalPrice} onBookNow={openBookingFlow} />
      )}

      <ProductDetailCheckoutLayer
        product={product}
        productChoices={productChoices}
        groupedChoices={groupedChoices}
        showBookingFlow={showBookingFlow}
        onCloseBookingFlow={() => setShowBookingFlow(false)}
        showChoiceDescriptionModal={showChoiceDescriptionModal}
        onCloseChoiceDescriptionModal={closeChoiceDescriptionModal}
      />
      </div>
    </CustomerPageShell>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailLoadingState />}>
      <ProductDetailPageInner />
    </Suspense>
  )
}
