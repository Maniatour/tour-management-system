import { NextRequest, NextResponse } from 'next/server'
import { fetchGooglePlaceReviews } from '@/lib/googlePlaceReviews'

const DEFAULT_LIMIT = 6
const MAX_LIMIT = 10

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || 'en'
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10
  )
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const result = await fetchGooglePlaceReviews({ locale, limit })

  return NextResponse.json(
    {
      ok: true,
      reviews: result.reviews,
      averageRating: result.averageRating,
      reviewCount: result.reviewCount,
      placeName: result.placeName,
      mapsUrl: result.mapsUrl,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
