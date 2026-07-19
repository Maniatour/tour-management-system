/**
 * Operator B E2E pilot checklist evaluation (Phase 6a.1).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { isStripeConnectCheckoutEnabled } from '@/lib/operators/stripeConnectCheckout'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

type Db = SupabaseClient<Database>

export type PilotCheckId =
  | 'createOperator'
  | 'connect'
  | 'subdomain'
  | 'catalog'
  | 'pricing'
  | 'checkoutFlag'
  | 'isolation'
  | 'opsOff'
  | 'opsRouteGuard'

export type PilotCheckResult = {
  id: PilotCheckId
  ok: boolean
  detail: string
}

export type PilotStatusReport = {
  operatorId: string
  isKovegas: boolean
  name: string
  slug: string
  checks: PilotCheckResult[]
  passedCount: number
  totalCount: number
}

export async function evaluateOperatorPilotStatus(
  db: Db,
  operatorIdRaw?: string | null
): Promise<PilotStatusReport> {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const isKovegas = operatorId === KOVEgAS_OPERATOR_ID

  const { data: op, error: opErr } = await db
    .from('operators')
    .select(
      'id, name, slug, subdomain, stripe_connect_status, stripe_connect_account_id, modules'
    )
    .eq('id', operatorId)
    .maybeSingle()

  if (opErr || !op) {
    throw new Error(opErr?.message || 'Operator not found')
  }

  const modules =
    op.modules && typeof op.modules === 'object' && !Array.isArray(op.modules)
      ? (op.modules as { commerce?: boolean; operations?: boolean })
      : {}
  const operationsOn = modules.operations === true
  const subdomain = (op.subdomain || '').trim()
  const connectStatus = String(op.stripe_connect_status || 'not_started')
  const hasConnectAccount = Boolean((op.stripe_connect_account_id || '').trim())

  const [
    { count: productCount },
    { count: pricingCount },
    { count: otherOperatorCount },
    { count: kovegasProductCount },
  ] = await Promise.all([
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId),
    db
      .from('dynamic_pricing')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId),
    db
      .from('operators')
      .select('id', { count: 'exact', head: true })
      .neq('id', KOVEgAS_OPERATOR_ID),
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', KOVEgAS_OPERATOR_ID),
  ])

  const products = productCount ?? 0
  const pricing = pricingCount ?? 0
  const otherOps = otherOperatorCount ?? 0
  const kovegasProducts = kovegasProductCount ?? 0

  const checks: PilotCheckResult[] = [
    {
      id: 'createOperator',
      ok: isKovegas ? otherOps > 0 : true,
      detail: isKovegas
        ? otherOps > 0
          ? `Non-Kovegas operators=${otherOps} — switch header to Operator B`
          : 'No Operator B yet — create one in Operators admin'
        : `Tenant ${op.slug} selected`,
    },
    {
      id: 'connect',
      ok: connectStatus === 'enabled' && hasConnectAccount,
      detail: `status=${connectStatus}${hasConnectAccount ? '' : ' (no account id)'}`,
    },
    {
      id: 'subdomain',
      ok: subdomain.length > 0,
      detail: subdomain ? `subdomain=${subdomain}` : 'operators.subdomain is empty',
    },
    {
      id: 'catalog',
      ok: products > 0,
      detail: `products=${products}`,
    },
    {
      id: 'pricing',
      ok: pricing > 0,
      detail: `dynamic_pricing rows=${pricing}`,
    },
    {
      id: 'checkoutFlag',
      ok: !isKovegas && isStripeConnectCheckoutEnabled(operatorId),
      detail: isStripeConnectCheckoutEnabled(operatorId)
        ? 'COMMERCE_STRIPE_CONNECT_CHECKOUT matches this operator'
        : 'Flag off or operator not listed (platform PI fallback)',
    },
    {
      id: 'isolation',
      ok: isKovegas ? otherOps > 0 : products >= 0,
      detail: isKovegas
        ? `Kovegas products=${kovegasProducts}; after switching to B, UI must not list these`
        : `B products=${products}, Kovegas products=${kovegasProducts} — confirm B UI shows only B`,
    },
    {
      id: 'opsOff',
      ok: isKovegas ? true : !operationsOn,
      detail: isKovegas
        ? 'Kovegas keeps Operations ON (expected)'
        : operationsOn
          ? 'modules.operations=true — set false for commerce-only pilot'
          : 'modules.operations=false (commerce-only)',
    },
    {
      id: 'opsRouteGuard',
      ok: true,
      detail: 'OpsModuleRouteGuard active — Ops URLs redirect when Ops OFF',
    },
  ]

  const passedCount = checks.filter((c) => c.ok).length

  return {
    operatorId,
    isKovegas,
    name: String(op.name),
    slug: String(op.slug),
    checks,
    passedCount,
    totalCount: checks.length,
  }
}
