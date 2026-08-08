import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import {
  absoluteCustomerUrl,
  customerLocalizedPath,
  listCustomerSitemapLocales,
} from '@/lib/customerSeo'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

const STATIC_PATHS = [
  '/',
  '/products',
  '/products/tags',
  '/products/custom-tour',
  '/travel-guide',
  '/reservation-check',
  '/terms',
  '/privacy-policy',
  '/sms-terms',
  '/cancellation-refund-policy',
] as const

async function fetchPublishedProductIds(): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return []

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await fromUntypedTable(supabase, 'products')
      .select('id')
      .eq('operator_id', KOVEgAS_OPERATOR_ID)
      .eq('status', 'active')
      .eq('is_published', true)
      .limit(2000)

    if (error || !data) return []
    return (data as Array<{ id: string }>).map((row) => row.id).filter(Boolean)
  } catch {
    return []
  }
}

async function fetchPublishedTravelGuideSlugs(): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return []

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await fromUntypedTable(supabase, 'travel_guide_articles')
      .select('slug')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .limit(500)

    if (error || !data) return []
    return (data as Array<{ slug: string }>).map((row) => row.slug).filter(Boolean)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = listCustomerSitemapLocales()
  const now = new Date()
  const [productIds, guideSlugs] = await Promise.all([
    fetchPublishedProductIds(),
    fetchPublishedTravelGuideSlugs(),
  ])

  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: absoluteCustomerUrl(customerLocalizedPath(locale, path)),
        lastModified: now,
        changeFrequency: path === '/' ? 'daily' : 'weekly',
        priority: path === '/' ? 1 : path.startsWith('/products') ? 0.9 : 0.7,
      })
    }

    for (const id of productIds) {
      entries.push({
        url: absoluteCustomerUrl(customerLocalizedPath(locale, `/products/${id}`)),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.85,
      })
    }

    for (const slug of guideSlugs) {
      entries.push({
        url: absoluteCustomerUrl(customerLocalizedPath(locale, `/travel-guide/${slug}`)),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }
  }

  return entries
}
