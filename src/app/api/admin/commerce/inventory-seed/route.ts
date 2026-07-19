import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { seedProductInventory } from '@/lib/commerce/inventoryEngine'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * POST /api/admin/commerce/inventory-seed
 * Body: {
 *   productId: string
 *   fromDate: YYYY-MM-DD
 *   toDate: YYYY-MM-DD
 *   totalQty?: number
 *   resourceId?: string
 *   operatorId?: string
 * }
 *
 * Creates product→default_shared_seats binding + daily allotments.
 * Inventory enforcement still requires COMMERCE_V2_INVENTORY_PRODUCTS.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'supabaseAdmin (service role) is required for inventory seed' },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      productId?: string
      fromDate?: string
      toDate?: string
      totalQty?: number
      resourceId?: string
      operatorId?: string
    }

    if (!body.productId?.trim()) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }
    if (!body.fromDate || !body.toDate) {
      return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 })
    }

    const result = await seedProductInventory(supabaseAdmin, {
      operatorId: body.operatorId || KOVEgAS_OPERATOR_ID,
      productId: body.productId.trim(),
      fromDate: body.fromDate,
      toDate: body.toDate,
      ...(body.totalQty != null ? { totalQty: body.totalQty } : {}),
      ...(body.resourceId ? { resourceId: body.resourceId } : {}),
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint:
        'Set COMMERCE_V2_INVENTORY_PRODUCTS=<productId> to enforce holds on checkout. Default remains OFF.',
    })
  } catch (err) {
    console.error('[inventory-seed]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'inventory seed failed' },
      { status: 500 }
    )
  }
}
