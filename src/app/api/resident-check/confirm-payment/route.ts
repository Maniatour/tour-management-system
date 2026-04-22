import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'
import { residentCheckFinalizeBlockers } from '@/lib/residentCheckFinalize'
import {
  markResidentCheckTokenCompleted,
  syncCustomerFromResidentCheckSubmission,
} from '@/lib/residentCheckSyncCustomer'

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
 * POST /api/resident-check/confirm-payment
 * Body: { token: string, paymentIntentId: string }
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
    const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : ''

    const bundle = await getTokenBundleByRawToken(rawToken)
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid or unknown link.' }, { status: 404 })
    }

    const { token, submission } = bundle
    if (!submission) {
      return NextResponse.json({ error: 'Nothing to confirm.' }, { status: 400 })
    }
    if (token.completed_at) {
      return NextResponse.json({ ok: true, alreadyCompleted: true })
    }
    if (tokenIsExpired(token)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 400 })
    }

    const blockers = residentCheckFinalizeBlockers(submission)
    if (blockers.length > 0) {
      return NextResponse.json({ error: 'Incomplete form.', blockers }, { status: 400 })
    }

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId required.' }, { status: 400 })
    }

    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (pi.metadata?.resident_check_token_id !== token.id) {
      return NextResponse.json({ error: 'Payment does not match this link.' }, { status: 400 })
    }

    if (pi.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed yet.', status: pi.status },
        { status: 400 }
      )
    }

    await supabaseAdmin
      .from('resident_check_submissions')
      .update({
        stripe_payment_intent_id: pi.id,
        stripe_payment_status: pi.status,
        updated_at: new Date().toISOString(),
      })
      .eq('token_id', token.id)

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('customer_id')
      .eq('id', token.reservation_id)
      .maybeSingle()

    const customerId = (reservation as { customer_id?: string | null } | null)?.customer_id ?? null
    await syncCustomerFromResidentCheckSubmission({
      customerId,
      submission: {
        ...submission,
        stripe_payment_intent_id: pi.id,
        stripe_payment_status: pi.status,
      },
    })
    await markResidentCheckTokenCompleted(token.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('resident-check/confirm-payment', e)
    const msg = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
