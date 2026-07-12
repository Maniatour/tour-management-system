import { NextRequest, NextResponse } from 'next/server'
import { listPublishedTravelGuideArticles } from '@/lib/travelGuideArticles'

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || 'en'
  const limitParam = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '24', 10)
  const limit = Number.isFinite(limitParam) ? limitParam : 24

  const articles = await listPublishedTravelGuideArticles({ locale, limit })

  return NextResponse.json(
    { ok: true, articles },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }
  )
}
