import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

export type ProductReviewsResult = {
  reviews: ProductReviewItem[]
  averageRating: number | null
  reviewCount: number
}

const emptyResult = (): ProductReviewsResult => ({
  reviews: [],
  averageRating: null,
  reviewCount: 0,
})

export async function fetchProductReviews(
  options: {
    productId?: string
    locale: string
    limit?: number
  }
): Promise<ProductReviewsResult> {
  const params = new URLSearchParams({
    locale: options.locale,
    limit: String(options.limit ?? 12),
  })

  if (options.productId) {
    params.set('product_id', options.productId)
  }

  try {
    const response = await fetch(`/api/public/product-reviews?${params.toString()}`)
    if (!response.ok) return emptyResult()

    const payload = (await response.json()) as {
      ok?: boolean
      reviews?: ProductReviewItem[]
      averageRating?: number | null
      reviewCount?: number
    }

    if (!payload.ok) return emptyResult()

    return {
      reviews: payload.reviews ?? [],
      averageRating: payload.averageRating ?? null,
      reviewCount: payload.reviewCount ?? payload.reviews?.length ?? 0,
    }
  } catch (error) {
    console.error('[fetchProductReviews]', error)
    return emptyResult()
  }
}
