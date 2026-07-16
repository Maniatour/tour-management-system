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
        // Keep short so newly published articles appear on the public listing quickly.
        'Cache-Control': query
          ? 'public, s-maxage=30, stale-while-revalidate=120'
          : 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
