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

export function mapTravelGuideArticle(row: TravelGuideArticleRow, locale: string): TravelGuideArticle {
  const isKo = locale === 'ko'
  return {
    id: row.id,
    slug: row.slug,
    title: isKo ? row.title_ko || row.title_en : row.title_en || row.title_ko,
    excerpt: isKo ? row.excerpt_ko || row.excerpt_en : row.excerpt_en || row.excerpt_ko,
    body: isKo ? row.body_ko || row.body_en : row.body_en || row.body_ko,
    category: isKo ? row.category_ko || row.category_en : row.category_en || row.category_ko,
    coverImageUrl: row.cover_image_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listPublishedTravelGuideArticles(options?: {
  locale?: string
  limit?: number
}): Promise<TravelGuideArticle[]> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en'
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100)
  const db = getDb()

  const { data, error } = await db
    .from('travel_guide_articles')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[travelGuideArticles] listPublished', error.message)
    return []
  }

  return (data as TravelGuideArticleRow[]).map((row) => mapTravelGuideArticle(row, locale))
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
  return mapTravelGuideArticle(data as TravelGuideArticleRow, locale)
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
