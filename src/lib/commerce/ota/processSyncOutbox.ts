/**
 * Claim and process pending sync_events via platform adapters.
 * Safe default: dry-run. Live Viator HTTP when status=active + COMMERCE_V2_OTA_LIVE=1.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { isCommerceV2OtaLiveEnabled } from '@/lib/commerce/commerceV2Flags'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { getOtaAdapter } from '@/lib/commerce/ota/adapters/registry'
import type { OtaAdapterContext } from '@/lib/commerce/ota/adapters/types'
import type {
  AdapterResult,
  OtaPlatform,
  PushRatesPayload,
  SyncEventType,
} from '@/lib/commerce/ota/types'

type Db = SupabaseClient<Database>

export type ProcessOutboxResult = {
  claimed: number
  succeeded: number
  skipped: number
  failed: number
  results: Array<{
    eventId: string
    status: string
    reason?: string
  }>
}

function asPlatform(raw: string): OtaPlatform {
  const allowed: OtaPlatform[] = ['viator', 'klook', 'gyg', 'kkday', 'trip', 'other']
  return (allowed.includes(raw as OtaPlatform) ? raw : 'other') as OtaPlatform
}

async function loadAdapterContext(
  db: Db,
  connectionId: string,
  operatorId: string
): Promise<OtaAdapterContext | null> {
  const { data: conn, error } = await db
    .from('channel_connections')
    .select('id, operator_id, platform, status, config, credentials_ref')
    .eq('id', connectionId)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (error || !conn) return null

  const { data: mappings } = await db
    .from('external_mappings')
    .select(
      'internal_type, internal_id, external_sku, external_product_id, external_package_id'
    )
    .eq('connection_id', connectionId)
    .eq('is_active', true)

  return {
    connectionId: conn.id,
    operatorId: conn.operator_id,
    platform: asPlatform(conn.platform),
    status: conn.status as OtaAdapterContext['status'],
    config: (conn.config && typeof conn.config === 'object'
      ? (conn.config as Record<string, unknown>)
      : {}) as Record<string, unknown>,
    credentialsRef: conn.credentials_ref || null,
    mappings: (mappings || []).map((m) => ({
      internalType: m.internal_type,
      internalId: m.internal_id,
      externalSku: m.external_sku,
      externalProductId: m.external_product_id,
      externalPackageId: m.external_package_id,
    })),
  }
}

async function runAdapter(
  ctx: OtaAdapterContext,
  eventType: SyncEventType,
  payload: Record<string, unknown>
): Promise<AdapterResult> {
  const adapter = getOtaAdapter(ctx.platform, {
    connectionStatus: ctx.status,
    liveEnabled: isCommerceV2OtaLiveEnabled(),
  })
  if (!adapter.supports(eventType)) {
    return { ok: true, skipped: true, reason: `unsupported_event:${eventType}` }
  }

  if (eventType === 'push_rates') {
    return adapter.pushRates(ctx, payload as unknown as PushRatesPayload)
  }
  if (eventType === 'push_availability' && adapter.pushAvailability) {
    return adapter.pushAvailability(ctx, payload)
  }
  return { ok: true, skipped: true, reason: `unhandled_event:${eventType}` }
}

export async function processSyncOutbox(
  db: Db,
  opts?: {
    operatorId?: string
    limit?: number
  }
): Promise<ProcessOutboxResult> {
  const operatorId = opts?.operatorId || KOVEgAS_OPERATOR_ID
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100)
  const now = new Date().toISOString()

  const { data: pending, error } = await db
    .from('sync_events')
    .select('id, connection_id, event_type, entity_type, entity_id, payload, attempts, max_attempts')
    .eq('operator_id', operatorId)
    .in('status', ['pending', 'failed'])
    .lte('available_at', now)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`outbox poll failed: ${error.message}`)
  }

  const summary: ProcessOutboxResult = {
    claimed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    results: [],
  }

  for (const event of pending || []) {
    const { data: claimed } = await db
      .from('sync_events')
      .update({
        status: 'processing',
        attempts: (event.attempts || 0) + 1,
      })
      .eq('id', event.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()

    if (!claimed) continue
    summary.claimed += 1

    try {
      if (!event.connection_id) {
        await db
          .from('sync_events')
          .update({
            status: 'skipped',
            last_error: 'missing_connection_id',
            result: { reason: 'missing_connection_id' } as Json,
          })
          .eq('id', event.id)
        summary.skipped += 1
        summary.results.push({
          eventId: event.id,
          status: 'skipped',
          reason: 'missing_connection_id',
        })
        continue
      }

      const ctx = await loadAdapterContext(db, event.connection_id, operatorId)
      if (!ctx) {
        await db
          .from('sync_events')
          .update({
            status: 'failed',
            last_error: 'connection_not_found',
            available_at: new Date(Date.now() + 60_000).toISOString(),
          })
          .eq('id', event.id)
        summary.failed += 1
        summary.results.push({
          eventId: event.id,
          status: 'failed',
          reason: 'connection_not_found',
        })
        continue
      }

      if (ctx.status === 'disabled') {
        await db
          .from('sync_events')
          .update({
            status: 'skipped',
            last_error: 'connection_disabled',
            result: { reason: 'connection_disabled' } as Json,
          })
          .eq('id', event.id)
        summary.skipped += 1
        summary.results.push({
          eventId: event.id,
          status: 'skipped',
          reason: 'connection_disabled',
        })
        continue
      }

      const payload =
        event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : {}

      const adapterResult = await runAdapter(
        ctx,
        event.event_type as SyncEventType,
        payload
      )

      if (adapterResult.skipped) {
        await db
          .from('sync_events')
          .update({
            status: 'skipped',
            last_error: adapterResult.reason || 'skipped',
            result: adapterResult as unknown as Json,
          })
          .eq('id', event.id)
        summary.skipped += 1
        summary.results.push({
          eventId: event.id,
          status: 'skipped',
          ...(adapterResult.reason ? { reason: adapterResult.reason } : {}),
        })
        continue
      }

      if (!adapterResult.ok) {
        const attempts = (event.attempts || 0) + 1
        const giveUp = attempts >= (event.max_attempts || 5)
        await db
          .from('sync_events')
          .update({
            status: 'failed',
            last_error: adapterResult.reason || 'adapter_failed',
            result: adapterResult as unknown as Json,
            available_at: giveUp
              ? now
              : new Date(Date.now() + Math.min(attempts, 10) * 60_000).toISOString(),
          })
          .eq('id', event.id)
        summary.failed += 1
        summary.results.push({
          eventId: event.id,
          status: 'failed',
          ...(adapterResult.reason ? { reason: adapterResult.reason } : {}),
        })
        continue
      }

      await db
        .from('sync_events')
        .update({
          status: 'succeeded',
          last_error: null,
          result: adapterResult as unknown as Json,
        })
        .eq('id', event.id)

      await db
        .from('channel_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', ctx.connectionId)

      summary.succeeded += 1
      summary.results.push({
        eventId: event.id,
        status: 'succeeded',
        ...(adapterResult.dryRun ? { reason: 'dry_run' } : {}),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'process_error'
      await db
        .from('sync_events')
        .update({
          status: 'failed',
          last_error: message,
          available_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq('id', event.id)
      summary.failed += 1
      summary.results.push({ eventId: event.id, status: 'failed', reason: message })
    }
  }

  return summary
}
