import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  computeAverageRating,
  computeAverageRatingFromNumbers,
  mapGoogleReviewsToProductItems,
  mapReviewRowsToProductItems,
  type PublicGoogleReviewRow,
  type PublicProductReviewRow,
} from '@/lib/productReviewDisplay'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

const PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 30

type ReservationRow = {
  id: string
  customer_id: string | null
  product_id: string | null
}

type ReservationCustomerRow = {
  reservation_id: string
  name: string | null
  name_en: string | null
  name_ko: string | null
  order_index: number | null
}

type CustomerRow = {
  id: string
  name: string
}

async function resolveGuestNames(
  db: NonNullable<typeof supabaseAdmin>,
  reservationIds: string[],
  reservations: ReservationRow[],
  locale: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!reservationIds.length) return names

  const [customersRes, reservationCustomersRes] = await Promise.all([
    (async () => {
      const customerIds = [
        ...new Set(
          reservations
            .map((row) => row.customer_id)
            .filter((id): id is string => Boolean(id))
        ),
      ]
      if (!customerIds.length) return [] as CustomerRow[]
      const { data } = await db.from('customers').select('id, name').in('id', customerIds)
      return (data ?? []) as CustomerRow[]
    })(),
    db
      .from('reservation_customers')
      .select('reservation_id, name, name_en, name_ko, order_index')
      .in('reservation_id', reservationIds)
      .order('order_index', { ascending: true }),
  ])

  const customersById = new Map(customersRes.map((row) => [row.id, row.name]))
  const passengersByReservation = new Map<string, ReservationCustomerRow>()

  for (const row of (reservationCustomersRes.data ?? []) as ReservationCustomerRow[]) {
    if (!passengersByReservation.has(row.reservation_id)) {
      passengersByReservation.set(row.reservation_id, row)
    }
  }

  for (const reservation of reservations) {
    const passenger = passengersByReservation.get(reservation.id)
    const localizedName =
      locale === 'en'
        ? passenger?.name_en ?? passenger?.name ?? passenger?.name_ko
        : passenger?.name_ko ?? passenger?.name ?? passenger?.name_en

    if (localizedName?.trim()) {
      names.set(reservation.id, localizedName.trim())
      continue
    }

    if (reservation.customer_id) {
      const customerName = customersById.get(reservation.customer_id)
      if (customerName?.trim()) {
        names.set(reservation.id, customerName.trim())
      }
    }
  }

  return names
}

async function fetchApprovedGoogleReviewsForProduct(
  db: NonNullable<typeof supabaseAdmin>,
  operatorId: string,
  productId: string,
  limit: number
): Promise<PublicGoogleReviewRow[]> {
  const { data: mappings } = await fromUntypedTable(db, 'review_products')
    .select('google_review_id')
    .eq('operator_id', operatorId)
    .eq('product_id', productId)
    .eq('is_primary', true)
    .limit(limit)

  const reviewIds = ((mappings ?? []) as Array<{ google_review_id: string }>).map(
    (row) => row.google_review_id
  )
  if (!reviewIds.length) return []

  const { data: reviews } = await fromUntypedTable(db, 'google_reviews')
    .select('id, author_name, author_photo_url, rating, comment, review_created_at')
    .eq('operator_id', operatorId)
    .eq('import_status', 'approved')
    .in('id', reviewIds)
    .not('comment', 'is', null)
    .order('review_created_at', { ascending: false })
    .limit(limit)

  return ((reviews ?? []) as PublicGoogleReviewRow[]).filter(
    (row) => typeof row.comment === 'string' && row.comment.trim().length > 0
  )
}

function mergeAndMapProductReviews(input: {
  normalizedReviews: PublicProductReviewRow[]
  guestNames: Map<string, string>
  googleRows: PublicGoogleReviewRow[]
  locale: string
  limit: number
}): { reviews: ProductReviewItem[]; reviewCount: number; averageRating: number | null } {
  type SortableItem =
    | { kind: 'reservation'; sortAt: string | null; reservation: PublicProductReviewRow }
    | { kind: 'google'; sortAt: string | null; google: PublicGoogleReviewRow }

  const sortable: SortableItem[] = [
    ...input.normalizedReviews.map((reservation) => ({
      kind: 'reservation' as const,
      sortAt: reservation.created_at,
      reservation,
    })),
    ...input.googleRows.map((google) => ({
      kind: 'google' as const,
      sortAt: google.review_created_at,
      google,
    })),
  ]

  sortable.sort((a, b) => {
    const aTime = a.sortAt ? Date.parse(a.sortAt) : 0
    const bTime = b.sortAt ? Date.parse(b.sortAt) : 0
    return bTime - aTime
  })

  const sliced = sortable.slice(0, input.limit)
  const reservationSlice = sliced
    .filter((item): item is Extract<SortableItem, { kind: 'reservation' }> => item.kind === 'reservation')
    .map((item) => item.reservation)
  const googleSlice = sliced
    .filter((item): item is Extract<SortableItem, { kind: 'google' }> => item.kind === 'google')
    .map((item) => item.google)

  const reviews = [
    ...mapReviewRowsToProductItems(reservationSlice, input.guestNames, input.locale),
    ...mapGoogleReviewsToProductItems(googleSlice, input.locale),
  ]

  const ratings = [
    ...input.normalizedReviews.map((row) => row.rating),
    ...input.googleRows
      .map((row) => row.rating)
      .filter((rating): rating is number => typeof rating === 'number'),
  ]

  return {
    reviews,
    reviewCount: input.normalizedReviews.length + input.googleRows.length,
    averageRating: computeAverageRatingFromNumbers(ratings),
  }
}

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')?.trim() ?? ''
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || 'en'
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10
  )
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  if (productId && !PRODUCT_ID_RE.test(productId)) {
    return NextResponse.json({ ok: false, message: 'Invalid product_id' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: 'Service unavailable' }, { status: 503 })
  }

  const db = supabaseAdmin
  const operatorId = await getPublicOperatorId()

  if (productId) {
    const { data: productRow, error: productError } = await db
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('operator_id', operatorId)
      .eq('status', 'active')
      .maybeSingle()

    if (productError || !productRow) {
      return NextResponse.json(
        { ok: true, reviews: [], averageRating: null, reviewCount: 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }

    const googleRows = await fetchApprovedGoogleReviewsForProduct(db, operatorId, productId, limit)
    const googleItems = mapGoogleReviewsToProductItems(googleRows, locale)
    if (googleItems.length >= limit) {
      const ratings = googleRows
        .map((row) => row.rating)
        .filter((rating): rating is number => typeof rating === 'number')
      return NextResponse.json(
        {
          ok: true,
          reviews: googleItems.slice(0, limit),
          averageRating: computeAverageRatingFromNumbers(ratings),
          reviewCount: googleRows.length,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }
  }

  let reservations: ReservationRow[] = []

  if (productId) {
    const { data, error } = await db
      .from('reservations')
      .select('id, customer_id, product_id')
      .eq('product_id', productId)
      .eq('archive', false)
      .not('status', 'eq', 'cancelled')

    if (error) {
      console.error('[product-reviews] reservation query failed', error)
      return NextResponse.json({ ok: false, message: 'Query failed' }, { status: 500 })
    }

    reservations = (data ?? []) as ReservationRow[]
  } else {
    const { data: recentReviews, error: recentError } = await db
      .from('reservation_reviews')
      .select('reservation_id')
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(80)

    if (recentError) {
      console.error('[product-reviews] recent review query failed', recentError)
      return NextResponse.json({ ok: false, message: 'Query failed' }, { status: 500 })
    }

    const reservationIds = [
      ...new Set((recentReviews ?? []).map((row) => row.reservation_id).filter(Boolean)),
    ]

    if (!reservationIds.length) {
      return NextResponse.json(
        { ok: true, reviews: [], averageRating: null, reviewCount: 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }

    const { data, error } = await db
      .from('reservations')
      .select('id, customer_id, product_id')
      .in('id', reservationIds)
      .eq('archive', false)
      .not('status', 'eq', 'cancelled')

    if (error) {
      console.error('[product-reviews] reservation batch query failed', error)
      return NextResponse.json({ ok: false, message: 'Query failed' }, { status: 500 })
    }

    reservations = (data ?? []) as ReservationRow[]
  }

  if (!reservations.length) {
    if (productId) {
      const googleRows = await fetchApprovedGoogleReviewsForProduct(db, operatorId, productId, limit)
      const merged = mergeAndMapProductReviews({
        normalizedReviews: [],
        guestNames: new Map(),
        googleRows,
        locale,
        limit,
      })
      return NextResponse.json(
        {
          ok: true,
          reviews: merged.reviews,
          averageRating: merged.averageRating,
          reviewCount: merged.reviewCount,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }

    return NextResponse.json(
      { ok: true, reviews: [], averageRating: null, reviewCount: 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  }

  let activeProductIds = new Set<string>()
  if (!productId) {
    const productIds = [
      ...new Set(
        reservations.map((row) => row.product_id).filter((id): id is string => Boolean(id))
      ),
    ]

    if (productIds.length) {
      const { data: activeProducts } = await db
        .from('products')
        .select('id')
        .in('id', productIds)
        .eq('operator_id', operatorId)
        .eq('status', 'active')

      activeProductIds = new Set((activeProducts ?? []).map((row) => row.id))
      reservations = reservations.filter(
        (row) => row.product_id && activeProductIds.has(row.product_id)
      )
    } else {
      reservations = []
    }
  }

  if (!reservations.length) {
    if (productId) {
      const googleRows = await fetchApprovedGoogleReviewsForProduct(db, operatorId, productId, limit)
      const merged = mergeAndMapProductReviews({
        normalizedReviews: [],
        guestNames: new Map(),
        googleRows,
        locale,
        limit,
      })
      return NextResponse.json(
        {
          ok: true,
          reviews: merged.reviews,
          averageRating: merged.averageRating,
          reviewCount: merged.reviewCount,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }

    return NextResponse.json(
      { ok: true, reviews: [], averageRating: null, reviewCount: 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  }

  const reservationIds = reservations.map((row) => row.id)
  const { data: reviewRows, error: reviewError } = await db
    .from('reservation_reviews')
    .select('id, reservation_id, rating, content, platform, created_at')
    .in('reservation_id', reservationIds)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (reviewError) {
    console.error('[product-reviews] review query failed', reviewError)
    return NextResponse.json({ ok: false, message: 'Query failed' }, { status: 500 })
  }

  const normalizedReviews = (reviewRows ?? [])
    .filter(
      (row): row is PublicProductReviewRow =>
        typeof row.content === 'string' && row.content.trim().length > 0
    )
    .map((row) => ({
      id: row.id,
      reservation_id: row.reservation_id,
      rating: row.rating,
      content: row.content!.trim(),
      platform: row.platform,
      created_at: row.created_at,
    }))

  const reviewReservationIds = [
    ...new Set(normalizedReviews.map((row) => row.reservation_id)),
  ]
  const relevantReservations = reservations.filter((row) =>
    reviewReservationIds.includes(row.id)
  )

  const guestNames = await resolveGuestNames(
    db,
    reviewReservationIds,
    relevantReservations,
    locale
  )

  const googleRows = productId
    ? await fetchApprovedGoogleReviewsForProduct(db, operatorId, productId, limit)
    : []

  if (productId) {
    const merged = mergeAndMapProductReviews({
      normalizedReviews,
      guestNames,
      googleRows,
      locale,
      limit,
    })

    return NextResponse.json(
      {
        ok: true,
        reviews: merged.reviews,
        averageRating: merged.averageRating,
        reviewCount: merged.reviewCount,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  }

  const reviews = mapReviewRowsToProductItems(normalizedReviews, guestNames, locale)
  const averageRating = computeAverageRating(normalizedReviews)

  return NextResponse.json(
    {
      ok: true,
      reviews,
      averageRating,
      reviewCount: normalizedReviews.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
