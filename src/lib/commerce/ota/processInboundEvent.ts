/**
 * Process a stored OTA inbound event.
 * Default: resolve mapping only. Inquiry reservation when
 * COMMERCE_V2_OTA_INBOUND=1 + connection.config.autoCreateInquiry=true + fields present.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { isCommerceV2OtaInboundEnabled } from '@/lib/commerce/commerceV2Flags'
import { createPendingCustomerBooking } from '@/lib/customerBookingCheckout'
import { resolvePublicDirectChannel } from '@/lib/operators/resolvePublicDirectChannel'
import { normalizeInboundPayload } from '@/lib/commerce/ota/normalizeInboundPayload'
import type { OtaPlatform } from '@/lib/commerce/ota/types'

type Db = SupabaseClient<Database>

export type ProcessInboundResult = {
  inboundId: string
  status: string
  reservationId?: string
  reason?: string
}

function asPlatform(raw: string): OtaPlatform {
  const allowed: OtaPlatform[] = ['viator', 'klook', 'gyg', 'kkday', 'trip', 'other']
  return (allowed.includes(raw as OtaPlatform) ? raw : 'other') as OtaPlatform
}

export async function processOtaInboundEvent(
  db: Db,
  inboundId: string
): Promise<ProcessInboundResult> {
  const { data: row, error } = await db
    .from('ota_inbound_events')
    .select('*')
    .eq('id', inboundId)
    .maybeSingle()

  if (error || !row) {
    throw new Error(error?.message || 'Inbound event not found')
  }

  if (row.status === 'processed') {
    return {
      inboundId,
      status: 'processed',
      ...(row.reservation_id ? { reservationId: row.reservation_id } : {}),
      reason: 'already_processed',
    }
  }

  await db
    .from('ota_inbound_events')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', inboundId)

  const platform = asPlatform(row.platform)
  const normalized = normalizeInboundPayload(platform, row.payload)

  if (normalized.eventType === 'booking_cancelled') {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'skipped',
        last_error: 'booking_cancelled_not_auto_applied',
        result: { reason: 'booking_cancelled_not_auto_applied' } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'skipped', reason: 'booking_cancelled_not_auto_applied' }
  }

  const sku = (row.external_sku || normalized.externalSku || '').trim()
  if (!sku) {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'skipped',
        last_error: 'missing_external_sku',
        result: { reason: 'missing_external_sku' } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'skipped', reason: 'missing_external_sku' }
  }

  if (!row.connection_id) {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'skipped',
        last_error: 'missing_connection_id',
        result: { reason: 'missing_connection_id' } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'skipped', reason: 'missing_connection_id' }
  }

  const { data: mapping } = await db
    .from('external_mappings')
    .select('internal_type, internal_id, external_sku')
    .eq('connection_id', row.connection_id)
    .eq('external_sku', sku)
    .eq('is_active', true)
    .maybeSingle()

  if (!mapping) {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'skipped',
        last_error: 'no_external_mapping',
        result: { reason: 'no_external_mapping', externalSku: sku } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'skipped', reason: 'no_external_mapping' }
  }

  if (mapping.internal_type !== 'product' && mapping.internal_type !== 'offer') {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'skipped',
        last_error: 'unsupported_mapping_type',
        result: {
          reason: 'unsupported_mapping_type',
          internalType: mapping.internal_type,
        } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'skipped', reason: 'unsupported_mapping_type' }
  }

  let productId = mapping.internal_id
  if (mapping.internal_type === 'offer') {
    const { data: offer } = await db
      .from('offers')
      .select('rate_plan_id')
      .eq('id', mapping.internal_id)
      .maybeSingle()
    if (!offer?.rate_plan_id) {
      await db
        .from('ota_inbound_events')
        .update({
          status: 'failed',
          last_error: 'offer_missing',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', inboundId)
      return { inboundId, status: 'failed', reason: 'offer_missing' }
    }
    const { data: ratePlan } = await db
      .from('rate_plans')
      .select('product_id')
      .eq('id', offer.rate_plan_id)
      .maybeSingle()
    if (!ratePlan?.product_id) {
      await db
        .from('ota_inbound_events')
        .update({
          status: 'failed',
          last_error: 'offer_product_missing',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', inboundId)
      return { inboundId, status: 'failed', reason: 'offer_product_missing' }
    }
    productId = ratePlan.product_id
  }

  const { data: conn } = await db
    .from('channel_connections')
    .select('id, config, channel_id')
    .eq('id', row.connection_id)
    .maybeSingle()

  const config =
    conn?.config && typeof conn.config === 'object' && !Array.isArray(conn.config)
      ? (conn.config as Record<string, unknown>)
      : {}
  const autoCreate = config.autoCreateInquiry === true
  const inboundEnabled = isCommerceV2OtaInboundEnabled()

  if (!inboundEnabled || !autoCreate) {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'processed',
        last_error: null,
        result: {
          action: 'mapped_only',
          productId,
          externalSku: sku,
          inboundEnabled,
          autoCreateInquiry: autoCreate,
          hint: 'Set COMMERCE_V2_OTA_INBOUND=1 and connection.config.autoCreateInquiry=true to create inquiry reservations.',
        } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'processed', reason: 'mapped_only' }
  }

  if (
    !normalized.tourDate ||
    !normalized.customerEmail ||
    !normalized.customerName ||
    !normalized.customerPhone
  ) {
    await db
      .from('ota_inbound_events')
      .update({
        status: 'failed',
        last_error: 'missing_booking_fields',
        result: {
          reason: 'missing_booking_fields',
          need: ['tourDate', 'customerName', 'customerEmail', 'customerPhone'],
        } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'failed', reason: 'missing_booking_fields' }
  }

  try {
    const direct = await resolvePublicDirectChannel(db, row.operator_id, {
      ensure: true,
    })
    const channelId = conn?.channel_id || direct.channelId

    const pending = await createPendingCustomerBooking(db, {
      customer: {
        name: normalized.customerName,
        email: normalized.customerEmail,
        phone: normalized.customerPhone,
        specialRequests: `OTA inbound ${platform} booking ${normalized.externalBookingId || normalized.externalEventId}`,
      },
      line: {
        productId,
        tourDate: normalized.tourDate,
        adults: normalized.adults,
        child: normalized.child,
        infant: normalized.infant,
        selectedOptions: {},
        variantKey: 'default',
      },
      status: 'inquiry',
      tenant: {
        operatorId: row.operator_id,
        channelId,
      },
    })

    await db
      .from('ota_inbound_events')
      .update({
        status: 'processed',
        reservation_id: pending.reservationId,
        last_error: null,
        result: {
          action: 'inquiry_created',
          reservationId: pending.reservationId,
          productId,
          externalSku: sku,
        } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)

    return {
      inboundId,
      status: 'processed',
      reservationId: pending.reservationId,
      reason: 'inquiry_created',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'inquiry_create_failed'
    await db
      .from('ota_inbound_events')
      .update({
        status: 'failed',
        last_error: message,
        result: { reason: 'inquiry_create_failed', message } as Json,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)
    return { inboundId, status: 'failed', reason: message }
  }
}

export async function processOtaInboundBatch(
  db: Db,
  opts?: { limit?: number; operatorId?: string }
): Promise<{ claimed: number; results: ProcessInboundResult[] }> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50)
  let query = db
    .from('ota_inbound_events')
    .select('id')
    .in('status', ['received', 'failed'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (opts?.operatorId) {
    query = query.eq('operator_id', opts.operatorId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const results: ProcessInboundResult[] = []
  for (const row of data || []) {
    results.push(await processOtaInboundEvent(db, row.id))
  }
  return { claimed: results.length, results }
}
