import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CUSTOMER_CHECKOUT_PURPOSE,
  finalizeCustomerBookingPaymentByIntent,
  getStripeClient,
} from '@/lib/customerBookingCheckout'
import { markInvoicePaidFromStripeWebhook } from '@/lib/payableInvoice'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/stripe
 * - payment_intent.succeeded → 고객 웹 예약 확정 (idempotent)
 * - invoice.paid → 스태프 발행 인보이스 paid 처리 (idempotent)
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhooks/stripe] STRIPE_WEBHOOK_SECRET missing')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event

  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[webhooks/stripe] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      if (pi.metadata?.purpose === CUSTOMER_CHECKOUT_PURPOSE) {
        const result = await finalizeCustomerBookingPaymentByIntent(supabaseAdmin, pi.id)
        console.log('[webhooks/stripe] finalized', {
          paymentIntentId: pi.id,
          reservationId: result.reservationId,
          alreadyFinalized: result.alreadyFinalized,
        })
      }
    }

    if (event.type === 'invoice.paid') {
      const stripeInvoice = event.data.object as Stripe.Invoice
      const result = await markInvoicePaidFromStripeWebhook(supabaseAdmin, stripeInvoice)
      console.log('[webhooks/stripe] invoice.paid', {
        stripeInvoiceId: stripeInvoice.id,
        ...result,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhooks/stripe] handler error', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
