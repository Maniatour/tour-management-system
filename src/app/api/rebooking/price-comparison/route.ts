import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { REBOOKING_OUTREACH_COUPON_CODE } from '@/lib/customerRebookingUrl'
import { fetchRebookingPriceComparisonForReservation } from '@/lib/rebookingPriceComparisonServer'

export async function GET(request: NextRequest) {
  const authDb = await getSupabaseForApiRoute(request)
  if (authDb instanceof NextResponse) return authDb

  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const reservationId = searchParams.get('reservation_id')?.trim()
  if (!reservationId) {
    return NextResponse.json({ error: 'reservation_id가 필요합니다.' }, { status: 400 })
  }

  const couponCode = searchParams.get('coupon_code')?.trim() || REBOOKING_OUTREACH_COUPON_CODE
  const channelName = searchParams.get('channel_name')?.trim() || null

  try {
    const comparison = await fetchRebookingPriceComparisonForReservation(admin, {
      reservationId,
      couponCode,
      channelName,
    })
    return NextResponse.json({ comparison })
  } catch (error) {
    console.error('[rebooking/price-comparison]', error)
    return NextResponse.json({ error: '가격 비교를 계산할 수 없습니다.' }, { status: 500 })
  }
}
