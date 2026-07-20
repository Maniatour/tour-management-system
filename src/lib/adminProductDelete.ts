/**
 * Admin product delete helpers.
 * - softDeleteAdminProduct: status=deleted (recoverable; preferred for UI)
 * - deleteAdminProductCascade: hard cascade (clone rollback only)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { isSuperAdminActor } from '@/lib/superAdmin'
import { isManagerTeamPosition } from '@/lib/roles'

type Db = SupabaseClient<Database>

export const ADMIN_PRODUCT_DELETED_STATUS = 'deleted' as const

export type AdminProductDeleteResult = {
  productId: string
  deleted: Record<string, number>
}

export type AdminProductSoftDeleteResult = {
  productId: string
  status: typeof ADMIN_PRODUCT_DELETED_STATUS
}

export type AdminProductRestoreResult = {
  productId: string
  status: 'inactive'
}

/** Super 또는 Office Manager(매니저)만 상품 soft delete / 복구 */
export function canSoftDeleteAdminProduct(
  email: string | null | undefined,
  teamPosition?: string | null
): boolean {
  if (isSuperAdminActor(email, teamPosition)) return true
  return isManagerTeamPosition(teamPosition)
}

export function isAdminProductSoftDeleted(status: string | null | undefined): boolean {
  return String(status ?? '')
    .trim()
    .toLowerCase() === ADMIN_PRODUCT_DELETED_STATUS
}

/**
 * Soft delete: hide from catalogs; keep row + children for reservations / restore.
 * Also unpublishes and clears favorite so it leaves customer/home surfaces.
 */
export async function softDeleteAdminProduct(
  db: Db,
  productId: string,
  operatorId?: string | null
): Promise<AdminProductSoftDeleteResult> {
  const opId = resolveOperatorId(operatorId)

  const { data, error } = await db
    .from('products')
    .update({
      status: ADMIN_PRODUCT_DELETED_STATUS,
      is_published: false,
      is_favorite: false,
      favorite_order: null,
    })
    .eq('id', productId)
    .eq('operator_id', opId)
    .neq('status', ADMIN_PRODUCT_DELETED_STATUS)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`Product soft delete failed: ${error.message}`)
  if (!data) throw new Error('Product not found for active operator (or already deleted)')

  return { productId: data.id, status: ADMIN_PRODUCT_DELETED_STATUS }
}

/** Restore soft-deleted product as inactive (admin reactivates / republishes intentionally). */
export async function restoreAdminProduct(
  db: Db,
  productId: string,
  operatorId?: string | null
): Promise<AdminProductRestoreResult> {
  const opId = resolveOperatorId(operatorId)

  const { data, error } = await db
    .from('products')
    .update({
      status: 'inactive',
      is_published: false,
    })
    .eq('id', productId)
    .eq('operator_id', opId)
    .eq('status', ADMIN_PRODUCT_DELETED_STATUS)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`Product restore failed: ${error.message}`)
  if (!data) throw new Error('Deleted product not found for active operator')

  return { productId: data.id, status: 'inactive' }
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

/**
 * Hard cascade delete (catalog children only).
 * Used for clone rollback — not for admin UI delete.
 */
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
    'product_faq_links',
    'product_detail_content_links',
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
