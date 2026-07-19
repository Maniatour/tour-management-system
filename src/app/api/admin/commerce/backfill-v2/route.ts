import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { backfillDynamicPricingToV2 } from '@/lib/commerce/backfillDynamicPricingToV2'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * POST /api/admin/commerce/backfill-v2
 * Body: { productId?, channelId?, fromDate?, monthsBack?, limit?, offset?, operatorId? }
 *
 * Run repeatedly with nextOffset until null.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'supabaseAdmin (service role) is required for backfill' },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      productId?: string
      channelId?: string
      fromDate?: string
      monthsBack?: number
      limit?: number
      offset?: number
      operatorId?: string
    }

    const result = await backfillDynamicPricingToV2({
      client: supabaseAdmin,
      operatorId: body.operatorId || KOVEgAS_OPERATOR_ID,
      ...(body.productId ? { productId: body.productId } : {}),
      ...(body.channelId ? { channelId: body.channelId } : {}),
      ...(body.fromDate ? { fromDate: body.fromDate } : {}),
      ...(body.monthsBack != null ? { monthsBack: body.monthsBack } : {}),
      ...(body.limit != null ? { limit: body.limit } : {}),
      ...(body.offset != null ? { offset: body.offset } : {}),
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint:
        result.nextOffset != null
          ? `Call again with offset=${result.nextOffset}`
          : 'Backfill page complete',
    })
  } catch (err) {
    console.error('[backfill-v2]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'backfill failed' },
      { status: 500 }
    )
  }
}
