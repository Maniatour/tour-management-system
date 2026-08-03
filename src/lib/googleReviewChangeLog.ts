import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveProductInternalName } from '@/utils/reservationUtils'

export type GoogleReviewChangeType =
  | 'status'
  | 'product'
  | 'tour'
  | 'exclude_staff_rating'
  | 'bulk_status'

export type GoogleReviewChangeLogRow = {
  id: string
  googleReviewId: string
  reviewSource: string | null
  authorName: string | null
  changeType: GoogleReviewChangeType
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  changedByEmail: string | null
  createdAt: string
}

type ReviewSnapshot = {
  importStatus: string
  excludeStaffRating: boolean
  productId: string | null
  productName: string | null
  tourId: string | null
  tourLabel: string | null
}

async function loadReviewSnapshot(
  operatorId: string,
  reviewId: string
): Promise<ReviewSnapshot | null> {
  if (!supabaseAdmin) return null

  const { data: review } = await fromUntypedTable(supabaseAdmin, 'google_reviews')
    .select('import_status, exclude_staff_rating')
    .eq('id', reviewId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (!review) return null

  const row = review as { import_status: string; exclude_staff_rating: boolean }

  const { data: productRow } = await fromUntypedTable(supabaseAdmin, 'review_products')
    .select('product_id, products(name, name_ko, name_en)')
    .eq('google_review_id', reviewId)
    .eq('operator_id', operatorId)
    .eq('is_primary', true)
    .maybeSingle()

  const product = productRow as {
    product_id?: string | null
    products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
  } | null

  const { data: tourRow } = await fromUntypedTable(supabaseAdmin, 'google_review_tours')
    .select('tour_id, tours(tour_date, product_id, products(name, name_ko, name_en))')
    .eq('google_review_id', reviewId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  const tour = tourRow as {
    tour_id?: string | null
    tours?: {
      tour_date?: string | null
      product_id?: string | null
      products?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
    } | null
  } | null

  const productId = product?.product_id ?? null
  const productName = product?.products
    ? resolveProductInternalName(product.products) || productId
    : null

  const tourId = tour?.tour_id ?? null
  const tourDate = tour?.tours?.tour_date ?? null
  const tourProductName = tour?.tours?.products
    ? resolveProductInternalName(tour.tours.products) || tour?.tours?.product_id || null
    : null
  const tourLabel =
    tourId && tourDate ? `${tourDate}${tourProductName ? ` · ${tourProductName}` : ''}` : tourId

  return {
    importStatus: row.import_status,
    excludeStaffRating: Boolean(row.exclude_staff_rating),
    productId,
    productName,
    tourId,
    tourLabel: tourLabel ?? null,
  }
}

async function resolveProductLabel(productId: string | null): Promise<string | null> {
  if (!productId || !supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('products')
    .select('name, name_ko, name_en')
    .eq('id', productId)
    .maybeSingle()
  if (!data) return productId
  return resolveProductInternalName(data) || productId
}

async function resolveTourLabel(tourId: string | null): Promise<string | null> {
  if (!tourId || !supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('tours')
    .select('tour_date, product_id, products(name, name_ko, name_en)')
    .eq('id', tourId)
    .maybeSingle()
  if (!data) return tourId
  const productName = data.products
    ? resolveProductInternalName(data.products) || data.product_id
    : data.product_id
  return `${data.tour_date}${productName ? ` · ${productName}` : ''}`
}

export async function insertGoogleReviewChangeLog(input: {
  operatorId: string
  reviewId: string
  changeType: GoogleReviewChangeType
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  changedByEmail?: string | null
}): Promise<void> {
  if (!supabaseAdmin) return

  const { error } = await fromUntypedTable(supabaseAdmin, 'google_review_change_logs').insert({
    operator_id: resolveOperatorId(input.operatorId),
    google_review_id: input.reviewId,
    change_type: input.changeType,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    changed_by_email: input.changedByEmail ?? null,
  } as never)

  if (error) {
    console.error('[googleReviewChangeLog] insert failed', error.message)
  }
}

export async function logGoogleReviewAdminChanges(input: {
  operatorId: string
  reviewId: string
  before: ReviewSnapshot
  after: {
    importStatus?: string
    productId?: string | null
    tourId?: string | null
    excludeStaffRating?: boolean
  }
  changedByEmail: string
}): Promise<void> {
  const logs: Array<{
    changeType: GoogleReviewChangeType
    oldValue: Record<string, unknown> | null
    newValue: Record<string, unknown> | null
  }> = []

  if (input.after.importStatus && input.after.importStatus !== input.before.importStatus) {
    logs.push({
      changeType: 'status',
      oldValue: { import_status: input.before.importStatus },
      newValue: { import_status: input.after.importStatus },
    })
  }

  if (input.after.productId !== undefined) {
    const nextProductId = input.after.productId
    if (nextProductId !== input.before.productId) {
      const nextName =
        nextProductId && nextProductId !== input.before.productId
          ? await resolveProductLabel(nextProductId)
          : null
      logs.push({
        changeType: 'product',
        oldValue: input.before.productId
          ? { product_id: input.before.productId, product_name: input.before.productName }
          : null,
        newValue: nextProductId
          ? { product_id: nextProductId, product_name: nextName }
          : null,
      })
    }
  }

  if (input.after.excludeStaffRating !== undefined) {
    if (input.after.excludeStaffRating !== input.before.excludeStaffRating) {
      logs.push({
        changeType: 'exclude_staff_rating',
        oldValue: { exclude_staff_rating: input.before.excludeStaffRating },
        newValue: { exclude_staff_rating: input.after.excludeStaffRating },
      })
    }
  }

  if (input.after.tourId !== undefined) {
    const nextTourId = input.after.tourId
    if (nextTourId !== input.before.tourId) {
      const nextLabel =
        nextTourId && nextTourId !== input.before.tourId
          ? await resolveTourLabel(nextTourId)
          : null
      logs.push({
        changeType: 'tour',
        oldValue: input.before.tourId
          ? { tour_id: input.before.tourId, tour_label: input.before.tourLabel }
          : null,
        newValue: nextTourId ? { tour_id: nextTourId, tour_label: nextLabel } : null,
      })
    }
  }

  for (const log of logs) {
    await insertGoogleReviewChangeLog({
      operatorId: input.operatorId,
      reviewId: input.reviewId,
      changeType: log.changeType,
      oldValue: log.oldValue,
      newValue: log.newValue,
      changedByEmail: input.changedByEmail,
    })
  }
}

export async function loadReviewSnapshotForLog(
  operatorId: string,
  reviewId: string
): Promise<ReviewSnapshot | null> {
  return loadReviewSnapshot(resolveOperatorId(operatorId), reviewId)
}

function mapChangeLogRow(row: {
  id: string
  google_review_id: string
  change_type: GoogleReviewChangeType
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_by_email: string | null
  created_at: string
  google_reviews?: { author_name?: string | null; review_source?: string | null } | null
}): GoogleReviewChangeLogRow {
  return {
    id: row.id,
    googleReviewId: row.google_review_id,
    reviewSource: row.google_reviews?.review_source ?? null,
    authorName: row.google_reviews?.author_name ?? null,
    changeType: row.change_type,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedByEmail: row.changed_by_email,
    createdAt: row.created_at,
  }
}

export async function listGoogleReviewChangeLogs(input: {
  operatorId: string
  reviewId?: string | null
  limit?: number
}): Promise<GoogleReviewChangeLogRow[]> {
  if (!supabaseAdmin) return []

  const operatorId = resolveOperatorId(input.operatorId)
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50)

  let query = fromUntypedTable(supabaseAdmin, 'google_review_change_logs')
    .select(
      'id, google_review_id, change_type, old_value, new_value, changed_by_email, created_at, google_reviews(author_name, review_source)'
    )
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.reviewId) {
    query = query.eq('google_review_id', input.reviewId)
  }

  const { data, error } = await query
  if (error) {
    if (error.message.includes('google_review_change_logs')) {
      return []
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<Parameters<typeof mapChangeLogRow>[0]>).map(mapChangeLogRow)
}

export function formatGoogleReviewChangeLabel(
  change: Pick<GoogleReviewChangeLogRow, 'changeType' | 'oldValue' | 'newValue'>,
  isKo: boolean
): string {
  const statusLabel = (status: string) => {
    const map: Record<string, { ko: string; en: string }> = {
      pending: { ko: '대기', en: 'Pending' },
      approved: { ko: '승인', en: 'Approved' },
      rejected: { ko: '거절', en: 'Rejected' },
      hidden: { ko: '숨김', en: 'Hidden' },
    }
    return isKo ? map[status]?.ko ?? status : map[status]?.en ?? status
  }

  switch (change.changeType) {
    case 'status':
    case 'bulk_status': {
      const from = change.oldValue?.import_status as string | undefined
      const to = change.newValue?.import_status as string | undefined
      if (isKo) {
        return `상태: ${from ? statusLabel(from) : '—'} → ${to ? statusLabel(to) : '—'}`
      }
      return `Status: ${from ?? '—'} → ${to ?? '—'}`
    }
    case 'product': {
      const from = (change.oldValue?.product_name as string | undefined) ?? '—'
      const to = (change.newValue?.product_name as string | undefined) ?? (isKo ? '해제' : 'Cleared')
      return isKo ? `상품: ${from} → ${to}` : `Product: ${from} → ${to}`
    }
    case 'tour': {
      const from = (change.oldValue?.tour_label as string | undefined) ?? '—'
      const to = (change.newValue?.tour_label as string | undefined) ?? (isKo ? '해제' : 'Cleared')
      return isKo ? `투어: ${from} → ${to}` : `Tour: ${from} → ${to}`
    }
    case 'exclude_staff_rating': {
      const enabled = Boolean(change.newValue?.exclude_staff_rating)
      return isKo
        ? enabled
          ? '가이드 평점 미반영 설정'
          : '가이드 평점 미반영 해제'
        : enabled
          ? 'Excluded from staff ratings'
          : 'Staff rating exclusion removed'
    }
    default:
      return isKo ? '변경' : 'Changed'
  }
}
