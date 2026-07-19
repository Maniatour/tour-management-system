/**
 * Kovegas regression checks (Phase 6a.2).
 * Read-only — does not change booking/checkout behavior.
 * Proves Tenant #1 baselines still hold while SaaS flags stay opt-in.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import {
  isCommerceV2OtaInboundEnabled,
  isCommerceV2OtaLiveEnabled,
  parseCommerceV2ReadProductIds,
} from '@/lib/commerce/commerceV2Flags'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { KOVEgAS_DIRECT_CHANNEL_ID } from '@/lib/operators/resolvePublicDirectChannel'
import { resolvePublicDirectChannel } from '@/lib/operators/resolvePublicDirectChannel'
import { resolveConnectCheckoutDestination } from '@/lib/operators/stripeConnectCheckout'

type Db = SupabaseClient<Database>

export type RegressionCheckId =
  | 'kovegasRow'
  | 'kovegasOpsOn'
  | 'm00001Channel'
  | 'directChannelM00001'
  | 'kovegasCatalog'
  | 'platformCheckoutDefault'
  | 'otaLiveDefaultOff'
  | 'otaInboundDefaultOff'
  | 'commerceV2ReadNotGlobal'

export type RegressionCheckResult = {
  id: RegressionCheckId
  ok: boolean
  detail: string
}

export type KovegasRegressionReport = {
  checks: RegressionCheckResult[]
  passedCount: number
  totalCount: number
  allOk: boolean
}

export async function evaluateKovegasRegression(db: Db): Promise<KovegasRegressionReport> {
  const { data: op } = await db
    .from('operators')
    .select('id, slug, modules, status')
    .eq('id', KOVEgAS_OPERATOR_ID)
    .maybeSingle()

  const modules =
    op?.modules && typeof op.modules === 'object' && !Array.isArray(op.modules)
      ? (op.modules as { commerce?: boolean; operations?: boolean })
      : {}

  const [{ count: m00001Count }, { count: productCount }] = await Promise.all([
    db
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('id', KOVEgAS_DIRECT_CHANNEL_ID),
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', KOVEgAS_OPERATOR_ID),
  ])

  let directChannelId = ''
  let directOk = false
  try {
    const direct = await resolvePublicDirectChannel(db, KOVEgAS_OPERATOR_ID, {
      ensure: false,
    })
    directChannelId = direct.channelId
    directOk = direct.channelId === KOVEgAS_DIRECT_CHANNEL_ID
  } catch (err) {
    directChannelId = err instanceof Error ? err.message : 'resolve_failed'
    directOk = false
  }

  const connectDest = await resolveConnectCheckoutDestination(
    db,
    KOVEgAS_OPERATOR_ID,
    10_000
  )
  const platformCheckoutOk = connectDest.mode === 'platform'

  const v2Read = parseCommerceV2ReadProductIds()
  const v2ReadNotGlobal = !v2Read.all

  const checks: RegressionCheckResult[] = [
    {
      id: 'kovegasRow',
      ok: Boolean(op?.id),
      detail: op?.id
        ? `slug=${op.slug} status=${op.status}`
        : 'Kovegas operator row missing — apply SaaS foundation migration',
    },
    {
      id: 'kovegasOpsOn',
      ok: modules.operations === true,
      detail:
        modules.operations === true
          ? 'modules.operations=true (Ops Suite visible for Kovegas)'
          : 'modules.operations is not true — Kovegas Ops menus would hide',
    },
    {
      id: 'm00001Channel',
      ok: (m00001Count ?? 0) > 0,
      detail:
        (m00001Count ?? 0) > 0
          ? 'Homepage channel M00001 exists'
          : 'M00001 channel missing — Direct Web bookings break',
    },
    {
      id: 'directChannelM00001',
      ok: directOk,
      detail: directOk
        ? 'resolvePublicDirectChannel(Kovegas)=M00001'
        : `expected M00001 got ${directChannelId}`,
    },
    {
      id: 'kovegasCatalog',
      ok: (productCount ?? 0) > 0,
      detail: `Kovegas products=${productCount ?? 0}`,
    },
    {
      id: 'platformCheckoutDefault',
      ok: platformCheckoutOk,
      detail: platformCheckoutOk
        ? `Connect resolve mode=platform (reason=${connectDest.reason})`
        : `WARNING mode=destination — COMMERCE_STRIPE_CONNECT_CHECKOUT may include Kovegas (reason=${connectDest.reason})`,
    },
    {
      id: 'otaLiveDefaultOff',
      ok: !isCommerceV2OtaLiveEnabled(),
      detail: isCommerceV2OtaLiveEnabled()
        ? 'COMMERCE_V2_OTA_LIVE is ON — live OTA HTTP enabled'
        : 'COMMERCE_V2_OTA_LIVE off (safe default)',
    },
    {
      id: 'otaInboundDefaultOff',
      ok: !isCommerceV2OtaInboundEnabled(),
      detail: isCommerceV2OtaInboundEnabled()
        ? 'COMMERCE_V2_OTA_INBOUND is ON — auto inquiry possible'
        : 'COMMERCE_V2_OTA_INBOUND off (safe default)',
    },
    {
      id: 'commerceV2ReadNotGlobal',
      ok: v2ReadNotGlobal,
      detail: v2ReadNotGlobal
        ? v2Read.ids.size > 0
          ? `COMMERCE_V2_READ_PRODUCTS pilot list size=${v2Read.ids.size}`
          : 'COMMERCE_V2_READ_PRODUCTS unset (legacy RPC pricing)'
        : 'COMMERCE_V2_READ_PRODUCTS=* — all products on v2 read path',
    },
  ]

  const passedCount = checks.filter((c) => c.ok).length
  return {
    checks,
    passedCount,
    totalCount: checks.length,
    allOk: passedCount === checks.length,
  }
}
