import { NextRequest, NextResponse } from 'next/server'
import { listPublishedTravelGuideArticles } from '@/lib/travelGuideArticles'

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || 'en'
  const limitParam = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '24', 10)
  const limit = Number.isFinite(limitParam) ? limitParam : 24
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  const articles = await listPublishedTravelGuideArticles({ locale, limit, query })

  return NextResponse.json(
    { ok: true, articles },
    {
      headers: {
        'Cache-Control': query
          ? 'public, s-maxage=60, stale-while-revalidate=300'
          : 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }
  )
}
