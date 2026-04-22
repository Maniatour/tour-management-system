import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'

/**
 * GET /api/resident-check/session?t=RAW_TOKEN
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server is not configured for this feature.' },
        { status: 503 }
      )
    }

    const raw = request.nextUrl.searchParams.get('t') || ''
    const bundle = await getTokenBundleByRawToken(raw)
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid or unknown link.' }, { status: 404 })
    }

    const { token, submission } = bundle
    const expired = tokenIsExpired(token)
    const completed = Boolean(token.completed_at)

    const { data: reservation, error: rezErr } = await supabaseAdmin
      .from('reservations')
      .select('id, tour_date, channel_rn, adults, child, infant, product_id, customer_id')
      .eq('id', token.reservation_id)
      .maybeSingle()

    if (rezErr || !reservation) {
      return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 })
    }

    let productName: string | null = null
    if (reservation.product_id) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('name, name_ko, name_en')
        .eq('id', reservation.product_id)
        .maybeSingle()
      const p = product as { name?: string; name_ko?: string; name_en?: string } | null
      if (p) {
        productName = (p.name_ko || p.name_en || p.name || '').trim() || null
      }
    }

    let customerName: string | null = null
    let customerEmail: string | null = null
    if (reservation.customer_id) {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('name, email')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      const c = cust as { name?: string; email?: string } | null
      customerName = c?.name ?? null
      customerEmail = (c?.email || '').trim() || null
    }

    return NextResponse.json({
      ok: true,
      expired,
      completed,
      expiresAt: token.expires_at,
      reservation: {
        id: reservation.id,
        tour_date: reservation.tour_date,
        channel_rn: reservation.channel_rn,
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        productName,
        customerName,
        customerEmail,
      },
      submission,
    })
  } catch (e) {
    console.error('resident-check/session', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
