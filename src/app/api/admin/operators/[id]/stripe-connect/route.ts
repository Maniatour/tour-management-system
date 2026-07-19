import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import {
  startOperatorStripeConnectOnboarding,
  syncOperatorStripeConnectStatus,
} from '@/lib/operators/stripeConnect'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/operators/:id/stripe-connect
 * Refresh Connect status from Stripe Account API.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const result = await syncOperatorStripeConnectStatus(supabaseAdmin, id)
    return NextResponse.json({
      ok: true,
      ...result,
      hint: 'Destination checkout: set COMMERCE_STRIPE_CONNECT_CHECKOUT=* (or operator id) when status=enabled. See ADR 015.',
    })
  } catch (err) {
    console.error('[admin/operators stripe-connect GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'sync failed' },
      { status: 400 }
    )
  }
}

/**
 * POST /api/admin/operators/:id/stripe-connect
 * Body: { locale?: 'ko'|'en' }
 * Creates Express account if needed and returns Account Link URL.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY is not configured' },
      { status: 503 }
    )
  }

  const { id } = await context.params
  try {
    const body = (await request.json().catch(() => ({}))) as { locale?: string }
    const locale = body.locale === 'en' ? 'en' : 'ko'

    const { data: owner } = await supabaseAdmin
      .from('operator_members')
      .select('email')
      .eq('operator_id', id)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const result = await startOperatorStripeConnectOnboarding(supabaseAdmin, {
      operatorId: id,
      locale,
      ownerEmail: owner?.email ?? null,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint: 'Open onboardingUrl in the browser. account.updated webhook (or GET refresh) updates stripe_connect_status.',
    })
  } catch (err) {
    console.error('[admin/operators stripe-connect POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'onboarding failed' },
      { status: 400 }
    )
  }
}
