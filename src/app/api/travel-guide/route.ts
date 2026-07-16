import { NextRequest, NextResponse } from 'next/server'
import {
  createTravelGuideArticle,
  listAllTravelGuideArticlesForStaff,
  mapTravelGuideArticleRowsWithAuthors,
  slugifyTravelGuideTitle,
  type TravelGuideArticleInput,
} from '@/lib/travelGuideArticles'
import { requireTravelGuideStaff } from '@/lib/travelGuideStaffAuth'

function parseInput(body: unknown): TravelGuideArticleInput | null {
  if (!body || typeof body !== 'object') return null
  const row = body as Record<string, unknown>
  const titleEn = typeof row.titleEn === 'string' ? row.titleEn.trim() : ''
  if (!titleEn) return null

  const slugRaw = typeof row.slug === 'string' ? row.slug.trim() : ''
  const slug = slugRaw || slugifyTravelGuideTitle(titleEn)
  if (!slug) return null

  return {
    slug,
    titleEn,
    titleKo: typeof row.titleKo === 'string' ? row.titleKo.trim() : titleEn,
    excerptEn: typeof row.excerptEn === 'string' ? row.excerptEn : '',
    excerptKo: typeof row.excerptKo === 'string' ? row.excerptKo : '',
    bodyEn: typeof row.bodyEn === 'string' ? row.bodyEn : '',
    bodyKo: typeof row.bodyKo === 'string' ? row.bodyKo : '',
    categoryEn: typeof row.categoryEn === 'string' ? row.categoryEn : 'Travel Tips',
    categoryKo: typeof row.categoryKo === 'string' ? row.categoryKo : 'Travel Tips',
    coverImageUrl: typeof row.coverImageUrl === 'string' ? row.coverImageUrl : null,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    isPublished: row.isPublished === true,
  }
}

export async function GET(request: NextRequest) {
  const staff = await requireTravelGuideStaff(request)
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await listAllTravelGuideArticlesForStaff()
  const localeParam = request.nextUrl.searchParams.get('locale')?.trim()
  const locale = localeParam === 'ko' || localeParam === 'en' ? localeParam : null

  // Card/list views pass locale to get localized fields + author names.
  // Editor category loading keeps raw rows when locale is omitted.
  if (locale) {
    const articles = await mapTravelGuideArticleRowsWithAuthors(rows, locale)
    return NextResponse.json({ ok: true, articles })
  }

  return NextResponse.json({ ok: true, articles: rows })
}

export async function POST(request: NextRequest) {
  const staff = await requireTravelGuideStaff(request)
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = parseInput(body)
  if (!input) {
    return NextResponse.json({ error: 'titleEn and slug are required' }, { status: 400 })
  }

  const article = await createTravelGuideArticle(input, staff.user.id)
  if (!article) {
    return NextResponse.json(
      {
        error:
          'Failed to create article. The URL slug may already be in use — try a slightly different English title.',
        code: 'create_failed',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, article })
}
