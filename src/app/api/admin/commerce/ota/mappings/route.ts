import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID } from '@/lib/commerce/ota/types'

/**
 * POST /api/admin/commerce/ota/mappings
 * Upsert external_mappings (internal Offer/Product ↔ OTA SKU).
 *
 * Body: {
 *   connectionId?: string
 *   operatorId?: string
 *   internalType: 'product'|'offer'|'rate_plan'|'choice_option'
 *   internalId: string
 *   externalSku: string
 *   externalProductId?: string
 *   externalPackageId?: string
 *   metadata?: object
 *   isActive?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      connectionId?: string
      operatorId?: string
      internalType?: string
      internalId?: string
      externalSku?: string
      externalProductId?: string
      externalPackageId?: string
      metadata?: Record<string, unknown>
      isActive?: boolean
    }

    const internalType = body.internalType?.trim()
    const internalId = body.internalId?.trim()
    const externalSku = body.externalSku?.trim()
    if (!internalType || !internalId || !externalSku) {
      return NextResponse.json(
        { error: 'internalType, internalId, externalSku are required' },
        { status: 400 }
      )
    }

    const allowed = new Set(['product', 'offer', 'rate_plan', 'choice_option'])
    if (!allowed.has(internalType)) {
      return NextResponse.json({ error: 'invalid internalType' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('external_mappings')
      .upsert(
        {
          operator_id: body.operatorId || KOVEgAS_OPERATOR_ID,
          connection_id: body.connectionId || KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID,
          internal_type: internalType,
          internal_id: internalId,
          external_sku: externalSku,
          external_product_id: body.externalProductId ?? null,
          external_package_id: body.externalPackageId ?? null,
          metadata: (body.metadata ?? {}) as unknown as Json,
          is_active: body.isActive !== false,
        },
        { onConflict: 'connection_id,external_sku' }
      )
      .select('id, connection_id, internal_type, internal_id, external_sku, is_active')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mapping: data })
  } catch (err) {
    console.error('[ota/mappings]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'mapping upsert failed' },
      { status: 500 }
    )
  }
}

/** GET /api/admin/commerce/ota/mappings?connectionId= */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const connectionId =
    request.nextUrl.searchParams.get('connectionId') ||
    KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID

  const { data, error } = await supabaseAdmin
    .from('external_mappings')
    .select(
      'id, connection_id, internal_type, internal_id, external_sku, external_product_id, external_package_id, is_active, created_at'
    )
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mappings: data || [] })
}
