import { supabase } from '@/lib/supabase'
import type { HomeSectionConfig } from '@/lib/customerPageHomeSectionCatalog'
import { loadCustomerPageHomeContent } from '@/lib/customerPageHomeContentPersistence'
import { withLowestChoicePrices } from '@/lib/fetchLowestChoicePrices'

export const HOME_SECTION_PRODUCT_SELECT =
  'id, name, name_en, customer_name_ko, customer_name_en, description, summary_ko, summary_en, base_price, adult_base_price, category, is_favorite, favorite_order, departure_city, departure_city_ko, departure_city_en, departure_country, departure_country_ko, departure_country_en, duration, max_participants, tags, created_at'

export type HomeSectionProductRow = {
  id: string
  name: string
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  description: string | null
  summary_ko: string | null
  summary_en: string | null
  category: string | null
  base_price: number | null
  adult_base_price: number | null
  favorite_order: number | null
  departure_city: string | null
  departure_city_ko: string | null
  departure_city_en: string | null
  departure_country: string | null
  departure_country_ko: string | null
  departure_country_en: string | null
  duration: string | null
  max_participants: number | null
  primary_image: string | null
  lowest_choice_price?: number | null
}

export async function fetchHomeSectionProducts(
  config: HomeSectionConfig
): Promise<HomeSectionProductRow[]> {
  const limit = Math.min(12, Math.max(1, config.cardCount ?? 3))
  const query = config.productQuery ?? 'favorites'

  let builder = supabase
    .from('products')
    .select(HOME_SECTION_PRODUCT_SELECT)
    .eq('status', 'active')
    .eq('is_published', true)

  if (query === 'favorites') {
    builder = builder.eq('is_favorite', true).order('favorite_order', { ascending: true })
  } else if (query === 'recent') {
    builder = builder.order('created_at', { ascending: false })
  } else if (query === 'category' && config.categoryFilter?.trim()) {
    builder = builder.eq('category', config.categoryFilter.trim()).order('created_at', { ascending: false })
  } else if (query === 'tag' && config.tagFilter?.trim()) {
    builder = builder.contains('tags', [config.tagFilter.trim()]).order('created_at', { ascending: false })
  } else {
    builder = builder.order('is_favorite', { ascending: false }).order('favorite_order', { ascending: true })
  }

  const { data, error } = await builder.limit(limit)
  if (error) throw error

  let rows = (data ?? []) as unknown as Omit<HomeSectionProductRow, 'primary_image'>[]

  if (query === 'favorites' && rows.length === 0) {
    const { data: recent, error: recentError } = await supabase
      .from('products')
      .select(HOME_SECTION_PRODUCT_SELECT)
      .eq('status', 'active')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (recentError) throw recentError
    rows = (recent ?? []) as unknown as Omit<HomeSectionProductRow, 'primary_image'>[]
  }

  return withLowestChoicePrices(rows.map((row) => ({ ...row, primary_image: null })))
}

export async function fetchHomeSectionProductsByIds(
  productIds: string[]
): Promise<HomeSectionProductRow[]> {
  const ids = productIds.filter(Boolean)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('products')
    .select(HOME_SECTION_PRODUCT_SELECT)
    .eq('status', 'active')
    .eq('is_published', true)
    .in('id', ids)

  if (error) throw error

  const rows = (data ?? []) as unknown as Omit<HomeSectionProductRow, 'primary_image'>[]
  const rowMap = new Map(rows.map((row) => [row.id, row]))

  const ordered = ids
    .map((id) => rowMap.get(id))
    .filter((row): row is Omit<HomeSectionProductRow, 'primary_image'> => row != null)
    .map((row) => ({ ...row, primary_image: null }))

  return withLowestChoicePrices(ordered)
}

export async function fetchHomeSectionProductsForSection(
  instanceId: string,
  config: HomeSectionConfig
): Promise<HomeSectionProductRow[]> {
  const homeContent = loadCustomerPageHomeContent()
  if (instanceId === 'home-popular' && homeContent.popularProductIds.length > 0) {
    return fetchHomeSectionProductsByIds(homeContent.popularProductIds)
  }
  return fetchHomeSectionProducts(config)
}
