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
import { ProductDetailErrorState, ProductDetailLoadingState } from '@/components/product/ProductDetailPageStates'
import ProductDetailCheckoutLayer, {
  useProductDetailCheckoutActions,
} from '@/components/product/ProductDetailCheckoutLayer'
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
import { fetchTagLabelMap, resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import { useProductDetailChoices } from '@/hooks/useProductDetailChoices'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'

function ProductDetailPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params.id as string
  const locale = useLocale()
  const isEnglish = locale === 'en'

  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [tourCoursePhotos, setTourCoursePhotos] = useState<TourCoursePhoto[]>([])
  const [productMedia, setProductMedia] = useState<ProductMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagLabelMap, setTagLabelMap] = useState<TagLabelMap>({})

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

  useEffect(() => {
    if (!productId) return

    let cancelled = false

    const loadProductData = async () => {
      setLoading(true)
      setError(null)

      const data = await fetchProductPageData(productId, locale, isEnglish)
      if (cancelled) return

      setProduct(data.product)
      setProductDetails(data.productDetails)
      setTourCourses(data.tourCourses)
      setProductChoices(data.productChoices)
      setProductMedia(data.productMedia)
      setTourCoursePhotos(data.tourCoursePhotos)
      setError(data.error)
      setLoading(false)
    }

    loadProductData()

    return () => {
      cancelled = true
    }
  }, [productId, locale, isEnglish])

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

  const displayName = getProductCustomerDisplayName(product, locale)
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

  const bookingPanelProps = {
    basePrice: product.base_price,
    maxParticipants: product.max_participants,
    durationLabel,
    groupSize: product.group_size,
    totalPrice,
    groupedChoices,
    selectedOptions,
    includedHtml: productDetails?.included ?? null,
    notIncludedHtml: productDetails?.not_included ?? null,
    showIncluded: Boolean(productDetails?.included && showDetailOnCustomerPage('included')),
    showNotIncluded: Boolean(productDetails?.not_included && showDetailOnCustomerPage('not_included')),
    isEnglish,
    onOptionChange: handleOptionChange,
    onCompareOptions: openChoiceDescriptionModal,
    onBookNow: openBookingFlow,
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-12">
      <CustomerPagePreviewHighlightEffect />
      <ProductDetailHeader
        locale={locale}
        displayName={displayName}
        categoryLabel={categoryLabel}
        primaryTag={primaryTag}
        durationLabel={durationLabel}
        groupSize={product.group_size}
        totalPrice={totalPrice}
        onBookNow={openBookingFlow}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-6 lg:col-span-2 lg:space-y-8">
            <ProductDetailImageGallery
              productMedia={productMedia}
              tourCoursePhotos={tourCoursePhotos}
              displayName={displayName}
              isEnglish={isEnglish}
            />

            <ProductDetailMobileBookingCard {...bookingPanelProps} />

            <ProductDetailHighlights
              slogans={slogans}
              tags={tags}
              locale={locale}
              tagLabelMap={tagLabelMap}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              showSlogans={showSlogans}
            />

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

            <ProductDetailFaqSection productId={productId} />
          </div>

          <ProductDetailBookingSidebar {...bookingPanelProps} />
        </div>
      </div>

      <ProductDetailMobileStickyCta totalPrice={totalPrice} onBookNow={openBookingFlow} />

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
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailLoadingState />}>
      <ProductDetailPageInner />
    </Suspense>
  )
}
