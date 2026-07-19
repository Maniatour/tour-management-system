import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { processSyncOutbox } from '@/lib/commerce/ota/processSyncOutbox'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * POST /api/admin/commerce/ota/process-outbox
 * Body: { operatorId?, limit? }
 *
 * Processes pending sync_events with dry-run adapters (no live OTA HTTP in Phase 4a).
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      operatorId?: string
      limit?: number
    }

    const result = await processSyncOutbox(supabaseAdmin, {
      operatorId: body.operatorId || KOVEgAS_OPERATOR_ID,
      ...(body.limit != null ? { limit: body.limit } : {}),
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint: 'Phase 4a uses dry-run adapters only. Map SKUs via POST /api/admin/commerce/ota/mappings first.',
    })
  } catch (err) {
    console.error('[ota/process-outbox]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'process outbox failed' },
      { status: 500 }
    )
  }
}
