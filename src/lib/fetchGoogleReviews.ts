import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

export type GoogleReviewsResult = {
  reviews: ProductReviewItem[]
  averageRating: number | null
  reviewCount: number
  placeName: string | null
  mapsUrl: string | null
}

const emptyResult = (): GoogleReviewsResult => ({
  reviews: [],
  averageRating: null,
  reviewCount: 0,
  placeName: null,
  mapsUrl: null,
})

export async function fetchGoogleReviews(options: {
  locale: string
  limit?: number
}): Promise<GoogleReviewsResult> {
  const params = new URLSearchParams({
    locale: options.locale,
    limit: String(options.limit ?? 6),
  })

  try {
    const response = await fetch(`/api/public/google-reviews?${params.toString()}`)
    if (!response.ok) return emptyResult()

    const payload = (await response.json()) as {
      ok?: boolean
      reviews?: ProductReviewItem[]
      averageRating?: number | null
      reviewCount?: number
      placeName?: string | null
      mapsUrl?: string | null
    }

    if (!payload.ok) return emptyResult()

    return {
      reviews: payload.reviews ?? [],
      averageRating: payload.averageRating ?? null,
      reviewCount: payload.reviewCount ?? payload.reviews?.length ?? 0,
      placeName: payload.placeName ?? null,
      mapsUrl: payload.mapsUrl ?? null,
    }
  } catch (error) {
    console.error('[fetchGoogleReviews]', error)
    return emptyResult()
  }
}
