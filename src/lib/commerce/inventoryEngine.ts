/**
 * Commerce Inventory Engine v2 — check / hold / commit / release.
 * Enforced only when COMMERCE_V2_INVENTORY_PRODUCTS matches the product.
 * Uses optimistic version on allotment rows; best-effort ledger.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { isCommerceV2InventoryEnabled } from '@/lib/commerce/commerceV2Flags'

export type InventoryDb = SupabaseClient<Database>

/** Seeded in 20260718120000_commerce_inventory_v2_tables.sql */
export const DEFAULT_SHARED_SEATS_RESOURCE_ID =
  'b0000000-0000-4000-8000-000000000001' as const

const HOLD_TTL_MINUTES_DEFAULT = 30
const OPTIMISTIC_RETRIES = 5

export type InventoryCheckResult = {
  ok: boolean
  available: number
  required: number
  resourceId: string
  allotmentId: string | null
  reason?: string | undefined
}

export type InventoryHoldResult =
  | { ok: true; holdIds: string[] }
  | { ok: false; reason: string }

type BindingRow = {
  id: string
  resource_id: string
  qty_per_guest: number
  scope_type: string
  scope_id: string
}

type AllotmentRow = {
  id: string
  resource_id: string
  operator_id: string
  date: string
  start_time: string | null
  total_qty: number
  held_qty: number
  sold_qty: number
  version: number
}

function availableQty(a: Pick<AllotmentRow, 'total_qty' | 'held_qty' | 'sold_qty'>): number {
  return Math.max(0, a.total_qty - a.held_qty - a.sold_qty)
}

function requiredFromBinding(guestQty: number, qtyPerGuest: number): number {
  return Math.max(1, Math.ceil(guestQty * Number(qtyPerGuest || 1)))
}

/** Release expired held rows before capacity checks. */
export async function expireStaleHolds(
  db: InventoryDb,
  operatorId: string = KOVEgAS_OPERATOR_ID
): Promise<number> {
  const now = new Date().toISOString()
  const { data: stale, error } = await db
    .from('inventory_holds')
    .select('id, allotment_id, resource_id, qty, operator_id')
    .eq('operator_id', operatorId)
    .eq('status', 'held')
    .lt('expires_at', now)
    .limit(100)

  if (error || !stale?.length) return 0

  let released = 0
  for (const hold of stale) {
    const ok = await releaseHoldInternal(db, {
      holdId: hold.id,
      allotmentId: hold.allotment_id,
      resourceId: hold.resource_id,
      operatorId: hold.operator_id,
      qty: hold.qty,
      nextStatus: 'expired',
    })
    if (ok) released += 1
  }
  return released
}

async function loadBindings(
  db: InventoryDb,
  params: {
    operatorId: string
    productId: string
    choiceOptionIds?: string[]
  }
): Promise<BindingRow[]> {
  const scopes: { scope_type: string; scope_id: string }[] = [
    { scope_type: 'product', scope_id: params.productId },
  ]
  for (const id of params.choiceOptionIds || []) {
    if (id) scopes.push({ scope_type: 'choice_option', scope_id: id })
  }

  const { data, error } = await db
    .from('inventory_bindings')
    .select('id, resource_id, qty_per_guest, scope_type, scope_id')
    .eq('operator_id', params.operatorId)
    .eq('is_active', true)
    .in(
      'scope_type',
      Array.from(new Set(scopes.map((s) => s.scope_type)))
    )

  if (error) {
    console.warn('[inventoryEngine] loadBindings:', error.message)
    return []
  }

  const wanted = new Set(scopes.map((s) => `${s.scope_type}:${s.scope_id}`))
  return (data || []).filter((row) => wanted.has(`${row.scope_type}:${row.scope_id}`))
}

/**
 * Ensure product → default shared seats binding exists (idempotent).
 */
export async function ensureProductSeatBinding(
  db: InventoryDb,
  params: {
    operatorId?: string
    productId: string
    resourceId?: string
    qtyPerGuest?: number
  }
): Promise<string | null> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  const resourceId = params.resourceId || DEFAULT_SHARED_SEATS_RESOURCE_ID

  const { data, error } = await db
    .from('inventory_bindings')
    .upsert(
      {
        operator_id: operatorId,
        resource_id: resourceId,
        scope_type: 'product',
        scope_id: params.productId,
        qty_per_guest: params.qtyPerGuest ?? 1,
        is_active: true,
      },
      { onConflict: 'resource_id,scope_type,scope_id' }
    )
    .select('id')
    .maybeSingle()

  if (error) {
    console.warn('[inventoryEngine] ensureProductSeatBinding:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Ensure allotment row for resource×date (optional start_time).
 * Creates with totalQty when missing.
 */
export async function ensureAllotment(
  db: InventoryDb,
  params: {
    operatorId?: string
    resourceId: string
    date: string
    startTime?: string | null
    totalQty: number
  }
): Promise<AllotmentRow | null> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  const startTime = params.startTime || null

  let query = db
    .from('inventory_allotments')
    .select(
      'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
    )
    .eq('resource_id', params.resourceId)
    .eq('date', params.date)

  if (startTime) {
    query = query.eq('start_time', startTime)
  } else {
    query = query.is('start_time', null)
  }

  const { data: existing } = await query.maybeSingle()
  if (existing) return existing as AllotmentRow

  const { data: inserted, error } = await db
    .from('inventory_allotments')
    .insert({
      operator_id: operatorId,
      resource_id: params.resourceId,
      date: params.date,
      start_time: startTime,
      total_qty: Math.max(0, params.totalQty),
      held_qty: 0,
      sold_qty: 0,
      version: 0,
    })
    .select(
      'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
    )
    .maybeSingle()

  if (inserted) return inserted as AllotmentRow

  // Unique race — re-select
  if (error) {
    const { data: again } = await query.maybeSingle()
    if (again) return again as AllotmentRow
    console.warn('[inventoryEngine] ensureAllotment:', error.message)
  }
  return null
}

async function defaultTotalQtyForProduct(
  db: InventoryDb,
  productId: string
): Promise<number> {
  const { data } = await db
    .from('products')
    .select('max_participants')
    .eq('id', productId)
    .maybeSingle()
  const max = Number(data?.max_participants)
  if (Number.isFinite(max) && max > 0) return max
  return 12
}

export async function checkInventory(
  db: InventoryDb,
  params: {
    operatorId?: string
    productId: string
    tourDate: string
    tourTime?: string | null
    guestQty: number
    choiceOptionIds?: string[]
    autoEnsureAllotment?: boolean
  }
): Promise<InventoryCheckResult[]> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  await expireStaleHolds(db, operatorId)

  const bindings = await loadBindings(db, {
    operatorId,
    productId: params.productId,
    ...(params.choiceOptionIds !== undefined ? { choiceOptionIds: params.choiceOptionIds } : {}),
  })

  if (bindings.length === 0) {
    return [
      {
        ok: true,
        available: Number.POSITIVE_INFINITY,
        required: params.guestQty,
        resourceId: '',
        allotmentId: null,
        reason: 'no_bindings',
      },
    ]
  }

  const results: InventoryCheckResult[] = []
  const defaultTotal = params.autoEnsureAllotment
    ? await defaultTotalQtyForProduct(db, params.productId)
    : 0

  for (const binding of bindings) {
    const required = requiredFromBinding(params.guestQty, binding.qty_per_guest)
    let allotment: AllotmentRow | null = null

    let query = db
      .from('inventory_allotments')
      .select(
        'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
      )
      .eq('resource_id', binding.resource_id)
      .eq('date', params.tourDate)

    if (params.tourTime) {
      query = query.eq('start_time', params.tourTime)
    } else {
      query = query.is('start_time', null)
    }

    const { data } = await query.maybeSingle()
    allotment = (data as AllotmentRow | null) || null

    if (!allotment && params.autoEnsureAllotment) {
      allotment = await ensureAllotment(db, {
        operatorId,
        resourceId: binding.resource_id,
        date: params.tourDate,
        startTime: params.tourTime || null,
        totalQty: defaultTotal,
      })
    }

    if (!allotment) {
      results.push({
        ok: false,
        available: 0,
        required,
        resourceId: binding.resource_id,
        allotmentId: null,
        reason: 'no_allotment',
      })
      continue
    }

    const available = availableQty(allotment)
    results.push({
      ok: available >= required,
      available,
      required,
      resourceId: binding.resource_id,
      allotmentId: allotment.id,
      reason: available >= required ? undefined : 'insufficient',
    })
  }

  return results
}

async function appendLedger(
  db: InventoryDb,
  row: {
    operator_id: string
    resource_id: string
    allotment_id?: string | null
    hold_id?: string | null
    reservation_id?: string | null
    movement_type: 'adjust' | 'hold' | 'commit' | 'release' | 'expire'
    qty_delta: number
    note?: string | null
  }
): Promise<void> {
  const { error } = await db.from('inventory_ledger').insert(row)
  if (error) {
    console.warn('[inventoryEngine] ledger:', error.message)
  }
}

async function tryIncrementHeld(
  db: InventoryDb,
  allotment: AllotmentRow,
  qty: number
): Promise<AllotmentRow | null> {
  const nextHeld = allotment.held_qty + qty
  if (nextHeld + allotment.sold_qty > allotment.total_qty) return null

  const { data, error } = await db
    .from('inventory_allotments')
    .update({
      held_qty: nextHeld,
      version: allotment.version + 1,
    })
    .eq('id', allotment.id)
    .eq('version', allotment.version)
    .select(
      'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
    )
    .maybeSingle()

  if (error || !data) return null
  return data as AllotmentRow
}

/**
 * Hold inventory for a pending booking. No-op success when product flag is off
 * or when there are no bindings (legacy capacity path).
 */
export async function holdInventoryForBooking(
  db: InventoryDb,
  params: {
    operatorId?: string
    productId: string
    tourDate: string
    tourTime?: string | null
    guestQty: number
    reservationId: string
    choiceOptionIds?: string[]
    ttlMinutes?: number
    /** When true (default), create allotment from product.max_participants if missing */
    autoEnsureAllotment?: boolean
  }
): Promise<InventoryHoldResult> {
  if (!isCommerceV2InventoryEnabled(params.productId)) {
    return { ok: true, holdIds: [] }
  }

  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  await expireStaleHolds(db, operatorId)

  const checks = await checkInventory(db, {
    operatorId,
    productId: params.productId,
    tourDate: params.tourDate,
    ...(params.tourTime !== undefined ? { tourTime: params.tourTime } : {}),
    guestQty: params.guestQty,
    ...(params.choiceOptionIds !== undefined ? { choiceOptionIds: params.choiceOptionIds } : {}),
    autoEnsureAllotment: params.autoEnsureAllotment !== false,
  })

  if (checks.length === 1 && checks[0]?.reason === 'no_bindings') {
    // Flag on but no binding yet — do not block checkout
    return { ok: true, holdIds: [] }
  }

  const blocking = checks.find((c) => !c.ok)
  if (blocking) {
    return {
      ok: false,
      reason:
        blocking.reason === 'no_allotment'
          ? '재고 할당이 없습니다. 관리자에서 allotment를 시드하세요.'
          : `재고가 부족합니다. (가능 ${blocking.available} / 필요 ${blocking.required})`,
    }
  }

  const expiresAt = new Date(
    Date.now() + (params.ttlMinutes ?? HOLD_TTL_MINUTES_DEFAULT) * 60_000
  ).toISOString()

  const holdIds: string[] = []

  for (const check of checks) {
    if (!check.allotmentId || !check.resourceId) continue

    let held = false
    for (let attempt = 0; attempt < OPTIMISTIC_RETRIES; attempt++) {
      const { data: allotment } = await db
        .from('inventory_allotments')
        .select(
          'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
        )
        .eq('id', check.allotmentId)
        .maybeSingle()

      if (!allotment) {
        return { ok: false, reason: 'allotment_missing' }
      }

      const row = allotment as AllotmentRow
      if (availableQty(row) < check.required) {
        return {
          ok: false,
          reason: `재고가 부족합니다. (가능 ${availableQty(row)} / 필요 ${check.required})`,
        }
      }

      const updated = await tryIncrementHeld(db, row, check.required)
      if (!updated) continue

      const { data: holdRow, error: holdErr } = await db
        .from('inventory_holds')
        .insert({
          operator_id: operatorId,
          allotment_id: updated.id,
          resource_id: check.resourceId,
          qty: check.required,
          status: 'held',
          reservation_id: params.reservationId,
          expires_at: expiresAt,
        })
        .select('id')
        .maybeSingle()

      if (holdErr || !holdRow) {
        // Roll back held increment
        await db
          .from('inventory_allotments')
          .update({
            held_qty: Math.max(0, updated.held_qty - check.required),
            version: updated.version + 1,
          })
          .eq('id', updated.id)
          .eq('version', updated.version)
        return { ok: false, reason: holdErr?.message || 'hold_insert_failed' }
      }

      await appendLedger(db, {
        operator_id: operatorId,
        resource_id: check.resourceId,
        allotment_id: updated.id,
        hold_id: holdRow.id,
        reservation_id: params.reservationId,
        movement_type: 'hold',
        qty_delta: check.required,
      })

      holdIds.push(holdRow.id)
      held = true
      break
    }

    if (!held) {
      // Release any holds already taken for this reservation in this call
      await releaseInventoryForReservation(db, params.reservationId)
      return { ok: false, reason: 'inventory_conflict_retry_exhausted' }
    }
  }

  return { ok: true, holdIds }
}

async function releaseHoldInternal(
  db: InventoryDb,
  params: {
    holdId: string
    allotmentId: string
    resourceId: string
    operatorId: string
    qty: number
    nextStatus: 'released' | 'expired'
    reservationId?: string | null
  }
): Promise<boolean> {
  for (let attempt = 0; attempt < OPTIMISTIC_RETRIES; attempt++) {
    const { data: allotment } = await db
      .from('inventory_allotments')
      .select(
        'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
      )
      .eq('id', params.allotmentId)
      .maybeSingle()

    if (!allotment) break
    const row = allotment as AllotmentRow
    const nextHeld = Math.max(0, row.held_qty - params.qty)

    const { data: updated } = await db
      .from('inventory_allotments')
      .update({
        held_qty: nextHeld,
        version: row.version + 1,
      })
      .eq('id', row.id)
      .eq('version', row.version)
      .select('id')
      .maybeSingle()

    if (!updated) continue

    const { error } = await db
      .from('inventory_holds')
      .update({ status: params.nextStatus })
      .eq('id', params.holdId)
      .eq('status', 'held')

    if (error) {
      console.warn('[inventoryEngine] hold status:', error.message)
    }

    await appendLedger(db, {
      operator_id: params.operatorId,
      resource_id: params.resourceId,
      allotment_id: params.allotmentId,
      hold_id: params.holdId,
      reservation_id: params.reservationId ?? null,
      movement_type: params.nextStatus === 'expired' ? 'expire' : 'release',
      qty_delta: -params.qty,
    })
    return true
  }
  return false
}

export async function releaseInventoryForReservation(
  db: InventoryDb,
  reservationId: string
): Promise<number> {
  const { data: holds } = await db
    .from('inventory_holds')
    .select('id, allotment_id, resource_id, qty, operator_id, reservation_id')
    .eq('reservation_id', reservationId)
    .eq('status', 'held')

  if (!holds?.length) return 0

  let n = 0
  for (const hold of holds) {
    const ok = await releaseHoldInternal(db, {
      holdId: hold.id,
      allotmentId: hold.allotment_id,
      resourceId: hold.resource_id,
      operatorId: hold.operator_id,
      qty: hold.qty,
      nextStatus: 'released',
      reservationId: hold.reservation_id,
    })
    if (ok) n += 1
  }
  return n
}

export async function commitInventoryForReservation(
  db: InventoryDb,
  reservationId: string
): Promise<number> {
  const { data: holds } = await db
    .from('inventory_holds')
    .select('id, allotment_id, resource_id, qty, operator_id, reservation_id')
    .eq('reservation_id', reservationId)
    .eq('status', 'held')

  if (!holds?.length) return 0

  let n = 0
  for (const hold of holds) {
    for (let attempt = 0; attempt < OPTIMISTIC_RETRIES; attempt++) {
      const { data: allotment } = await db
        .from('inventory_allotments')
        .select(
          'id, resource_id, operator_id, date, start_time, total_qty, held_qty, sold_qty, version'
        )
        .eq('id', hold.allotment_id)
        .maybeSingle()

      if (!allotment) break
      const row = allotment as AllotmentRow
      const nextHeld = Math.max(0, row.held_qty - hold.qty)
      const nextSold = row.sold_qty + hold.qty

      if (nextHeld + nextSold > row.total_qty && nextSold > row.total_qty) {
        // Allow commit even if slightly over (hold already reserved capacity)
      }

      const { data: updated } = await db
        .from('inventory_allotments')
        .update({
          held_qty: nextHeld,
          sold_qty: nextSold,
          version: row.version + 1,
        })
        .eq('id', row.id)
        .eq('version', row.version)
        .select('id')
        .maybeSingle()

      if (!updated) continue

      const { error } = await db
        .from('inventory_holds')
        .update({ status: 'committed' })
        .eq('id', hold.id)
        .eq('status', 'held')

      if (error) {
        console.warn('[inventoryEngine] commit hold:', error.message)
      }

      await appendLedger(db, {
        operator_id: hold.operator_id,
        resource_id: hold.resource_id,
        allotment_id: hold.allotment_id,
        hold_id: hold.id,
        reservation_id: reservationId,
        movement_type: 'commit',
        qty_delta: hold.qty,
      })
      n += 1
      break
    }
  }
  return n
}

/**
 * Seed product binding + date-range allotments (admin tool).
 */
export async function seedProductInventory(
  db: InventoryDb,
  params: {
    operatorId?: string
    productId: string
    fromDate: string
    toDate: string
    totalQty?: number
    resourceId?: string
  }
): Promise<{ bindingId: string | null; allotmentsUpserted: number }> {
  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID
  const resourceId = params.resourceId || DEFAULT_SHARED_SEATS_RESOURCE_ID
  const totalQty =
    params.totalQty ?? (await defaultTotalQtyForProduct(db, params.productId))

  const bindingId = await ensureProductSeatBinding(db, {
    operatorId,
    productId: params.productId,
    resourceId,
  })

  const from = new Date(`${params.fromDate}T00:00:00Z`)
  const to = new Date(`${params.toDate}T00:00:00Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error('Invalid fromDate/toDate')
  }

  let allotmentsUpserted = 0
  const cursor = new Date(from)
  while (cursor <= to) {
    const date = cursor.toISOString().slice(0, 10)
    const existing = await ensureAllotment(db, {
      operatorId,
      resourceId,
      date,
      startTime: null,
      totalQty,
    })
    if (existing) {
      if (existing.total_qty !== totalQty && existing.held_qty === 0 && existing.sold_qty === 0) {
        await db
          .from('inventory_allotments')
          .update({ total_qty: totalQty })
          .eq('id', existing.id)
      }
      allotmentsUpserted += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return { bindingId, allotmentsUpserted }
}
