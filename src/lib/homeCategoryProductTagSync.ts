import { supabase } from '@/lib/supabase'

import { productTagsMatchHomeQuery } from '@/lib/homeLinkTags'

export type ProductTagRow = {
  id: string
  tags: string[] | null
}

/** Exact tag key match (case-insensitive) — used when writing tags. */
export function productHasExactTag(tags: string[] | null | undefined, tagQuery: string): boolean {
  const needle = tagQuery.trim().toLowerCase()
  if (!needle) return false
  return (tags ?? []).some((tag) => tag.trim().toLowerCase() === needle)
}

export function collectProductIdsWithTag(
  products: ProductTagRow[],
  tagQuery: string
): string[] {
  return products
    .filter((product) => productTagsMatchHomeQuery(product.tags, tagQuery))
    .map((p) => p.id)
}

/**
 * Ensure `tag` is on each product in `nextIds`.
 * Remove exact `tag` from products that were in `previousIds` but not in `nextIds`.
 */
export async function syncProductTagsForCategoryLink(params: {
  tag: string
  previousIds: string[]
  nextIds: string[]
}): Promise<{ added: number; removed: number }> {
  const tag = params.tag.trim()
  if (!tag) return { added: 0, removed: 0 }

  const previousSet = new Set(params.previousIds)
  const nextSet = new Set(params.nextIds)
  const toAdd = params.nextIds.filter((id) => !previousSet.has(id))
  const toRemove = params.previousIds.filter((id) => !nextSet.has(id))
  // Also ensure all currently linked products have the tag (in case tagQuery changed)
  const ensureIds = params.nextIds.filter((id) => previousSet.has(id))

  const allIds = Array.from(new Set([...toAdd, ...toRemove, ...ensureIds]))
  if (allIds.length === 0) return { added: 0, removed: 0 }

  const { data, error } = await supabase.from('products').select('id, tags').in('id', allIds)
  if (error) throw error

  const byId = new Map(
    ((data ?? []) as ProductTagRow[]).map((row) => [row.id, Array.isArray(row.tags) ? [...row.tags] : []])
  )

  let added = 0
  let removed = 0

  for (const id of [...toAdd, ...ensureIds]) {
    const current = byId.get(id) ?? []
    if (productHasExactTag(current, tag)) continue
    current.push(tag)
    byId.set(id, current)
    const { error: updateError } = await supabase
      .from('products')
      .update({ tags: current } as never)
      .eq('id', id)
    if (updateError) throw updateError
    if (toAdd.includes(id)) added += 1
  }

  for (const id of toRemove) {
    const current = byId.get(id) ?? []
    const next = current.filter((item) => item.trim().toLowerCase() !== tag.toLowerCase())
    if (next.length === current.length) continue
    byId.set(id, next)
    const { error: updateError } = await supabase
      .from('products')
      .update({ tags: next } as never)
      .eq('id', id)
    if (updateError) throw updateError
    removed += 1
  }

  return { added, removed }
}
