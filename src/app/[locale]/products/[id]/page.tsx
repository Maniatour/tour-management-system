'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import ProductDetailImageGallery from '@/components/product/ProductDetailImageGallery'
import { useLocale } from 'next-intl'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import ProductDetailBookingSidebar from '@/components/product/ProductDetailBookingSidebar'
import ProductDetailHeader from '@/components/product/ProductDetailHeader'
import ProductDetailTabPanel from '@/components/product/ProductDetailTabPanel'
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
import { useProductDetailChoices } from '@/hooks/useProductDetailChoices'

export default function ProductDetailPage() {
  const params = useParams()
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

  if (loading) {
    return <ProductDetailLoadingState />
  }

  if (error || !product) {
    return <ProductDetailErrorState error={error} />
  }

  const displayName = getProductCustomerDisplayName(product, locale)
  const categoryLabel = getProductCategoryLabel(product.category || '', isEnglish)
  const durationLabel = formatProductDuration(product.duration, isEnglish)

  return (
    <div className="min-h-screen bg-gray-50">
      <ProductDetailHeader
        locale={locale}
        displayName={displayName}
        categoryLabel={categoryLabel}
        primaryTag={product.tags?.[0] ?? null}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ProductDetailImageGallery
              productMedia={productMedia}
              tourCoursePhotos={tourCoursePhotos}
              displayName={displayName}
              isEnglish={isEnglish}
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
          </div>

          <ProductDetailBookingSidebar
            basePrice={product.base_price}
            maxParticipants={product.max_participants}
            durationLabel={durationLabel}
            groupSize={product.group_size}
            totalPrice={totalPrice}
            groupedChoices={groupedChoices}
            selectedOptions={selectedOptions}
            includedHtml={productDetails?.included ?? null}
            notIncludedHtml={productDetails?.not_included ?? null}
            showIncluded={Boolean(productDetails?.included && showDetailOnCustomerPage('included'))}
            showNotIncluded={Boolean(productDetails?.not_included && showDetailOnCustomerPage('not_included'))}
            isEnglish={isEnglish}
            onOptionChange={handleOptionChange}
            onCompareOptions={openChoiceDescriptionModal}
            onBookNow={openBookingFlow}
          />
        </div>
      </div>

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
