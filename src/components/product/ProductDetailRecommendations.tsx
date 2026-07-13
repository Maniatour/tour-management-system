'use client'

import { useEffect, useState } from 'react'
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

type ProductDetailRecommendationRailProps = {
  productId: string
  locale: string
  sectionKey: ProductRecommendationSectionKey
}

function ProductDetailRecommendationRail({
  productId,
  locale,
  sectionKey,
}: ProductDetailRecommendationRailProps) {
  const section = PRODUCT_RECOMMENDATION_SECTIONS.find((item) => item.key === sectionKey)
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const showEmptyEditState = isPreview && isEditMode
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
          setError(locale === 'en' ? 'Unable to load recommendations.' : '추천 상품을 불러오지 못했습니다.')
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

  return (
    <CustomerPageZone zone={section.zone} productId={productId}>
      <section className="gyg-section product-detail-recommendation-rail">
        <div className="gyg-container">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="gyg-section-title mb-0">{title}</h2>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[#6b7280]">
              {locale === 'en' ? 'Loading recommendations...' : '추천 상품을 불러오는 중입니다...'}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-[#6b7280]">{error}</div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
              {locale === 'en'
                ? 'No products are selected for this recommendation section yet.'
                : '아직 이 추천 영역에 선택된 상품이 없습니다. 수정 버튼으로 상품을 추가하세요.'}
            </div>
          ) : (
            <ProductsHorizontalScroll ariaLabel={title}>
              {products.map((product, index) => (
                <div key={product.id} className="gyg-listing-scroll-item">
                  <ProductsGygCard
                    locale={locale}
                    href={`/${locale}/products/${product.id}`}
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
                    price={product.price ?? 0}
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
                </div>
              ))}
            </ProductsHorizontalScroll>
          )}
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
