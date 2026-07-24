import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveBundleDiscountsForCart } from '@/lib/productBundleDiscounts'

/**
 * POST /api/booking/bundle-discounts
 * 장바구니 라인에 적용 가능한 함께 구매 할인을 서버에서 계산합니다.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
    }

    const body = await request.json()
    const rawItems = Array.isArray(body.items) ? body.items : []
    const lines = rawItems
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return null
        const row = item as Record<string, unknown>
        const productId = typeof row.productId === 'string' ? row.productId.trim() : ''
        const subtotal = Number(row.subtotal)
        if (!productId || !Number.isFinite(subtotal) || subtotal < 0) return null
        return { productId, subtotal }
      })
      .filter((line: { productId: string; subtotal: number } | null): line is { productId: string; subtotal: number } => line != null)

    if (lines.length === 0) {
      return NextResponse.json({
        totalDiscount: 0,
        lineDiscounts: [],
        applied: [],
      })
    }

    const result = await resolveBundleDiscountsForCart(supabaseAdmin, lines)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/booking/bundle-discounts]', error)
    return NextResponse.json({ error: 'Failed to calculate bundle discounts' }, { status: 500 })
  }
}
