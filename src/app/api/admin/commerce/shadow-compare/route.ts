import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { shadowComparePricing } from '@/lib/commerce/shadowComparePrice'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * POST /api/admin/commerce/shadow-compare
 * Body: { productId, channelId?, fromDate?, limit?, operatorId? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'supabaseAdmin (service role) is required' },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      productId?: string
      channelId?: string
      fromDate?: string
      limit?: number
      operatorId?: string
    }

    if (!body.productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const result = await shadowComparePricing({
      client: supabaseAdmin,
      operatorId: body.operatorId || KOVEgAS_OPERATOR_ID,
      productId: body.productId,
      ...(body.channelId ? { channelId: body.channelId } : {}),
      ...(body.fromDate ? { fromDate: body.fromDate } : {}),
      ...(body.limit != null ? { limit: body.limit } : {}),
    })

    const matchRate =
      result.compared > 0 ? Math.round((result.matched / result.compared) * 1000) / 10 : 0

    return NextResponse.json({
      ok: true,
      matchRatePercent: matchRate,
      ...result,
    })
  } catch (err) {
    console.error('[shadow-compare]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'shadow compare failed' },
      { status: 500 }
    )
  }
}
