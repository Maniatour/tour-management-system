import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from '@/lib/supabase'

type MediaRow = {
  product_id: string
  file_url: string | null
  is_primary: boolean | null
  order_index: number | null
}

const CHUNK = 100

/**
 * Batch-load primary (or first active) product_media image URLs.
 * Replaces per-product N+1 queries on admin product lists.
 */
export async function fetchProductPrimaryImagesBatch(
  productIds: string[],
  client: SupabaseClient = defaultSupabase
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  const ids = [...new Set(productIds.filter(Boolean))]
  for (const id of ids) result.set(id, null)
  if (ids.length === 0) return result

  const rows: MediaRow[] = []

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await client
      .from('product_media')
      .select('product_id, file_url, is_primary, order_index')
      .in('product_id', chunk)
      .eq('file_type', 'image')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('[fetchProductPrimaryImagesBatch]', error.message)
      continue
    }
    if (data?.length) rows.push(...(data as MediaRow[]))
  }

  const byProduct = new Map<string, MediaRow[]>()
  for (const row of rows) {
    if (!row.product_id || !row.file_url) continue
    const list = byProduct.get(row.product_id) || []
    list.push(row)
    byProduct.set(row.product_id, list)
  }

  for (const id of ids) {
    const list = byProduct.get(id)
    if (!list || list.length === 0) continue
    const primary = list.find((r) => r.is_primary)
    result.set(id, (primary || list[0]).file_url)
  }

  return result
}

/** Attach `primary_image` onto product rows (mutates copies). */
export async function withPrimaryImages<T extends { id: string }>(
  products: T[],
  client: SupabaseClient = defaultSupabase
): Promise<Array<T & { primary_image: string | null }>> {
  const map = await fetchProductPrimaryImagesBatch(
    products.map((p) => p.id),
    client
  )
  return products.map((p) => ({
    ...p,
    primary_image: map.get(p.id) ?? null,
  }))
}
