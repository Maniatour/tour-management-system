'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
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
  resolveDisplayBasePrice,
} from '@/lib/productDetailDisplay'
import { getLowestChoiceAddonTotal, normalizeChoicesDisplayMode } from '@/lib/productChoiceGrouping'
import {
  getPreviewDetailFieldHtml,
  getPreviewProductDisplayName,
} from '@/lib/customerPageDisplayFromBindings'
import { useCustomerPageDisplayBindings } from '@/hooks/useCustomerPageDisplayBindings'
import { fetchTagLabelMap, resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import { useProductDetailChoices } from '@/hooks/useProductDetailChoices'
import {
  DEFAULT_TRAVELER_COUNTS,
  type TravelerCounts,
} from '@/lib/productDetailTravelers'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'

export type ProductDetailPageContentProps = {
  productId: string
  /** 관리자 편집 미리보기 언어 (미지정 시 라우트 locale) */
  contentLocale?: string
  /** 예약 플로우 비활성화 (관리자 편집 화면) */
  enableCheckout?: boolean
  /** 관리자 편집 화면 — 날짜 선택 전 옵션 영역 표시 */
  forceShowOptions?: boolean
  /** 관리자 편집 화면 — 날짜 선택 전 프로모 코드 영역 표시 */
  forceShowPromo?: boolean
}

function ProductDetailPageContentInner({
  productId,
  contentLocale,
  enableCheckout = true,
  forceShowOptions = false,
  forceShowPromo = false,
}: ProductDetailPageContentProps) {
  const searchParams = useSearchParams()
  const routeLocale = useLocale()
  const locale = contentLocale ?? routeLocale
  const isEnglish = locale === 'en'
  const { active: bindingsActive, revision: bindingRevision } = useCustomerPageDisplayBindings()
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const contentEditMode = isPreview && isEditMode
  /** 관리자 미리보기/편집 — inactive·draft 상품도 로드 */
  const isPreviewMode = isPreview || searchParams.get('preview') === '1'

  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [tourCoursePhotos, setTourCoursePhotos] = useState<TourCoursePhoto[]>([])
  const [productMedia, setProductMedia] = useState<ProductMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagLabelMap, setTagLabelMap] = useState<TagLabelMap>({})
  const [productReviews, setProductReviews] = useState<
    import('@/components/product/ProductDetailReviewsSection').ProductReviewItem[]
  >([])
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

  // 상세 페이지에서 선택한 날짜/인원 — 예약 모달로 그대로 전달하기 위해 상위에서 관리
  const [selectedDate, setSelectedDate] = useState('')
  const [travelerCounts, setTravelerCounts] = useState<TravelerCounts>(
    DEFAULT_TRAVELER_COUNTS
  )

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

      const data = await fetchProductPageData(productId, locale, isEnglish, {
        includeNonActive: isPreviewMode,
      })

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
    [productId, locale, isEnglish, isPreviewMode]
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
    if (!enableCheckout) return
    if (searchParams.get('preview') !== '1' || searchParams.get('openBooking') !== '1') return
    if (!product || loading) return
    const t = window.setTimeout(() => openBookingFlow(), 800)
    return () => window.clearTimeout(t)
  }, [enableCheckout, searchParams, product, loading, openBookingFlow])

  const lowestChoicePrice = useMemo(
    () => getLowestChoiceAddonTotal(productChoices),
    [productChoices]
  )

  const displayBasePrice = useMemo(
    () => resolveDisplayBasePrice(product?.base_price, lowestChoicePrice),
    [product?.base_price, lowestChoicePrice]
  )

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
    displayBasePrice,
    choicesDisplayMode: normalizeChoicesDisplayMode(product.choices_display_mode),
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
    onBookNow: enableCheckout ? openBookingFlow : () => {},
  }

  return (
    <CustomerPageShell locale={locale}>
      <div className={contentEditMode ? 'min-h-screen bg-muted/30 pb-20 lg:pb-12' : ''}>
        <CustomerPagePreviewHighlightEffect />
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
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          travelerCounts={travelerCounts}
          onTravelerCountsChange={setTravelerCounts}
          forceShowOptions={forceShowOptions}
          forceShowPromo={forceShowPromo || forceShowOptions}
          bookingPanelProps={bookingPanelProps}
        />

        {enableCheckout ? (
          <ProductDetailCheckoutLayer
            product={product}
            productChoices={productChoices}
            groupedChoices={groupedChoices}
            initialDate={selectedDate}
            initialParticipants={travelerCounts}
            initialSelectedOptions={selectedOptions}
            showBookingFlow={showBookingFlow}
            onCloseBookingFlow={() => setShowBookingFlow(false)}
            showChoiceDescriptionModal={showChoiceDescriptionModal}
            onCloseChoiceDescriptionModal={closeChoiceDescriptionModal}
          />
        ) : null}
      </div>
    </CustomerPageShell>
  )
}

export default function ProductDetailPageContent(props: ProductDetailPageContentProps) {
  return (
    <Suspense fallback={<ProductDetailLoadingState />}>
      <ProductDetailPageContentInner {...props} />
    </Suspense>
  )
}
