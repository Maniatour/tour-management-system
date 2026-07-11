import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  computeAverageRating,
  mapReviewRowsToProductItems,
  type PublicProductReviewRow,
} from '@/lib/productReviewDisplay'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  if (productId && !UUID_RE.test(productId)) {
    return NextResponse.json({ ok: false, message: 'Invalid product_id' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: 'Service unavailable' }, { status: 503 })
  }

  const db = supabaseAdmin

  if (productId) {
    const { data: productRow, error: productError } = await db
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('status', 'active')
      .maybeSingle()

    if (productError || !productRow) {
      return NextResponse.json(
        { ok: true, reviews: [], averageRating: null, reviewCount: 0 },
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
