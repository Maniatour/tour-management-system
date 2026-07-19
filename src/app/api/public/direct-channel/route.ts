import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import { resolvePublicDirectChannel } from '@/lib/operators/resolvePublicDirectChannel'

/**
 * GET /api/public/direct-channel
 * Resolve (ensure if needed) Direct Web channel for the host's public operator.
 * Used by BookingFlow / availability UI. Does not touch Stripe.
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const operatorId = await getPublicOperatorId()
    const resolved = await resolvePublicDirectChannel(supabaseAdmin, operatorId, {
      ensure: true,
    })

    return NextResponse.json(
      {
        ok: true,
        operatorId: resolved.operatorId,
        channelId: resolved.channelId,
        source: resolved.source,
        created: resolved.created,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      }
    )
  } catch (err) {
    console.error('[api/public/direct-channel]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'resolve failed' },
      { status: 400 }
    )
  }
}
