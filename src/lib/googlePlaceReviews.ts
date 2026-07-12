import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

export type GooglePlaceReviewsResult = {
  reviews: ProductReviewItem[]
  averageRating: number | null
  reviewCount: number
  placeName: string | null
  mapsUrl: string | null
}

type GooglePlaceReviewRow = {
  author_name?: string
  rating?: number
  text?: string
  relative_time_description?: string
  time?: number
  author_url?: string
  profile_photo_url?: string
}

type GooglePlaceDetailsResponse = {
  status?: string
  error_message?: string
  result?: {
    name?: string
    rating?: number
    user_ratings_total?: number
    url?: string
    reviews?: GooglePlaceReviewRow[]
  }
}

const DEFAULT_MANIA_TOUR_PLACE_ID = 'ChIJ7W4fZpfGyIARL1o2YnYWOmE'

const CACHE_TTL_MS = 60 * 60 * 1000

let cachedPayload: {
  cacheKey: string
  expiresAt: number
  data: GooglePlaceReviewsResult
} | null = null

export function getGoogleBusinessPlaceId(): string {
  return process.env.GOOGLE_BUSINESS_PLACE_ID?.trim() || DEFAULT_MANIA_TOUR_PLACE_ID
}

export function getGoogleMapsServerApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    null
  )
}

function mapGoogleReviewRows(
  rows: GooglePlaceReviewRow[],
  locale: string
): ProductReviewItem[] {
  return rows
    .filter((row) => typeof row.text === 'string' && row.text.trim().length > 0)
    .map((row) => {
      const rating = typeof row.rating === 'number' ? Math.round(row.rating) : 5
      const date =
        row.relative_time_description?.trim() ||
        (row.time
          ? new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
              year: 'numeric',
              month: 'short',
            }).format(new Date(row.time * 1000))
          : undefined)

      return {
        name: row.author_name?.trim() || 'Google User',
        country: 'Google',
        rating: Math.min(Math.max(rating, 1), 5),
        quote: row.text!.trim(),
        ...(date ? { date } : {}),
        source: 'google' as const,
        ...(row.author_url ? { sourceUrl: row.author_url } : {}),
        ...(row.profile_photo_url ? { avatarUrl: row.profile_photo_url } : {}),
      }
    })
}

export async function fetchGooglePlaceReviews(options: {
  locale: string
  limit?: number
  placeId?: string
}): Promise<GooglePlaceReviewsResult> {
  const placeId = options.placeId?.trim() || getGoogleBusinessPlaceId()
  const apiKey = getGoogleMapsServerApiKey()
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 10)
  const locale = options.locale === 'ko' ? 'ko' : 'en'
  const cacheKey = `${placeId}:${locale}:${limit}`

  if (cachedPayload && cachedPayload.cacheKey === cacheKey && cachedPayload.expiresAt > Date.now()) {
    return cachedPayload.data
  }

  const emptyResult: GooglePlaceReviewsResult = {
    reviews: [],
    averageRating: null,
    reviewCount: 0,
    placeName: null,
    mapsUrl: null,
  }

  if (!apiKey) {
    console.warn('[googlePlaceReviews] Missing Google Maps API key')
    return emptyResult
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'name,rating,user_ratings_total,url,reviews')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', locale)

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      console.error('[googlePlaceReviews] HTTP error', response.status)
      return emptyResult
    }

    const payload = (await response.json()) as GooglePlaceDetailsResponse

    if (payload.status !== 'OK' || !payload.result) {
      console.error('[googlePlaceReviews] API status', payload.status, payload.error_message)
      return emptyResult
    }

    const reviews = mapGoogleReviewRows(payload.result.reviews ?? [], locale).slice(0, limit)

    const result: GooglePlaceReviewsResult = {
      reviews,
      averageRating:
        typeof payload.result.rating === 'number' ? payload.result.rating : null,
      reviewCount:
        typeof payload.result.user_ratings_total === 'number'
          ? payload.result.user_ratings_total
          : reviews.length,
      placeName: payload.result.name?.trim() || null,
      mapsUrl: payload.result.url?.trim() || null,
    }

    cachedPayload = {
      cacheKey,
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: result,
    }

    return result
  } catch (error) {
    console.error('[googlePlaceReviews] fetch failed', error)
    return emptyResult
  }
}
