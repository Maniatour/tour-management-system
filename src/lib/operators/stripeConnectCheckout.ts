/**
 * Stripe Connect destination-charge cutover for public checkout (Phase 5f).
 * Default OFF — platform PaymentIntent path unchanged until flag is set.
 *
 * COMMERCE_STRIPE_CONNECT_CHECKOUT=
 *   unset/empty → off
 *   * | 1 | true | on → all operators (when Connect status=enabled)
 *   uuid,uuid → listed operator ids only
 *
 * STRIPE_CONNECT_APPLICATION_FEE_BPS= (basis points, default 0)
 *   e.g. 290 = 2.9% platform fee on charge amount
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

type Db = SupabaseClient<Database>

export type ConnectCheckoutMode = 'platform' | 'destination'

export type ConnectCheckoutResolution = {
  mode: ConnectCheckoutMode
  operatorId: string
  connectedAccountId: string | null
  applicationFeeCents: number
  reason: string
}

function parseOperatorIdFlag(raw: string | undefined): {
  all: boolean
  ids: Set<string>
} {
  const value = (raw || '').trim()
  if (!value) return { all: false, ids: new Set() }
  const lower = value.toLowerCase()
  if (lower === '*' || lower === '1' || lower === 'true' || lower === 'on') {
    return { all: true, ids: new Set() }
  }
  const ids = new Set(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  return { all: false, ids }
}

/** Whether Connect destination checkout is opted in for this operator. */
export function isStripeConnectCheckoutEnabled(
  operatorIdRaw?: string | null,
  rawFlag: string | undefined = process.env.COMMERCE_STRIPE_CONNECT_CHECKOUT
): boolean {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const { all, ids } = parseOperatorIdFlag(rawFlag)
  if (all) return true
  return ids.has(operatorId)
}

/** Platform fee in cents from BPS env (0 = no fee). */
export function computeConnectApplicationFeeCents(
  amountCents: number,
  bpsRaw: string | undefined = process.env.STRIPE_CONNECT_APPLICATION_FEE_BPS
): number {
  const bps = Number((bpsRaw || '0').trim())
  if (!Number.isFinite(bps) || bps <= 0 || amountCents <= 0) return 0
  const fee = Math.floor((amountCents * bps) / 10000)
  // Stripe requires fee < amount when using destination charges
  return Math.max(0, Math.min(fee, Math.max(0, amountCents - 1)))
}

/**
 * Resolve whether this checkout should use destination charges.
 * Never throws for missing Connect — falls back to platform (safe default).
 */
export async function resolveConnectCheckoutDestination(
  db: Db,
  operatorIdRaw: string | null | undefined,
  amountCents: number
): Promise<ConnectCheckoutResolution> {
  const operatorId = resolveOperatorId(operatorIdRaw)

  if (!isStripeConnectCheckoutEnabled(operatorId)) {
    return {
      mode: 'platform',
      operatorId,
      connectedAccountId: null,
      applicationFeeCents: 0,
      reason: 'flag_off',
    }
  }

  // Kovegas keeps historic platform settlement unless it has Connect enabled
  // and is explicitly in the flag set (already true if *). Still require enabled account.
  const { data, error } = await db
    .from('operators')
    .select('id, stripe_connect_account_id, stripe_connect_status')
    .eq('id', operatorId)
    .maybeSingle()

  if (error || !data) {
    console.warn('[stripeConnectCheckout] operator lookup failed → platform', error?.message)
    return {
      mode: 'platform',
      operatorId,
      connectedAccountId: null,
      applicationFeeCents: 0,
      reason: 'operator_missing',
    }
  }

  const accountId = (data.stripe_connect_account_id || '').trim()
  const status = String(data.stripe_connect_status || '')

  if (status !== 'enabled' || !accountId) {
    if (operatorId !== KOVEgAS_OPERATOR_ID) {
      console.warn('[stripeConnectCheckout] Connect not ready → platform', {
        operatorId,
        status,
        hasAccount: !!accountId,
      })
    }
    return {
      mode: 'platform',
      operatorId,
      connectedAccountId: null,
      applicationFeeCents: 0,
      reason: status !== 'enabled' ? 'connect_not_enabled' : 'missing_account',
    }
  }

  const applicationFeeCents = computeConnectApplicationFeeCents(amountCents)
  return {
    mode: 'destination',
    operatorId,
    connectedAccountId: accountId,
    applicationFeeCents,
    reason: 'connect_enabled',
  }
}
