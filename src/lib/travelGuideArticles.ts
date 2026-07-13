import { resolveTravelGuideAuthorNames } from '@/lib/travelGuideAuthorDisplay'
import { pickTravelGuideLocalizedField } from '@/lib/travelGuideEditorLocales'
import { filterTravelGuideRowsByQuery } from '@/lib/travelGuideSearch'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export type TravelGuideArticleRow = {
  id: string
  slug: string
  title_en: string
  title_ko: string
  excerpt_en: string
  excerpt_ko: string
  body_en: string
  body_ko: string
  category_en: string
  category_ko: string
  cover_image_url: string | null
  sort_order: number
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type TravelGuideArticle = {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  category: string
  coverImageUrl: string | null
  sortOrder: number
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  authorName: string | null
}

export type TravelGuideArticleInput = {
  slug: string
  titleEn: string
  titleKo: string
  excerptEn?: string
  excerptKo?: string
  bodyEn?: string
  bodyKo?: string
  categoryEn?: string
  categoryKo?: string
  coverImageUrl?: string | null
  sortOrder?: number
  isPublished?: boolean
}

function getDb() {
  return (supabaseAdmin ?? supabase) as any
}

export function slugifyTravelGuideTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** 목록·카드용 요약 — 본문에서 자동 생성 */
export function deriveTravelGuideExcerpt(body: string, maxLength = 160): string {
  const plain = body
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) return ''
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trim()}…`
}

export function mapTravelGuideArticle(
  row: TravelGuideArticleRow,
  locale: string,
  authorName: string | null = null
): TravelGuideArticle {
  const titles = { en: row.title_en, ko: row.title_ko }
  const excerpts = { en: row.excerpt_en, ko: row.excerpt_ko }
  const bodies = { en: row.body_en, ko: row.body_ko }
  const categories = { en: row.category_en, ko: row.category_ko }

  return {
    id: row.id,
    slug: row.slug,
    title: pickTravelGuideLocalizedField(locale, titles),
    excerpt: pickTravelGuideLocalizedField(locale, excerpts),
    body: pickTravelGuideLocalizedField(locale, bodies),
    category: pickTravelGuideLocalizedField(locale, categories),
    coverImageUrl: row.cover_image_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName,
  }
}

export async function listPublishedTravelGuideArticles(options?: {
  locale?: string
  limit?: number
  query?: string
}): Promise<TravelGuideArticle[]> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en'
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100)
  const query = options?.query?.trim() ?? ''
  const db = getDb()

  const { data, error } = await db
    .from('travel_guide_articles')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(query ? 100 : limit)

  if (error) {
    console.error('[travelGuideArticles] listPublished', error.message)
    return []
  }

  const rows = filterTravelGuideRowsByQuery((data ?? []) as TravelGuideArticleRow[], query).slice(
    0,
    limit
  )
  const authorMap = await resolveTravelGuideAuthorNames(
    rows.map((row) => row.created_by),
    locale
  )

  return rows.map((row) =>
    mapTravelGuideArticle(row, locale, authorMap.get(row.created_by ?? '') ?? null)
  )
}

export async function getPublishedTravelGuideArticleBySlug(
  slug: string,
  locale: string
): Promise<TravelGuideArticle | null> {
  const db = getDb()
  const { data, error } = await db
    .from('travel_guide_articles')
    .select('*')
    .eq('slug', slug.trim())
    .eq('is_published', true)
    .maybeSingle()

  if (error) {
    console.error('[travelGuideArticles] getPublishedBySlug', error.message)
    return null
  }

  if (!data) return null

  const row = data as TravelGuideArticleRow
  const authorMap = await resolveTravelGuideAuthorNames([row.created_by], locale)
  return mapTravelGuideArticle(row, locale, authorMap.get(row.created_by ?? '') ?? null)
}

export async function listAllTravelGuideArticlesForStaff(): Promise<TravelGuideArticleRow[]> {
  const db = getDb()
  const { data, error } = await db
    .from('travel_guide_articles')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[travelGuideArticles] listAllForStaff', error.message)
    return []
  }

  return (data ?? []) as TravelGuideArticleRow[]
}

export async function getTravelGuideArticleById(id: string): Promise<TravelGuideArticleRow | null> {
  const db = getDb()
  const { data, error } = await db.from('travel_guide_articles').select('*').eq('id', id).maybeSingle()

  if (error) {
    console.error('[travelGuideArticles] getById', error.message)
    return null
  }

  return (data as TravelGuideArticleRow | null) ?? null
}

export async function createTravelGuideArticle(
  input: TravelGuideArticleInput,
  userId: string | null
): Promise<TravelGuideArticleRow | null> {
  const db = getDb()
  const isPublished = input.isPublished ?? false
  const now = new Date().toISOString()

  const payload = {
    slug: input.slug.trim(),
    title_en: input.titleEn.trim(),
    title_ko: input.titleKo.trim() || input.titleEn.trim(),
    excerpt_en: input.excerptEn?.trim() ?? '',
    excerpt_ko: input.excerptKo?.trim() ?? '',
    body_en: input.bodyEn?.trim() ?? '',
    body_ko: input.bodyKo?.trim() ?? '',
    category_en: input.categoryEn?.trim() || 'Travel Tips',
    category_ko: input.categoryKo?.trim() || 'Travel Tips',
    cover_image_url: input.coverImageUrl?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    is_published: isPublished,
    published_at: isPublished ? now : null,
    created_by: userId,
    updated_by: userId,
  }

  const { data, error } = await db.from('travel_guide_articles').insert(payload).select('*').single()

  if (error) {
    console.error('[travelGuideArticles] create', error.message)
    return null
  }

  return data as TravelGuideArticleRow
}

export async function updateTravelGuideArticle(
  id: string,
  input: TravelGuideArticleInput,
  userId: string | null
): Promise<TravelGuideArticleRow | null> {
  const db = getDb()
  const existing = await getTravelGuideArticleById(id)
  if (!existing) return null

  const isPublished = input.isPublished ?? existing.is_published
  const publishedAt =
    isPublished && !existing.published_at ? new Date().toISOString() : existing.published_at

  const payload = {
    slug: input.slug.trim(),
    title_en: input.titleEn.trim(),
    title_ko: input.titleKo.trim() || input.titleEn.trim(),
    excerpt_en: input.excerptEn?.trim() ?? '',
    excerpt_ko: input.excerptKo?.trim() ?? '',
    body_en: input.bodyEn?.trim() ?? '',
    body_ko: input.bodyKo?.trim() ?? '',
    category_en: input.categoryEn?.trim() || 'Travel Tips',
    category_ko: input.categoryKo?.trim() || 'Travel Tips',
    cover_image_url: input.coverImageUrl?.trim() || null,
    sort_order: input.sortOrder ?? existing.sort_order,
    is_published: isPublished,
    published_at: isPublished ? publishedAt : null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }

  const { data, error } = await db
    .from('travel_guide_articles')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[travelGuideArticles] update', error.message)
    return null
  }

  return data as TravelGuideArticleRow
}

export async function deleteTravelGuideArticle(id: string): Promise<boolean> {
  const db = getDb()
  const { error } = await db.from('travel_guide_articles').delete().eq('id', id)
  if (error) {
    console.error('[travelGuideArticles] delete', error.message)
    return false
  }
  return true
}
