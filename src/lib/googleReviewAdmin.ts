import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  loadReviewSnapshotForLog,
  logGoogleReviewAdminChanges,
  insertGoogleReviewChangeLog,
} from '@/lib/googleReviewChangeLog'
import { loadGoogleReviewTourStaffSummaries, linkGoogleReviewToTour, syncReviewProductFromTourIfUnclassified } from '@/lib/googleReviewTourLink'
import { resolveProductInternalName } from '@/utils/reservationUtils'

export type AdminGoogleReviewRow = {
  id: string
  googleReviewId: string
  reviewSource: string
  authorName: string | null
  authorPhotoUrl: string | null
  rating: number | null
  comment: string | null
  reviewReply: string | null
  reviewCreatedAt: string | null
  importStatus: string
  classificationMethod: string | null
  classificationConfidence: number | null
  productId: string | null
  productName: string | null
  importedAt: string
  excludeStaffRating: boolean
  tourId: string | null
  tourDate: string | null
  tourProductName: string | null
  tourMatchMethod: string | null
  staff: Array<{
    staffEmail: string
    staffName: string | null
    staffRole: 'guide' | 'assistant'
    matchMethod: string | null
  }>
}

type AdminListGoogleReviewRpcRow = {
  id: string
  google_review_id: string
  review_source: string
  author_name: string | null
  author_photo_url: string | null
  rating: number | null
  comment: string | null
  review_reply: string | null
  review_created_at: string | null
  import_status: string
  classification_method: string | null
  classification_confidence: number | null
  imported_at: string
  product_id: string | null
  product_name: string | null
  exclude_staff_rating: boolean
  total_count: number | string
}

type AdminGoogleReviewStatsRpc = {
  total: number
  pending: number
  approved: number
  rejected: number
  hidden: number
  unclassified: number
}

function mapRpcReviewRow(
  row: AdminListGoogleReviewRpcRow,
  tourStaff?: {
    tour: {
      tourId: string
      tourDate: string | null
      productName: string | null
      matchMethod: string | null
    } | null
    staff: Array<{
      staffEmail: string
      staffName: string | null
      staffRole: 'guide' | 'assistant'
      matchMethod: string | null
    }>
  }
): AdminGoogleReviewRow {
  return {
    id: row.id,
    googleReviewId: row.google_review_id,
    reviewSource: row.review_source ?? 'google',
    authorName: row.author_name,
    authorPhotoUrl: row.author_photo_url,
    rating: row.rating,
    comment: row.comment,
    reviewReply: row.review_reply,
    reviewCreatedAt: row.review_created_at,
    importStatus: row.import_status,
    classificationMethod: row.classification_method,
    classificationConfidence: row.classification_confidence,
    productId: row.product_id,
    productName: row.product_name,
    importedAt: row.imported_at,
    excludeStaffRating: Boolean(row.exclude_staff_rating),
    tourId: tourStaff?.tour?.tourId ?? null,
    tourDate: tourStaff?.tour?.tourDate ?? null,
    tourProductName: tourStaff?.tour?.productName ?? null,
    tourMatchMethod: tourStaff?.tour?.matchMethod ?? null,
    staff: tourStaff?.staff ?? [],
  }
}

export async function listAdminGoogleReviews(input: {
  operatorId: string
  status?: string | null
  productId?: string | null
  unclassifiedOnly?: boolean
  reviewSource?: string | null
  sort?: 'imported_at' | 'review_created_at' | null
  page?: number
  limit?: number
}): Promise<{ reviews: AdminGoogleReviewRow[]; total: number }> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const page = Math.max(input.page ?? 1, 1)
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const operatorId = resolveOperatorId(input.operatorId)

  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: AdminListGoogleReviewRpcRow[] | null; error: { message: string } | null }>
  }).rpc('admin_list_google_reviews', {
    p_operator_id: operatorId,
    p_status: input.status || null,
    p_product_id: input.productId || null,
    p_unclassified_only: input.unclassifiedOnly ?? false,
    p_page: page,
    p_limit: limit,
    p_review_source: input.reviewSource || null,
    p_sort: input.sort || null,
  })

  if (error) {
    const message = error.message || 'list_failed'
    if (
      message.includes('admin_list_google_reviews') ||
      message.includes('Could not find the function') ||
      message.includes('PGRST202')
    ) {
      throw new Error(
        'admin_list_google_reviews RPC is missing. Apply migrations 20260803190000 and 20260803220000 in Supabase SQL Editor.'
      )
    }
    throw new Error(message)
  }

  const rows = data ?? []
  const total = rows.length
    ? Number(rows[0]?.total_count ?? rows.length)
    : 0

  const reviewIds = rows.map((row) => row.id)
  const tourStaffByReview = await loadGoogleReviewTourStaffSummaries(reviewIds)

  const patchedRows = await Promise.all(
    rows.map(async (row) => {
      if (row.product_id) return row

      const tourId = tourStaffByReview.get(row.id)?.tour?.tourId
      if (!tourId) return row

      try {
        const productId = await syncReviewProductFromTourIfUnclassified({
          operatorId,
          reviewId: row.id,
          tourId,
          updatedByEmail: 'system',
        })
        if (!productId) return row

        return {
          ...row,
          product_id: productId,
          product_name:
            tourStaffByReview.get(row.id)?.tour?.productName ?? row.product_name,
          classification_method: row.classification_method ?? 'tour_link',
        }
      } catch (repairError) {
        console.error('[listAdminGoogleReviews] repair product from tour failed', repairError)
        return row
      }
    })
  )

  return {
    reviews: patchedRows.map((row) => mapRpcReviewRow(row, tourStaffByReview.get(row.id))),
    total,
  }
}

export async function getAdminGoogleReviewById(
  operatorId: string,
  reviewId: string
): Promise<AdminGoogleReviewRow | null> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const opId = resolveOperatorId(operatorId)

  const { data: review, error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select(
      'id, google_review_id, review_source, author_name, author_photo_url, rating, comment, review_reply, review_created_at, import_status, classification_method, classification_confidence, imported_at, exclude_staff_rating'
    )
    .eq('id', reviewId)
    .eq('operator_id', opId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!review) return null

  const row = review as {
    id: string
    google_review_id: string
    review_source?: string | null
    author_name: string | null
    author_photo_url: string | null
    rating: number | null
    comment: string | null
    review_reply: string | null
    review_created_at: string | null
    import_status: string
    classification_method: string | null
    classification_confidence: number | null
    imported_at: string
    exclude_staff_rating: boolean
  }

  const { data: productRow } = await fromUntypedTable(supabaseAdmin, 'review_products')
    .select('product_id, products(name, name_ko, name_en)')
    .eq('google_review_id', reviewId)
    .eq('operator_id', opId)
    .eq('is_primary', true)
    .maybeSingle()

  const product = productRow as {
    product_id?: string | null
    products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
  } | null

  const productId = product?.product_id ?? null
  const productName = product?.products
    ? resolveProductInternalName(product.products, productId)
    : null

  const tourStaffByReview = await loadGoogleReviewTourStaffSummaries([reviewId])

  return mapRpcReviewRow(
    {
      id: row.id,
      google_review_id: row.google_review_id,
      review_source: row.review_source ?? 'google',
      author_name: row.author_name,
      author_photo_url: row.author_photo_url,
      rating: row.rating,
      comment: row.comment,
      review_reply: row.review_reply,
      review_created_at: row.review_created_at,
      import_status: row.import_status,
      classification_method: row.classification_method,
      classification_confidence: row.classification_confidence,
      imported_at: row.imported_at,
      product_id: productId,
      product_name: productName,
      exclude_staff_rating: Boolean(row.exclude_staff_rating),
      total_count: 1,
    },
    tourStaffByReview.get(reviewId)
  )
}

export async function updateGoogleReviewStatus(input: {
  operatorId: string
  reviewId: string
  importStatus?: string
  productId?: string | null
  tourId?: string | null
  excludeStaffRating?: boolean
  updatedByEmail: string
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)
  const now = new Date().toISOString()

  const before = await loadReviewSnapshotForLog(operatorId, input.reviewId)
  if (!before) {
    throw new Error('review_not_found')
  }

  if (input.importStatus) {
    const { error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({ import_status: input.importStatus, updated_at: now } as never)
      .eq('id', input.reviewId)
      .eq('operator_id', operatorId)

    if (error) throw new Error(error.message)
  }

  if (input.productId !== undefined) {
    await fromUntypedTable(supabaseAdmin, 'review_products')
      .delete()
      .eq('google_review_id', input.reviewId)
      .eq('operator_id', operatorId)

    if (input.productId) {
      const { error: mappingError } = await fromUntypedTable(supabaseAdmin, 'review_products').insert({
        operator_id: operatorId,
        google_review_id: input.reviewId,
        product_id: input.productId,
        is_primary: true,
        match_method: 'manual',
        match_confidence: 1,
        created_by_email: input.updatedByEmail,
      } as never)

      if (mappingError) throw new Error(mappingError.message)

      await fromUntypedTable(supabaseAdmin, 'google_reviews')
        .update({
          classification_method: 'manual',
          classification_confidence: 1,
          classified_at: now,
          classified_by: input.updatedByEmail,
          updated_at: now,
        } as never)
        .eq('id', input.reviewId)
        .eq('operator_id', operatorId)
    }
  }

  if (input.excludeStaffRating !== undefined) {
    const { error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({
        exclude_staff_rating: input.excludeStaffRating,
        updated_at: now,
      } as never)
      .eq('id', input.reviewId)
      .eq('operator_id', operatorId)

    if (error) throw new Error(error.message)

    if (input.excludeStaffRating) {
      await linkGoogleReviewToTour({
        operatorId,
        reviewId: input.reviewId,
        tourId: null,
        matchMethod: 'manual',
        linkedByEmail: input.updatedByEmail,
      })

      const { error: staffDeleteError } = await fromUntypedTable(supabaseAdmin, 'google_review_staff')
        .delete()
        .eq('google_review_id', input.reviewId)
        .eq('operator_id', operatorId)

      if (staffDeleteError) throw new Error(staffDeleteError.message)
    }
  }

  if (input.tourId !== undefined) {
    if (input.tourId) {
      const { error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
        .update({ exclude_staff_rating: false, updated_at: now } as never)
        .eq('id', input.reviewId)
        .eq('operator_id', operatorId)

      if (error) throw new Error(error.message)
    }

    if (input.tourId || input.excludeStaffRating !== true) {
      await linkGoogleReviewToTour({
        operatorId,
        reviewId: input.reviewId,
        tourId: input.tourId,
        matchMethod: 'manual',
        confidence: 1,
        linkedByEmail: input.updatedByEmail,
      })
    }

    if (input.tourId) {
      await syncReviewProductFromTourIfUnclassified({
        operatorId,
        reviewId: input.reviewId,
        tourId: input.tourId,
        updatedByEmail: input.updatedByEmail,
      })
    }
  }

  const after = await loadReviewSnapshotForLog(operatorId, input.reviewId)
  if (after) {
    await logGoogleReviewAdminChanges({
      operatorId,
      reviewId: input.reviewId,
      before,
      after: {
        importStatus: after.importStatus,
        productId: after.productId,
        tourId: after.tourId,
        excludeStaffRating: after.excludeStaffRating,
      },
      changedByEmail: input.updatedByEmail,
    })
  }
}

function chunkIds<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** 투어 미연결 리뷰의 상품 분류를 모두 제거 */
export async function clearReviewProductsWithoutTourLink(
  operatorId?: string | null
): Promise<{ productsRemoved: number; reviewsReset: number }> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorIdResolved = resolveOperatorId(operatorId)

  const { data: tourLinks, error: tourLinkError } = await fromUntypedTable(
    supabaseAdmin,
    'google_review_tours'
  )
    .select('google_review_id')
    .eq('operator_id', operatorIdResolved)

  if (tourLinkError) throw new Error(tourLinkError.message)

  const linkedReviewIds = new Set(
    ((tourLinks ?? []) as Array<{ google_review_id: string }>).map((row) => row.google_review_id)
  )

  const { data: productRows, error: productFetchError } = await fromUntypedTable(
    supabaseAdmin,
    'review_products'
  )
    .select('id, google_review_id')
    .eq('operator_id', operatorIdResolved)

  if (productFetchError) throw new Error(productFetchError.message)

  const productIdsToDelete = ((productRows ?? []) as Array<{ id: string; google_review_id: string }>)
    .filter((row) => !linkedReviewIds.has(row.google_review_id))
    .map((row) => row.id)

  let productsRemoved = 0
  for (const chunk of chunkIds(productIdsToDelete, 100)) {
    const { error } = await fromUntypedTable(supabaseAdmin, 'review_products')
      .delete()
      .in('id', chunk)
    if (error) throw new Error(error.message)
    productsRemoved += chunk.length
  }

  const { data: reviewRows, error: reviewFetchError } = await fromUntypedTable(
    supabaseAdmin,
    'google_reviews'
  )
    .select('id')
    .eq('operator_id', operatorIdResolved)

  if (reviewFetchError) throw new Error(reviewFetchError.message)

  const reviewIdsToReset = ((reviewRows ?? []) as Array<{ id: string }>)
    .filter((row) => !linkedReviewIds.has(row.id))
    .map((row) => row.id)

  const now = new Date().toISOString()
  let reviewsReset = 0
  for (const chunk of chunkIds(reviewIdsToReset, 100)) {
    const { error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
      .update({
        classification_method: null,
        classification_confidence: null,
        classified_at: null,
        classified_by: null,
        updated_at: now,
      } as never)
      .in('id', chunk)
      .eq('operator_id', operatorIdResolved)
    if (error) throw new Error(error.message)
    reviewsReset += chunk.length
  }

  return { productsRemoved, reviewsReset }
}

export async function bulkUpdateGoogleReviewStatus(input: {
  operatorId: string
  reviewIds: string[]
  importStatus: string
  updatedByEmail: string
}): Promise<number> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const operatorId = resolveOperatorId(input.operatorId)

  const { data: existingRows, error: fetchError } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('id, import_status')
    .eq('operator_id', operatorId)
    .in('id', input.reviewIds)

  if (fetchError) throw new Error(fetchError.message)

  const { data, error } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .update({
      import_status: input.importStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('operator_id', operatorId)
    .in('id', input.reviewIds)
    .select('id')

  if (error) throw new Error(error.message)

  const rows = (existingRows ?? []) as Array<{ id: string; import_status: string }>
  for (const row of rows) {
    if (row.import_status === input.importStatus) continue
    await insertGoogleReviewChangeLog({
      operatorId,
      reviewId: row.id,
      changeType: 'bulk_status',
      oldValue: { import_status: row.import_status },
      newValue: { import_status: input.importStatus },
      changedByEmail: input.updatedByEmail,
    })
  }

  return (data ?? []).length
}

export async function getGoogleReviewStats(
  operatorId?: string | null,
  reviewSource?: string | null
): Promise<{
  total: number
  pending: number
  approved: number
  rejected: number
  hidden: number
  unclassified: number
}> {
  const empty = { total: 0, pending: 0, approved: 0, rejected: 0, hidden: 0, unclassified: 0 }
  if (!supabaseAdmin) {
    return empty
  }

  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: AdminGoogleReviewStatsRpc | null; error: { message: string } | null }>
  }).rpc('admin_google_review_stats', {
    p_operator_id: resolveOperatorId(operatorId),
    p_review_source: reviewSource || null,
  })

  if (error) {
    const message = error.message || 'stats_failed'
    if (
      message.includes('admin_google_review_stats') ||
      message.includes('Could not find the function') ||
      message.includes('PGRST202')
    ) {
      throw new Error(
        'admin_google_review_stats RPC is missing. Apply migrations 20260803190000 and 20260803220000 in Supabase SQL Editor.'
      )
    }
    throw new Error(message)
  }

  if (!data) return empty

  return {
    total: data.total ?? 0,
    pending: data.pending ?? 0,
    approved: data.approved ?? 0,
    rejected: data.rejected ?? 0,
    hidden: data.hidden ?? 0,
    unclassified: data.unclassified ?? 0,
  }
}
