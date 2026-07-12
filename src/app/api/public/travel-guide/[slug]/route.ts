import { NextRequest, NextResponse } from 'next/server'
import { getPublishedTravelGuideArticleBySlug } from '@/lib/travelGuideArticles'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || 'en'

  const article = await getPublishedTravelGuideArticleBySlug(slug, locale)
  if (!article) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    { ok: true, article },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }
  )
}
