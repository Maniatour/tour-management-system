import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID } from '@/lib/commerce/ota/types'
import type { OtaPlatform } from '@/lib/commerce/ota/types'
import { normalizeInboundPayload } from '@/lib/commerce/ota/normalizeInboundPayload'
import type { OtaInboundReceiveResult } from '@/lib/commerce/ota/inboundTypes'
import { resolveOtaCredentialsFromRef } from '@/lib/commerce/ota/resolveOtaCredentials'

type Db = SupabaseClient<Database>

function asPlatform(raw: string): OtaPlatform {
  const allowed: OtaPlatform[] = ['viator', 'klook', 'gyg', 'kkday', 'trip', 'other']
  return (allowed.includes(raw as OtaPlatform) ? raw : 'other') as OtaPlatform
}

/**
 * Verify webhook secret against connection credentials_ref (env:VAR)
 * or platform fallback env OTA_{PLATFORM}_WEBHOOK_SECRET / OTA_WEBHOOK_SECRET.
 */
export function verifyOtaWebhookSecret(opts: {
  platform: OtaPlatform
  providedSecret: string | null | undefined
  credentialsRef: string | null | undefined
}): boolean {
  const provided = (opts.providedSecret || '').trim()
  if (!provided) return false

  const fromRef = resolveOtaCredentialsFromRef(opts.credentialsRef)
  if (fromRef?.apiKey && fromRef.apiKey === provided) return true

  const envName = `OTA_${opts.platform.toUpperCase()}_WEBHOOK_SECRET`
  const fromEnv = (process.env[envName] || process.env.OTA_WEBHOOK_SECRET || '').trim()
  return Boolean(fromEnv && fromEnv === provided)
}

export async function receiveOtaInboundEvent(
  db: Db,
  opts: {
    platform: string
    body: unknown
    providedSecret?: string | null
    connectionId?: string | null
    operatorId?: string | null
    /** Staff test ingest only */
    skipAuth?: boolean
  }
): Promise<OtaInboundReceiveResult> {
  const platform = asPlatform(opts.platform)
  let operatorId = opts.operatorId || KOVEgAS_OPERATOR_ID
  const connectionId =
    opts.connectionId ||
    (platform === 'viator' ? KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID : null)

  let credentialsRef: string | null = null
  if (connectionId) {
    const { data: conn } = await db
      .from('channel_connections')
      .select('id, credentials_ref, operator_id')
      .eq('id', connectionId)
      .maybeSingle()
    if (conn) {
      credentialsRef = conn.credentials_ref
      operatorId = conn.operator_id || operatorId
    }
  }

  if (!opts.skipAuth) {
    const ok = verifyOtaWebhookSecret({
      platform,
      providedSecret: opts.providedSecret,
      credentialsRef,
    })
    if (!ok) {
      throw new Error('Invalid OTA webhook secret')
    }
  }

  const normalized = normalizeInboundPayload(platform, opts.body)

  const { data: existing } = await db
    .from('ota_inbound_events')
    .select('id, status')
    .eq('operator_id', operatorId)
    .eq('platform', platform)
    .eq('external_event_id', normalized.externalEventId)
    .maybeSingle()

  if (existing?.id) {
    return {
      inboundId: existing.id,
      created: false,
      platform,
      status: existing.status as OtaInboundReceiveResult['status'],
    }
  }

  const { data, error } = await db
    .from('ota_inbound_events')
    .insert({
      operator_id: operatorId,
      connection_id: connectionId,
      platform,
      event_type: normalized.eventType,
      external_event_id: normalized.externalEventId,
      external_booking_id: normalized.externalBookingId,
      external_sku: normalized.externalSku,
      payload: {
        ...normalized.raw,
        _normalized: {
          tourDate: normalized.tourDate,
          adults: normalized.adults,
          child: normalized.child,
          infant: normalized.infant,
          customerName: normalized.customerName,
          customerEmail: normalized.customerEmail,
          customerPhone: normalized.customerPhone,
          currency: normalized.currency,
          totalAmount: normalized.totalAmount,
        },
      } as Json,
      status: 'received',
    })
    .select('id, status')
    .maybeSingle()

  if (error || !data) {
    const { data: again } = await db
      .from('ota_inbound_events')
      .select('id, status')
      .eq('operator_id', operatorId)
      .eq('platform', platform)
      .eq('external_event_id', normalized.externalEventId)
      .maybeSingle()
    if (again?.id) {
      return {
        inboundId: again.id,
        created: false,
        platform,
        status: again.status as OtaInboundReceiveResult['status'],
      }
    }
    throw new Error(error?.message || 'Failed to store inbound event')
  }

  return {
    inboundId: data.id,
    created: true,
    platform,
    status: data.status as OtaInboundReceiveResult['status'],
  }
}
