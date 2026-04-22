import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'
import { residentCheckFinalizeBlockers } from '@/lib/residentCheckFinalize'

let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY missing')
    stripeInstance = new Stripe(secretKey, { timeout: 30000, maxNetworkRetries: 2 })
  }
  return stripeInstance
}

/**
 * POST /api/resident-check/create-payment-intent
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server is not configured for this feature.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const rawToken = typeof body.token === 'string' ? body.token : ''
    const bundle = await getTokenBundleByRawToken(rawToken)
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid or unknown link.' }, { status: 404 })
    }

    const { token, submission } = bundle
    if (!submission) {
      return NextResponse.json({ error: 'Please save the questionnaire first.' }, { status: 400 })
    }
    if (token.completed_at) {
      return NextResponse.json({ error: 'Already completed.' }, { status: 400 })
    }
    if (tokenIsExpired(token)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 400 })
    }

    const blockers = residentCheckFinalizeBlockers(submission)
    if (blockers.length > 0) {
      return NextResponse.json({ error: 'Incomplete form.', blockers }, { status: 400 })
    }

    if (submission.payment_method !== 'card') {
      return NextResponse.json({ error: 'Card payment is not selected.' }, { status: 400 })
    }

    const amount = submission.total_charge_usd_cents
    if (!amount || amount < 50) {
      return NextResponse.json({ error: 'No card amount due for this submission.' }, { status: 400 })
    }

    const stripe = getStripe()

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('customer_id')
      .eq('id', token.reservation_id)
      .maybeSingle()

    let customerEmail = ''
    let customerName = ''
    const cid = (reservation as { customer_id?: string | null } | null)?.customer_id
    if (cid) {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('name, email')
        .eq('id', cid)
        .maybeSingle()
      const c = cust as { name?: string; email?: string } | null
      customerEmail = (c?.email || '').trim()
      customerName = (c?.name || '').trim()
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        resident_check_token_id: token.id,
        reservation_id: token.reservation_id,
        purpose: 'resident_check_nps',
      },
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail || undefined,
      description: `NPS / residency — reservation ${token.reservation_id}`,
    })

    await supabaseAdmin
      .from('resident_check_submissions')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_payment_status: paymentIntent.status,
        updated_at: new Date().toISOString(),
      })
      .eq('token_id', token.id)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: 'usd',
      customerName,
      customerEmail,
    })
  } catch (e) {
    console.error('resident-check/create-payment-intent', e)
    const msg = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
