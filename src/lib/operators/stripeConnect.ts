/**
 * Stripe Connect Express onboarding for SaaS operators (Phase 5d).
 * Destination-charge checkout cutover: Phase 5f (stripeConnectCheckout.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import type { Database } from '@/lib/supabase'
import { getStripeClient } from '@/lib/customerBookingCheckout'
import { getAppOrigin } from '@/lib/appOrigin'

export type StripeConnectStatus =
  | 'not_started'
  | 'pending'
  | 'restricted'
  | 'enabled'
  | 'disabled'

type Db = SupabaseClient<Database>

type OperatorConnectRow = {
  id: string
  name: string
  slug: string
  status: string
  stripe_connect_account_id: string | null
  stripe_connect_status: string
}

export function mapStripeAccountToConnectStatus(account: Stripe.Account): StripeConnectStatus {
  if (account.charges_enabled && account.payouts_enabled) {
    return 'enabled'
  }

  const disabledReason = account.requirements?.disabled_reason
  if (disabledReason) {
    if (String(disabledReason).includes('rejected') || account.charges_enabled === false) {
      // Rejected / permanently blocked → disabled; otherwise restricted
      if (String(disabledReason).startsWith('rejected')) return 'disabled'
    }
    return 'restricted'
  }

  const currentlyDue = account.requirements?.currently_due?.length ?? 0
  const pastDue = account.requirements?.past_due?.length ?? 0
  if (currentlyDue > 0 || pastDue > 0) {
    return account.details_submitted ? 'restricted' : 'pending'
  }

  if (account.details_submitted) {
    return 'pending'
  }

  return 'pending'
}

function connectReturnUrls(operatorId: string, locale: string) {
  const loc = locale === 'en' ? 'en' : 'ko'
  const base = getAppOrigin()
  const q = `connect=1&operator=${encodeURIComponent(operatorId)}`
  return {
    returnUrl: `${base}/${loc}/admin/operators?${q}&connect_result=return`,
    refreshUrl: `${base}/${loc}/admin/operators?${q}&connect_result=refresh`,
  }
}

async function loadOperator(db: Db, operatorId: string): Promise<OperatorConnectRow> {
  const { data, error } = await db
    .from('operators')
    .select('id, name, slug, status, stripe_connect_account_id, stripe_connect_status')
    .eq('id', operatorId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Operator not found')
  return data as OperatorConnectRow
}

async function persistConnectState(
  db: Db,
  operatorId: string,
  accountId: string,
  status: StripeConnectStatus
): Promise<void> {
  const { error } = await db
    .from('operators')
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_status: status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', operatorId)

  if (error) throw new Error(error.message)
}

/**
 * Ensure Express account exists, create Account Link, set status pending.
 */
export async function startOperatorStripeConnectOnboarding(
  db: Db,
  params: { operatorId: string; locale?: string; ownerEmail?: string | null }
): Promise<{
  accountId: string
  onboardingUrl: string
  status: StripeConnectStatus
  createdAccount: boolean
}> {
  const stripe = getStripeClient()
  const operator = await loadOperator(db, params.operatorId)
  let accountId = (operator.stripe_connect_account_id || '').trim()
  let createdAccount = false

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      ...(params.ownerEmail?.trim()
        ? { email: params.ownerEmail.trim().toLowerCase() }
        : {}),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: operator.name,
        product_description: 'Tour and experience bookings',
      },
      metadata: {
        operator_id: operator.id,
        operator_slug: operator.slug,
      },
    })
    accountId = account.id
    createdAccount = true
    await persistConnectState(db, operator.id, accountId, 'pending')
  } else {
    // Re-open onboarding: keep pending until webhook/sync says otherwise
    await persistConnectState(db, operator.id, accountId, 'pending')
  }

  const { returnUrl, refreshUrl } = connectReturnUrls(operator.id, params.locale || 'ko')
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })

  if (!link.url) {
    throw new Error('Stripe Account Link URL missing')
  }

  return {
    accountId,
    onboardingUrl: link.url,
    status: 'pending',
    createdAccount,
  }
}

/** Pull latest Account from Stripe and update operators row. */
export async function syncOperatorStripeConnectStatus(
  db: Db,
  operatorId: string
): Promise<{
  accountId: string | null
  status: StripeConnectStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}> {
  const operator = await loadOperator(db, operatorId)
  const accountId = (operator.stripe_connect_account_id || '').trim()
  if (!accountId) {
    return {
      accountId: null,
      status: 'not_started',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    }
  }

  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(accountId)
  const status = mapStripeAccountToConnectStatus(account)
  await persistConnectState(db, operator.id, accountId, status)

  return {
    accountId,
    status,
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted,
  }
}

/**
 * Webhook helper: find operator by Connect account id (metadata fallback).
 */
export async function syncOperatorFromStripeAccountEvent(
  db: Db,
  account: Stripe.Account
): Promise<{ operatorId: string | null; status: StripeConnectStatus | null }> {
  const status = mapStripeAccountToConnectStatus(account)
  const metaOperatorId = (account.metadata?.operator_id || '').trim()

  let operatorId = metaOperatorId
  if (!operatorId) {
    const { data } = await db
      .from('operators')
      .select('id')
      .eq('stripe_connect_account_id', account.id)
      .maybeSingle()
    operatorId = data?.id || ''
  }

  if (!operatorId) {
    return { operatorId: null, status: null }
  }

  await persistConnectState(db, operatorId, account.id, status)
  return { operatorId, status }
}
