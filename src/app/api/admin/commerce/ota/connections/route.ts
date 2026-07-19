import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { isCommerceV2OtaLiveEnabled } from '@/lib/commerce/commerceV2Flags'
import type { Json } from '@/lib/database.types'

const STATUSES = new Set(['disabled', 'dry_run', 'active', 'error'])

/**
 * GET /api/admin/commerce/ota/connections
 * List OTA channel connections for Kovegas (Phase 4c).
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const operatorId =
    request.nextUrl.searchParams.get('operatorId') || KOVEgAS_OPERATOR_ID

  try {
    const { data, error } = await supabaseAdmin
      .from('channel_connections')
      .select(
        'id, operator_id, channel_id, platform, display_name, status, config, credentials_ref, conflict_policy, last_synced_at, created_at, updated_at'
      )
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    return NextResponse.json({
      ok: true,
      liveFlag: isCommerceV2OtaLiveEnabled(),
      connections: data || [],
    })
  } catch (err) {
    console.error('[admin/commerce/ota/connections GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'list failed' },
      { status: 400 }
    )
  }
}

/**
 * PATCH /api/admin/commerce/ota/connections
 * Update connection status / credentials_ref / config (partial).
 * Body: { connectionId, status?, credentialsRef?, config? }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const body = (await request.json()) as {
      connectionId?: string
      status?: string
      credentialsRef?: string | null
      config?: Record<string, unknown>
    }

    const connectionId = String(body.connectionId || '').trim()
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 })
    }

    const patch: {
      status?: string
      credentials_ref?: string | null
      config?: Json
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (body.status != null) {
      const status = String(body.status).trim()
      if (!STATUSES.has(status)) {
        return NextResponse.json(
          { error: `invalid status; use ${[...STATUSES].join('|')}` },
          { status: 400 }
        )
      }
      if (status === 'active' && !isCommerceV2OtaLiveEnabled()) {
        return NextResponse.json(
          {
            error:
              'COMMERCE_V2_OTA_LIVE is off. Set env=1 before switching connection to active (or keep dry_run).',
            liveFlag: false,
          },
          { status: 400 }
        )
      }
      patch.status = status
    }

    if (body.credentialsRef !== undefined) {
      const ref = body.credentialsRef == null ? null : String(body.credentialsRef).trim()
      if (ref && !ref.startsWith('env:')) {
        return NextResponse.json(
          { error: 'credentialsRef must be env:VAR_NAME (vault pointer only)' },
          { status: 400 }
        )
      }
      patch.credentials_ref = ref || null
    }

    if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
      const { data: existing } = await supabaseAdmin
        .from('channel_connections')
        .select('config')
        .eq('id', connectionId)
        .maybeSingle()

      const prev =
        existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config)
          ? (existing.config as Record<string, unknown>)
          : {}
      patch.config = { ...prev, ...body.config } as Json
    }

    if (
      patch.status === undefined &&
      patch.credentials_ref === undefined &&
      patch.config === undefined
    ) {
      return NextResponse.json(
        { error: 'Provide status, credentialsRef, and/or config' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('channel_connections')
      .update(patch)
      .eq('id', connectionId)
      .select(
        'id, platform, display_name, status, credentials_ref, config, last_synced_at, updated_at'
      )
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      return NextResponse.json({ error: 'connection not found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      liveFlag: isCommerceV2OtaLiveEnabled(),
      connection: data,
    })
  } catch (err) {
    console.error('[admin/commerce/ota/connections PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'update failed' },
      { status: 400 }
    )
  }
}
