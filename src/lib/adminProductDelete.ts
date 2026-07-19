/**
 * Admin product cascade delete (catalog children only).
 * Does not delete reservations / payments. Fails clearly if FKs block.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

type Db = SupabaseClient<Database>

export type AdminProductDeleteResult = {
  productId: string
  deleted: Record<string, number>
}

async function deleteByProductId(
  db: Db,
  table: string,
  productId: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from(table)
    .delete()
    .eq('product_id', productId)
    .select('id')

  if (error) {
    // Table may not exist in older envs — skip soft misses
    if (error.code === '42P01' || error.code === 'PGRST205') return 0
    throw new Error(`${table} delete failed: ${error.message}`)
  }
  return Array.isArray(data) ? data.length : 0
}

export async function deleteAdminProductCascade(
  db: Db,
  productId: string,
  operatorId?: string | null
): Promise<AdminProductDeleteResult> {
  const opId = resolveOperatorId(operatorId)

  const { data: product, error: productLookupErr } = await db
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('operator_id', opId)
    .maybeSingle()

  if (productLookupErr) throw productLookupErr
  if (!product) throw new Error('Product not found for active operator')

  const deleted: Record<string, number> = {}

  // choice_options via parent choices
  const { data: choiceIds, error: choiceIdsErr } = await db
    .from('product_choices')
    .select('id')
    .eq('product_id', productId)

  if (choiceIdsErr) throw choiceIdsErr

  if (choiceIds && choiceIds.length > 0) {
    const ids = choiceIds.map((c) => c.id)
    const { data: optDeleted, error: optErr } = await db
      .from('choice_options')
      .delete()
      .in('choice_id', ids)
      .select('id')

    if (optErr) throw new Error(`choice_options delete failed: ${optErr.message}`)
    deleted.choice_options = optDeleted?.length ?? 0
  } else {
    deleted.choice_options = 0
  }

  const childTables = [
    'product_choices',
    'dynamic_pricing',
    'product_media',
    'product_details_multilingual',
    'product_details',
    'product_faqs',
    'product_schedules',
    'product_options',
    'product_tour_courses',
    'channel_products',
  ] as const

  for (const table of childTables) {
    deleted[table] = await deleteByProductId(db, table, productId)
  }

  const { data: productDeleted, error: productDelErr } = await db
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('operator_id', opId)
    .select('id')

  if (productDelErr) {
    throw new Error(
      `products delete failed (reservations or other FKs may still reference this product): ${productDelErr.message}`
    )
  }

  if (!productDeleted || productDeleted.length === 0) {
    throw new Error('Product delete affected 0 rows')
  }

  deleted.products = productDeleted.length
  return { productId, deleted }
}
