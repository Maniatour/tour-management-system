/**
 * Best-effort outbox writer. Never throws to pricing dual-write callers.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { isCommerceV2OtaSyncEnabled } from '@/lib/commerce/commerceV2Flags'
import type { PushRatesPayload, SyncEntityType, SyncEventType } from '@/lib/commerce/ota/types'
import { KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID } from '@/lib/commerce/ota/types'

type Db = SupabaseClient<Database>

export async function enqueueSyncEvent(
  db: Db,
  params: {
    operatorId?: string
    connectionId?: string | null
    eventType: SyncEventType
    entityType: SyncEntityType
    entityId: string
    payload?: Record<string, unknown>
    idempotencyKey?: string | null
  }
): Promise<string | null> {
  if (!isCommerceV2OtaSyncEnabled()) return null

  const operatorId = params.operatorId || KOVEgAS_OPERATOR_ID

  try {
    if (params.idempotencyKey) {
      const { data: existing } = await db
        .from('sync_events')
        .select('id, status')
        .eq('operator_id', operatorId)
        .eq('idempotency_key', params.idempotencyKey)
        .maybeSingle()

      if (existing?.id) {
        if (existing.status === 'pending' || existing.status === 'failed') {
          await db
            .from('sync_events')
            .update({
              payload: (params.payload || {}) as Json,
              status: 'pending',
              available_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', existing.id)
        }
        return existing.id
      }
    }

    const { data, error } = await db
      .from('sync_events')
      .insert({
        operator_id: operatorId,
        connection_id: params.connectionId ?? KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID,
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        payload: (params.payload || {}) as Json,
        status: 'pending',
        idempotency_key: params.idempotencyKey ?? null,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.warn('[enqueueSyncEvent]', error.message)
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.warn('[enqueueSyncEvent] unexpected', err)
    return null
  }
}

/** Enqueue push_rates after a successful commerce dual-write. */
export async function enqueuePushRatesAfterDualWrite(
  db: Db,
  payload: PushRatesPayload,
  operatorId: string = KOVEgAS_OPERATOR_ID
): Promise<void> {
  const idempotencyKey = `push_rates:${payload.ratePlanId}:${payload.date}`
  await enqueueSyncEvent(db, {
    operatorId,
    eventType: 'push_rates',
    entityType: 'rate_plan',
    entityId: payload.ratePlanId,
    payload: payload as unknown as Record<string, unknown>,
    idempotencyKey,
  })
}
