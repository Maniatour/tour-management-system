import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import JsonLd from '@/components/seo/JsonLd'
import {
  buildArticleJsonLd,
  buildCustomerPageMetadata,
  getCustomerSeoCopy,
  truncateSeoText,
} from '@/lib/customerSeo'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { normalizeSiteLocale } from '@/lib/siteLocales'

type GuideRow = {
  slug: string
  title_en: string | null
  title_ko: string | null
  excerpt_en: string | null
  excerpt_ko: string | null
  cover_image_url: string | null
  published_at: string | null
  updated_at: string | null
  is_published: boolean | null
}

async function loadGuideSeo(locale: string, slug: string) {
  const siteLocale = normalizeSiteLocale(locale)
  const copy = getCustomerSeoCopy(siteLocale)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      siteLocale,
      title: copy.travelGuideTitle,
      description: copy.travelGuideDescription,
      imageUrl: null as string | null,
      publishedAt: null as string | null,
      updatedAt: null as string | null,
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await fromUntypedTable(supabase, 'travel_guide_articles')
      .select(
        'slug, title_en, title_ko, excerpt_en, excerpt_ko, cover_image_url, published_at, updated_at, is_published'
      )
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()

    const row = data as GuideRow | null
    if (!row) {
      return {
        siteLocale,
        title: copy.travelGuideTitle,
        description: copy.travelGuideDescription,
        imageUrl: null,
        publishedAt: null,
        updatedAt: null,
      }
    }

    const title =
      (siteLocale === 'ko' ? row.title_ko : row.title_en)?.trim() ||
      row.title_en?.trim() ||
      row.title_ko?.trim() ||
      copy.travelGuideTitle

    const excerpt =
      (siteLocale === 'ko' ? row.excerpt_ko : row.excerpt_en)?.trim() ||
      row.excerpt_en?.trim() ||
      row.excerpt_ko?.trim() ||
      copy.travelGuideDescription

    return {
      siteLocale,
      title,
      description: truncateSeoText(excerpt),
      imageUrl: row.cover_image_url,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
    }
  } catch {
    return {
      siteLocale,
      title: copy.travelGuideTitle,
      description: copy.travelGuideDescription,
      imageUrl: null,
      publishedAt: null,
      updatedAt: null,
    }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const seo = await loadGuideSeo(locale, slug)

  return buildCustomerPageMetadata({
    locale: seo.siteLocale,
    path: `/travel-guide/${slug}`,
    title: seo.title,
    description: seo.description,
    imageUrl: seo.imageUrl,
    type: 'article',
  })
}

export default async function TravelGuideArticleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const seo = await loadGuideSeo(locale, slug)

  return (
    <>
      <JsonLd
        data={buildArticleJsonLd({
          locale: seo.siteLocale,
          slug,
          title: seo.title,
          description: seo.description,
          imageUrl: seo.imageUrl,
          publishedAt: seo.publishedAt,
          updatedAt: seo.updatedAt,
        })}
      />
      {children}
    </>
  )
}
