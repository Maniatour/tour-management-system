import { NextRequest, NextResponse } from 'next/server'
import {
  deleteTravelGuideArticle,
  getTravelGuideArticleById,
  slugifyTravelGuideTitle,
  updateTravelGuideArticle,
  type TravelGuideArticleInput,
} from '@/lib/travelGuideArticles'
import { requireTravelGuideStaff } from '@/lib/travelGuideStaffAuth'

type RouteContext = {
  params: Promise<{ id: string }>
}

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

export async function GET(_request: NextRequest, context: RouteContext) {
  const staff = await requireTravelGuideStaff(_request)
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const article = await getTravelGuideArticleById(id)
  if (!article) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, article })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const staff = await requireTravelGuideStaff(request)
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

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

  const article = await updateTravelGuideArticle(id, input, staff.user.id)
  if (!article) {
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, article })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const staff = await requireTravelGuideStaff(request)
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const ok = await deleteTravelGuideArticle(id)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
