/**
 * Commerce tenancy smoke (Phase 6e.0–6e.1).
 * Read-only — verifies operator_id stamp + partition for catalog/commerce/inventory.
 * Does not call checkout, Stripe, inventory hold, or change booking logic.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  KOVEgAS_DIRECT_CHANNEL_ID,
  resolvePublicDirectChannel,
} from '@/lib/operators/resolvePublicDirectChannel'
import { isStripeConnectCheckoutEnabled } from '@/lib/operators/stripeConnectCheckout'

type Db = SupabaseClient<Database>

export type CommerceIsolationCheckId =
  | 'stampProducts'
  | 'stampChannels'
  | 'stampChannelProducts'
  | 'stampDynamicPricing'
  | 'stampReservations'
  | 'stampCustomers'
  | 'stampRatePlans'
  | 'stampOffers'
  | 'kovegasCatalogBaseline'
  | 'tenantPartitionProducts'
  | 'tenantPartitionChannels'
  | 'directChannelResolve'
  | 'v2OfferProductSameTenant'
  | 'connectCheckoutFlag'
  | 'stampInventoryCore'
  | 'stampInventoryHoldsLedger'
  | 'channelProductSameTenant'
  | 'inventoryBindingResourceSameTenant'

export type CommerceIsolationCheckResult = {
  id: CommerceIsolationCheckId
  ok: boolean
  detail: string
}

export type CommerceIsolationReport = {
  operatorId: string
  isKovegas: boolean
  checks: CommerceIsolationCheckResult[]
  passedCount: number
  totalCount: number
  allOk: boolean
}

type CountResult = { count: number | null; error: { message?: string } | null }

async function countNullOperatorId(db: Db, table: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table)
    .select('id', { count: 'exact', head: true })
    .is('operator_id', null)
  return { count: count ?? null, error }
}

async function countForOperator(db: Db, table: string, operatorId: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table)
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
  return { count: count ?? null, error }
}

async function countAll(db: Db, table: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table).select('id', {
    count: 'exact',
    head: true,
  })
  return { count: count ?? null, error }
}

function stampCheck(
  id: CommerceIsolationCheckId,
  tableLabel: string,
  results: CountResult[]
): CommerceIsolationCheckResult {
  for (const r of results) {
    if (r.error) {
      return {
        id,
        ok: false,
        detail: `${tableLabel}: ${r.error.message || 'query failed'} — apply Phase 1b/3 commerce migrations?`,
      }
    }
  }
  const nullTotal = results.reduce((sum, r) => sum + (r.count ?? 0), 0)
  return {
    id,
    ok: nullTotal === 0,
    detail:
      nullTotal === 0
        ? `${tableLabel}: operator_id NOT NULL (stamp ok)`
        : `${tableLabel}: ${nullTotal} rows with NULL operator_id`,
  }
}

async function checkChannelProductSameTenant(db: Db): Promise<CommerceIsolationCheckResult> {
  const { data, error } = await fromUntypedTable(db, 'channel_products')
    .select('id, operator_id, product_id, channel_id')
    .limit(2000)

  if (error) {
    return {
      id: 'channelProductSameTenant',
      ok: false,
      detail: error.message || 'channel_products sample query failed',
    }
  }

  const rows = (data || []) as Array<{
    id: string
    operator_id: string
    product_id: string
    channel_id: string
  }>
  if (rows.length === 0) {
    return {
      id: 'channelProductSameTenant',
      ok: true,
      detail: 'no channel_products rows yet',
    }
  }

  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))]
  const channelIds = [...new Set(rows.map((r) => r.channel_id).filter(Boolean))]

  const [productsRes, channelsRes] = await Promise.all([
    productIds.length
      ? db.from('products').select('id, operator_id').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; operator_id: string | null }[], error: null }),
    channelIds.length
      ? db.from('channels').select('id, operator_id').in('id', channelIds)
      : Promise.resolve({ data: [] as { id: string; operator_id: string | null }[], error: null }),
  ])

  if (productsRes.error || channelsRes.error) {
    return {
      id: 'channelProductSameTenant',
      ok: false,
      detail:
        productsRes.error?.message ||
        channelsRes.error?.message ||
        'product/channel lookup failed',
    }
  }

  const productOp = new Map(
    (productsRes.data || []).map((p) => [String(p.id), String(p.operator_id || '')])
  )
  const channelOp = new Map(
    (channelsRes.data || []).map((c) => [String(c.id), String(c.operator_id || '')])
  )

  let mismatch = 0
  for (const row of rows) {
    const op = String(row.operator_id)
    const pOp = productOp.get(String(row.product_id))
    const cOp = channelOp.get(String(row.channel_id))
    if (!pOp || !cOp || pOp !== op || cOp !== op) mismatch += 1
  }

  return {
    id: 'channelProductSameTenant',
    ok: mismatch === 0,
    detail:
      mismatch === 0
        ? `sampled channel_products=${rows.length} — product/channel operator_id match`
        : `${mismatch}/${rows.length} channel_products cross-tenant product or channel`,
  }
}

async function checkInventoryBindingResourceSameTenant(
  db: Db
): Promise<CommerceIsolationCheckResult> {
  const { data, error } = await fromUntypedTable(db, 'inventory_bindings')
    .select('id, operator_id, resource_id')
    .limit(2000)

  if (error) {
    return {
      id: 'inventoryBindingResourceSameTenant',
      ok: false,
      detail: error.message || 'inventory_bindings sample query failed',
    }
  }

  const rows = (data || []) as Array<{
    id: string
    operator_id: string
    resource_id: string
  }>
  if (rows.length === 0) {
    return {
      id: 'inventoryBindingResourceSameTenant',
      ok: true,
      detail: 'no inventory_bindings yet (ok until inventory seed)',
    }
  }

  const resourceIds = [...new Set(rows.map((r) => r.resource_id))]
  const { data: resources, error: rErr } = await fromUntypedTable(db, 'inventory_resources')
    .select('id, operator_id')
    .in('id', resourceIds)

  if (rErr) {
    return {
      id: 'inventoryBindingResourceSameTenant',
      ok: false,
      detail: rErr.message || 'inventory_resources lookup failed',
    }
  }

  const byId = new Map(
    ((resources || []) as Array<{ id: string; operator_id: string }>).map((r) => [
      String(r.id),
      String(r.operator_id || ''),
    ])
  )
  let mismatch = 0
  for (const b of rows) {
    const resourceOp = byId.get(String(b.resource_id))
    if (!resourceOp || resourceOp !== String(b.operator_id)) mismatch += 1
  }

  return {
    id: 'inventoryBindingResourceSameTenant',
    ok: mismatch === 0,
    detail:
      mismatch === 0
        ? `sampled bindings=${rows.length} — resource.operator_id matches binding`
        : `${mismatch}/${rows.length} bindings have cross-tenant resource_id`,
  }
}

async function checkV2OfferProductSameTenant(db: Db): Promise<CommerceIsolationCheckResult> {
  const { data, error } = await fromUntypedTable(db, 'offers')
    .select('id, operator_id, product_id')
    .not('product_id', 'is', null)
    .limit(2000)

  if (error) {
    return {
      id: 'v2OfferProductSameTenant',
      ok: false,
      detail: error.message || 'offers sample query failed',
    }
  }

  const rows = (data || []) as Array<{
    id: string
    operator_id: string
    product_id: string
  }>
  if (rows.length === 0) {
    return {
      id: 'v2OfferProductSameTenant',
      ok: true,
      detail: 'no offers with product_id yet (ok until v2 materialize)',
    }
  }

  const productIds = [...new Set(rows.map((r) => r.product_id))]
  const { data: products, error: pErr } = await db
    .from('products')
    .select('id, operator_id')
    .in('id', productIds)

  if (pErr) {
    return {
      id: 'v2OfferProductSameTenant',
      ok: false,
      detail: pErr.message || 'products lookup failed',
    }
  }

  const byId = new Map(
    (products || []).map((p) => [String(p.id), String(p.operator_id || '')])
  )
  let mismatch = 0
  for (const o of rows) {
    const productOp = byId.get(String(o.product_id))
    if (!productOp || productOp !== String(o.operator_id)) mismatch += 1
  }

  return {
    id: 'v2OfferProductSameTenant',
    ok: mismatch === 0,
    detail:
      mismatch === 0
        ? `sampled offers=${rows.length} — product.operator_id matches offer.operator_id`
        : `${mismatch}/${rows.length} sampled offers have cross-tenant product_id`,
  }
}

export async function evaluateCommerceIsolation(
  db: Db,
  operatorIdRaw?: string | null
): Promise<CommerceIsolationReport> {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const isKovegas = operatorId === KOVEgAS_OPERATOR_ID

  const [
    nullProducts,
    nullChannels,
    nullChannelProducts,
    nullPricing,
    nullReservations,
    nullCustomers,
    nullRatePlans,
    nullOffers,
    nullInvResources,
    nullInvAllotments,
    nullInvBindings,
    nullInvHolds,
    nullInvLedger,
    kovegasProducts,
    activeProducts,
    allProducts,
    activeChannels,
    allChannels,
  ] = await Promise.all([
    countNullOperatorId(db, 'products'),
    countNullOperatorId(db, 'channels'),
    countNullOperatorId(db, 'channel_products'),
    countNullOperatorId(db, 'dynamic_pricing'),
    countNullOperatorId(db, 'reservations'),
    countNullOperatorId(db, 'customers'),
    countNullOperatorId(db, 'rate_plans'),
    countNullOperatorId(db, 'offers'),
    countNullOperatorId(db, 'inventory_resources'),
    countNullOperatorId(db, 'inventory_allotments'),
    countNullOperatorId(db, 'inventory_bindings'),
    countNullOperatorId(db, 'inventory_holds'),
    countNullOperatorId(db, 'inventory_ledger'),
    countForOperator(db, 'products', KOVEgAS_OPERATOR_ID),
    countForOperator(db, 'products', operatorId),
    countAll(db, 'products'),
    countForOperator(db, 'channels', operatorId),
    countAll(db, 'channels'),
  ])

  const checks: CommerceIsolationCheckResult[] = [
    stampCheck('stampProducts', 'products', [nullProducts]),
    stampCheck('stampChannels', 'channels', [nullChannels]),
    stampCheck('stampChannelProducts', 'channel_products', [nullChannelProducts]),
    stampCheck('stampDynamicPricing', 'dynamic_pricing', [nullPricing]),
    stampCheck('stampReservations', 'reservations', [nullReservations]),
    stampCheck('stampCustomers', 'customers', [nullCustomers]),
    stampCheck('stampRatePlans', 'rate_plans', [nullRatePlans]),
    stampCheck('stampOffers', 'offers', [nullOffers]),
    stampCheck('stampInventoryCore', 'inventory resources/allotments/bindings', [
      nullInvResources,
      nullInvAllotments,
      nullInvBindings,
    ]),
    stampCheck('stampInventoryHoldsLedger', 'inventory holds/ledger', [
      nullInvHolds,
      nullInvLedger,
    ]),
  ]

  if (kovegasProducts.error) {
    checks.push({
      id: 'kovegasCatalogBaseline',
      ok: false,
      detail: kovegasProducts.error.message || 'Kovegas products count failed',
    })
  } else {
    const n = kovegasProducts.count ?? 0
    checks.push({
      id: 'kovegasCatalogBaseline',
      ok: n > 0,
      detail:
        n > 0
          ? `Kovegas products=${n} (Tenant #1 catalog baseline)`
          : 'Kovegas products=0 — unexpected empty catalog',
    })
  }

  if (allProducts.error || activeProducts.error || kovegasProducts.error) {
    checks.push({
      id: 'tenantPartitionProducts',
      ok: false,
      detail: 'Could not compare products tenant partitions',
    })
  } else {
    const total = allProducts.count ?? 0
    const k = kovegasProducts.count ?? 0
    const active = activeProducts.count ?? 0
    const partitionOk = active <= total && k <= total && (nullProducts.count ?? 0) === 0
    checks.push({
      id: 'tenantPartitionProducts',
      ok: partitionOk,
      detail: isKovegas
        ? `total=${total} Kovegas=${k} — switch header to B and confirm B UI lists only B products`
        : `total=${total} Kovegas=${k} active(B)=${active} — B catalog must not show Kovegas products`,
    })
  }

  if (allChannels.error || activeChannels.error) {
    checks.push({
      id: 'tenantPartitionChannels',
      ok: false,
      detail: 'Could not compare channels tenant partitions',
    })
  } else {
    const total = allChannels.count ?? 0
    const active = activeChannels.count ?? 0
    const partitionOk = active <= total && (nullChannels.count ?? 0) === 0
    checks.push({
      id: 'tenantPartitionChannels',
      ok: partitionOk,
      detail: isKovegas
        ? `total=${total} active(Kovegas)=${active} — M00001 must remain Direct Web`
        : `total=${total} active(B)=${active} — B channels must be B-scoped only`,
    })
  }

  try {
    const resolved = await resolvePublicDirectChannel(db, operatorId, { ensure: false })
    const channelOk =
      resolved.channelId.length > 0 &&
      (isKovegas
        ? resolved.channelId === KOVEgAS_DIRECT_CHANNEL_ID
        : resolved.source === 'existing')
    checks.push({
      id: 'directChannelResolve',
      ok: channelOk,
      detail: isKovegas
        ? `Direct=${resolved.channelId} (expect ${KOVEgAS_DIRECT_CHANNEL_ID})`
        : `B Direct=${resolved.channelId} source=${resolved.source}`,
    })
  } catch (err) {
    checks.push({
      id: 'directChannelResolve',
      ok: false,
      detail:
        err instanceof Error
          ? err.message
          : 'Direct Web channel missing — create Homepage/Website channel for Operator B',
    })
  }

  checks.push(await checkV2OfferProductSameTenant(db))
  checks.push(await checkChannelProductSameTenant(db))
  checks.push(await checkInventoryBindingResourceSameTenant(db))

  const connectFlag = isStripeConnectCheckoutEnabled(operatorId)
  checks.push({
    id: 'connectCheckoutFlag',
    // Isolation smoke: Kovegas must stay platform; B flag is informational (E2E opt-in).
    ok: isKovegas ? !connectFlag : true,
    detail: isKovegas
      ? connectFlag
        ? 'COMMERCE_STRIPE_CONNECT_CHECKOUT lists Kovegas — prefer platform PI for Tenant #1'
        : 'Kovegas uses platform checkout (expected)'
      : connectFlag
        ? 'COMMERCE_STRIPE_CONNECT_CHECKOUT matches Operator B (Connect opt-in ready)'
        : 'Flag off — host book uses platform PI until Connect opt-in (ok for isolation)',
  })

  const passedCount = checks.filter((c) => c.ok).length
  return {
    operatorId,
    isKovegas,
    checks,
    passedCount,
    totalCount: checks.length,
    allOk: passedCount === checks.length,
  }
}
