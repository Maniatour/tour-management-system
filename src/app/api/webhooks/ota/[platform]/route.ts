import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { receiveOtaInboundEvent } from '@/lib/commerce/ota/receiveInboundEvent'
import { processOtaInboundEvent } from '@/lib/commerce/ota/processInboundEvent'
import { isCommerceV2OtaInboundEnabled } from '@/lib/commerce/commerceV2Flags'

type RouteContext = { params: Promise<{ platform: string }> }

/**
 * POST /api/webhooks/ota/:platform
 * Public OTA inbound webhook. Requires secret header.
 * Headers: x-ota-webhook-secret OR Authorization: Bearer <secret>
 *
 * Always stores inbox row. Auto-process when COMMERCE_V2_OTA_INBOUND=1.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const { platform } = await context.params
  const body = await request.json().catch(() => ({}))

  const bearer = request.headers.get('authorization') || ''
  const bearerToken = bearer.toLowerCase().startsWith('bearer ')
    ? bearer.slice(7).trim()
    : null
  const providedSecret =
    request.headers.get('x-ota-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    bearerToken

  try {
    const received = await receiveOtaInboundEvent(supabaseAdmin, {
      platform,
      body,
      providedSecret,
    })

    let processResult = null
    if (isCommerceV2OtaInboundEnabled() && received.created) {
      processResult = await processOtaInboundEvent(supabaseAdmin, received.inboundId)
    }

    return NextResponse.json({
      ok: true,
      ...received,
      processed: processResult,
      inboundFlag: isCommerceV2OtaInboundEnabled(),
    })
  } catch (err) {
    console.error('[webhooks/ota]', err)
    const message = err instanceof Error ? err.message : 'webhook failed'
    const status = message.includes('Invalid OTA webhook secret') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
