'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tag } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductsGygCard from '@/components/products/ProductsGygCard'
import ProductsHorizontalScroll from '@/components/products/ProductsHorizontalScroll'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import {
  PRODUCT_RECOMMENDATION_SECTIONS,
  fetchProductRecommendations,
  getProductRecommendationTitle,
  type ProductRecommendationSectionKey,
  type ProductRecommendationView,
} from '@/lib/productRecommendations'
import {
  computeDiscountedPrice,
  formatBundleDiscountLabel,
} from '@/lib/productBundleDiscounts'

type ProductDetailRecommendationRailProps = {
  productId: string
  locale: string
  sectionKey: ProductRecommendationSectionKey
}

function formatUsd(price: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

function ProductDetailRecommendationRail({
  productId,
  locale,
  sectionKey,
}: ProductDetailRecommendationRailProps) {
  const section = PRODUCT_RECOMMENDATION_SECTIONS.find((item) => item.key === sectionKey)
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const showEmptyEditState = isPreview && isEditMode
  const isBundleSection = sectionKey === 'recommended_for_you'
  const [products, setProducts] = useState<ProductRecommendationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchProductRecommendations(productId, sectionKey, locale)
        if (!cancelled) setProducts(rows)
      } catch (err) {
        console.error('추천 상품 로드 오류:', err)
        if (!cancelled) {
          setError(
            locale === 'en' ? 'Unable to load bundle offers.' : '함께 구매 할인 상품을 불러오지 못했습니다.'
          )
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [locale, productId, sectionKey])

  if (!section) return null
  if (!loading && !error && products.length === 0 && !showEmptyEditState) return null

  const title = getProductRecommendationTitle(sectionKey, locale)
  const subtitle = isBundleSection
    ? locale === 'en'
      ? 'Book this tour with another experience below and save automatically at checkout.'
      : '아래 상품을 함께 예약하면 결제 시 자동으로 할인이 적용됩니다.'
    : null

  return (
    <CustomerPageZone zone={section.zone} productId={productId}>
      <section className="gyg-section product-detail-recommendation-rail">
        <div className="gyg-container">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="airbnb-detail-section-title mb-0">{title}</h2>
              {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[#6b7280]">
              {locale === 'en' ? 'Loading bundle offers...' : '함께 구매 할인 상품을 불러오는 중입니다...'}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-[#6b7280]">{error}</div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
              {locale === 'en'
                ? 'No bundle offers are configured yet.'
                : '아직 함께 구매 할인 상품이 없습니다. 수정 버튼으로 상품과 할인을 설정하세요.'}
            </div>
          ) : (
            <ProductsHorizontalScroll ariaLabel={title}>
              {products.map((product, index) => {
                const discountedPrice =
                  isBundleSection && product.discountType && product.discountValue
                    ? computeDiscountedPrice(product.price ?? 0, product.discountType, product.discountValue)
                    : null
                const bundleHref = `/${locale}/products/${product.id}?bundleFrom=${productId}`

                return (
                  <div key={product.id} className="gyg-listing-scroll-item">
                    <div className="relative">
                      {isBundleSection && product.discountType && product.discountValue ? (
                        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                          <Tag className="h-3.5 w-3.5" aria-hidden />
                          {formatBundleDiscountLabel(
                            product.discountType,
                            product.discountValue,
                            locale
                          )}
                        </span>
                      ) : null}
                      <ProductsGygCard
                        locale={locale}
                        href={bundleHref}
                        product={{
                          id: product.id,
                          primary_image: product.primary_image,
                          duration: product.duration,
                          max_participants: product.max_participants,
                          departure_city: product.departure_city,
                          tags: product.tags,
                        }}
                        title={product.title}
                        locationLine={product.locationLine}
                        price={discountedPrice ?? product.price ?? 0}
                        priceLabel={locale === 'en' ? 'From' : 'From'}
                        imageError={imageErrors.has(product.id)}
                        onImageError={() =>
                          setImageErrors((prev) => {
                            const next = new Set(prev)
                            next.add(product.id)
                            return next
                          })
                        }
                        likelyToSellOutLabel={locale === 'en' ? 'Likely to sell out' : '매진 임박'}
                        imagePreparingLabel={locale === 'en' ? 'Image coming soon' : '이미지 준비 중'}
                        priority={index < 3}
                        editableZones={false}
                      />
                      {isBundleSection && discountedPrice != null && product.price ? (
                        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
                          <span className="line-through">{formatUsd(product.price, locale)}</span>
                          <span className="mx-1 text-foreground">→</span>
                          <span className="font-semibold text-primary">
                            {formatUsd(discountedPrice, locale)}
                          </span>
                          <span className="ml-1">
                            {locale === 'en' ? 'with this tour' : '함께 예약 시'}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </ProductsHorizontalScroll>
          )}

          {isBundleSection && products.length > 0 ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {locale === 'en' ? (
                <>
                  Add both tours to your cart to unlock the bundle discount.{' '}
                  <Link href={`/${locale}/products/${productId}`} className="font-medium text-primary hover:underline">
                    Book this tour
                  </Link>{' '}
                  first, then select a discounted add-on above.
                </>
              ) : (
                <>
                  두 상품을 모두 장바구니에 담으면 할인이 적용됩니다.{' '}
                  <Link href={`/${locale}/products/${productId}`} className="font-medium text-primary hover:underline">
                    이 투어 예약
                  </Link>
                  후 위 할인 상품을 함께 담아 주세요.
                </>
              )}
            </p>
          ) : null}
        </div>
      </section>
    </CustomerPageZone>
  )
}

export default function ProductDetailRecommendations({
  productId,
  locale,
}: {
  productId: string
  locale: string
}) {
  return (
    <div className="product-detail-recommendations">
      {PRODUCT_RECOMMENDATION_SECTIONS.map((section) => (
        <ProductDetailRecommendationRail
          key={section.key}
          productId={productId}
          locale={locale}
          sectionKey={section.key}
        />
      ))}
    </div>
  )
}
