'use client'

import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { fetchProductPrimaryImage } from '@/lib/fetchProductPrimaryImage'
import {
  formatProductDepartureLine,
  getProductCustomerDisplayName,
  resolveProductListingPrice,
} from '@/lib/productDetailDisplay'
import { withLowestChoicePrices } from '@/lib/fetchLowestChoicePrices'
import type { Product } from '@/components/product/productDetailTypes'

export const PRODUCT_RECOMMENDATION_SECTIONS = [
  {
    key: 'traveler_viewed',
    zone: 'detail-recommendations-viewed',
    titleKo: '다른 여행자가 함께 본 상품',
    titleEn: 'Tours Other Travelers Viewed',
  },
  {
    key: 'recommended_for_you',
    zone: 'detail-recommendations-for-you',
    titleKo: '여행자님을 위한 추천 상품',
    titleEn: 'Recommended Tours for You',
  },
  {
    key: 'bought_together',
    zone: 'detail-recommendations-bought-together',
    titleKo: '다른 여행자가 같이 구매한 상품',
    titleEn: 'Tours Travelers Also Booked',
  },
] as const

export type ProductRecommendationSectionKey =
  (typeof PRODUCT_RECOMMENDATION_SECTIONS)[number]['key']

export type ProductRecommendationZone =
  (typeof PRODUCT_RECOMMENDATION_SECTIONS)[number]['zone']

export type ProductRecommendationView = {
  id: string
  category: string | null
  primary_image: string | null
  favorite_order: number | null
  duration: string | null
  max_participants: number | null
  departure_city: string | null
  tags: string[] | null
  price: number | null
  title: string
  locationLine: string | null
  [key: string]: unknown
}

export type ProductRecommendationEditorProduct = ProductRecommendationView & {
  status: string | null
}

const PRODUCT_RECOMMENDATIONS_TABLE = 'product_recommendations'

/** 원격 DB에 마이그레이션 미적용 시 PostgREST 404 / PGRST205 */
function isProductRecommendationsTableUnavailable(
  err: { code?: string; message?: string; status?: number } | null
): boolean {
  if (!err) return false
  if (err.code === 'PGRST205' || err.code === '42P01' || err.status === 404) return true
  const message = (err.message ?? '').toLowerCase()
  return (
    (message.includes('schema cache') ||
      message.includes('could not find') ||
      message.includes('does not exist')) &&
    message.includes(PRODUCT_RECOMMENDATIONS_TABLE)
  )
}

export function getProductRecommendationTitle(
  sectionKey: ProductRecommendationSectionKey,
  locale: string
): string {
  const section = PRODUCT_RECOMMENDATION_SECTIONS.find((item) => item.key === sectionKey)
  if (!section) return ''
  return locale === 'en' ? section.titleEn : section.titleKo
}

function mapProductRow(
  product: Record<string, unknown>,
  primaryImage: string | null,
  locale: string
): ProductRecommendationView {
  const productForDisplay = product as unknown as Product
  const title = getProductCustomerDisplayName(productForDisplay, locale)
  const locationLine = formatProductDepartureLine(product as Parameters<typeof formatProductDepartureLine>[0], locale)
  const price = resolveProductListingPrice(product)

  return {
    ...product,
    id: String(product.id),
    category: typeof product.category === 'string' ? product.category : null,
    primary_image: primaryImage,
    favorite_order: null,
    duration: typeof product.duration === 'string' ? product.duration : null,
    max_participants:
      typeof product.max_participants === 'number' ? product.max_participants : null,
    departure_city:
      typeof product.departure_city === 'string' ? product.departure_city : null,
    tags: Array.isArray(product.tags) ? (product.tags as string[]) : null,
    price,
    title,
    locationLine: locationLine || null,
  }
}

async function hydrateProductRows(
  rows: Record<string, unknown>[],
  locale: string
): Promise<ProductRecommendationView[]> {
  const withPrices = await withLowestChoicePrices(
    rows.map((row) => ({ ...row, id: String(row.id) }))
  )
  return Promise.all(
    withPrices.map(async (row) =>
      mapProductRow(row, await fetchProductPrimaryImage(String(row.id)), locale)
    )
  )
}

export async function fetchProductRecommendations(
  sourceProductId: string,
  sectionKey: ProductRecommendationSectionKey,
  locale: string
): Promise<ProductRecommendationView[]> {
  const { data: recommendationRows, error } = await fromUntypedTable(
    supabase,
    'product_recommendations'
  )
    .select('recommended_product_id')
    .eq('source_product_id', sourceProductId)
    .eq('section_key', sectionKey)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    if (isProductRecommendationsTableUnavailable(error)) return []
    throw error
  }

  const productIds = ((recommendationRows ?? []) as Array<{ recommended_product_id: string }>)
    .map((row) => row.recommended_product_id)
    .filter(Boolean)

  if (productIds.length === 0) return []

  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('status', 'active')

  if (productError) throw productError

  const productMap = new Map(
    ((products ?? []) as Record<string, unknown>[]).map((product) => [String(product.id), product])
  )
  const sortedRows = productIds
    .map((id) => productMap.get(id))
    .filter((product): product is Record<string, unknown> => product != null)

  return hydrateProductRows(sortedRows, locale)
}

export async function fetchRecommendationEditorProducts(
  locale: string
): Promise<ProductRecommendationEditorProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = await hydrateProductRows((data ?? []) as Record<string, unknown>[], locale)
  return rows.map((row) => ({
    ...row,
    status: typeof row.status === 'string' ? row.status : null,
  }))
}

export async function fetchSelectedRecommendationIds(
  sourceProductId: string,
  sectionKey: ProductRecommendationSectionKey
): Promise<string[]> {
  const { data, error } = await fromUntypedTable(supabase, 'product_recommendations')
    .select('recommended_product_id')
    .eq('source_product_id', sourceProductId)
    .eq('section_key', sectionKey)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) {
    if (isProductRecommendationsTableUnavailable(error)) return []
    throw error
  }
  return ((data ?? []) as Array<{ recommended_product_id: string }>)
    .map((row) => row.recommended_product_id)
    .filter(Boolean)
}

export async function saveProductRecommendationIds(
  sourceProductId: string,
  sectionKey: ProductRecommendationSectionKey,
  recommendedProductIds: string[]
) {
  const { error: deleteError } = await fromUntypedTable(supabase, 'product_recommendations')
    .delete()
    .eq('source_product_id', sourceProductId)
    .eq('section_key', sectionKey)

  if (deleteError) {
    if (isProductRecommendationsTableUnavailable(deleteError)) return
    throw deleteError
  }

  if (recommendedProductIds.length === 0) return

  const rows = recommendedProductIds.map((recommendedProductId, orderIndex) => ({
    source_product_id: sourceProductId,
    section_key: sectionKey,
    recommended_product_id: recommendedProductId,
    order_index: orderIndex,
    is_active: true,
  }))

  const { error } = await fromUntypedTable(supabase, 'product_recommendations').insert(rows)
  if (error) {
    if (isProductRecommendationsTableUnavailable(error)) return
    throw error
  }
}
