import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * GET /api/admin/commerce/ota/outbox?status=pending&limit=50
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get('limit') || 50), 1),
    200
  )
  const operatorId =
    request.nextUrl.searchParams.get('operatorId') || KOVEgAS_OPERATOR_ID

  let query = supabaseAdmin
    .from('sync_events')
    .select(
      'id, connection_id, event_type, entity_type, entity_id, status, attempts, last_error, idempotency_key, created_at, updated_at, result'
    )
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, events: data || [] })
}
