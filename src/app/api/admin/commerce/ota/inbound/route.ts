import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { receiveOtaInboundEvent } from '@/lib/commerce/ota/receiveInboundEvent'
import {
  processOtaInboundBatch,
  processOtaInboundEvent,
} from '@/lib/commerce/ota/processInboundEvent'
import { isCommerceV2OtaInboundEnabled } from '@/lib/commerce/commerceV2Flags'
import { KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID } from '@/lib/commerce/ota/types'

/**
 * GET /api/admin/commerce/ota/inbound?limit=
 * List recent inbound OTA webhook events.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get('limit') || 40), 1),
    100
  )
  const operatorId =
    request.nextUrl.searchParams.get('operatorId') || KOVEgAS_OPERATOR_ID

  try {
    const { data, error } = await supabaseAdmin
      .from('ota_inbound_events')
      .select(
        'id, platform, event_type, external_event_id, external_booking_id, external_sku, status, reservation_id, last_error, created_at, processed_at, result'
      )
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    return NextResponse.json({
      ok: true,
      inboundFlag: isCommerceV2OtaInboundEnabled(),
      events: data || [],
    })
  } catch (err) {
    console.error('[admin/commerce/ota/inbound GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'list failed' },
      { status: 400 }
    )
  }
}

/**
 * POST /api/admin/commerce/ota/inbound
 * Actions:
 *  - { action: 'ingest', body, platform? }  staff test receive (skipAuth)
 *  - { action: 'process', inboundId }
 *  - { action: 'processBatch', limit? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const body = (await request.json()) as {
      action?: string
      inboundId?: string
      limit?: number
      platform?: string
      payload?: unknown
      connectionId?: string
    }

    const action = String(body.action || '').trim()

    if (action === 'ingest') {
      const received = await receiveOtaInboundEvent(supabaseAdmin, {
        platform: body.platform || 'viator',
        body: body.payload || {},
        connectionId: body.connectionId || KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID,
        skipAuth: true,
      })
      return NextResponse.json({ ok: true, ...received })
    }

    if (action === 'process') {
      const inboundId = String(body.inboundId || '').trim()
      if (!inboundId) {
        return NextResponse.json({ error: 'inboundId required' }, { status: 400 })
      }
      const result = await processOtaInboundEvent(supabaseAdmin, inboundId)
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'processBatch') {
      const batch = await processOtaInboundBatch(supabaseAdmin, {
        ...(typeof body.limit === 'number' ? { limit: body.limit } : {}),
        operatorId: KOVEgAS_OPERATOR_ID,
      })
      return NextResponse.json({ ok: true, ...batch })
    }

    return NextResponse.json(
      { error: 'action must be ingest | process | processBatch' },
      { status: 400 }
    )
  } catch (err) {
    console.error('[admin/commerce/ota/inbound POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'inbound action failed' },
      { status: 400 }
    )
  }
}
