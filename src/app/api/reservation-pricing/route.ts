import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken, supabase, supabaseAdmin } from '@/lib/supabase'

/** Authorization Bearer가 있으면 해당 사용자 RLS로 조회 (배치/봉투 등). 없으면 service role 또는 anon. */
function supabaseForRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return createSupabaseClientWithToken(token)
  }
  return supabaseAdmin ?? supabase
}

/** 단일: ?reservation_id=xxx → { pricing }. 복수: ?reservation_ids=id1,id2 또는 getAll → { items: [{ reservation_id, pricing }] } (예약 카드/봉투와 동일 소스) */
export async function GET(request: NextRequest) {
  try {
    const db = supabaseForRequest(request)
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')
    const reservationIdsParam = searchParams.get('reservation_ids')
    const ids = reservationIdsParam ? reservationIdsParam.split(',').map((s) => s.trim()).filter(Boolean) : null

    if (ids && ids.length > 0) {
      const { data: pricingList, error } = await db
        .from('reservation_pricing')
        .select('*')
        .in('reservation_id', ids)

      if (error) {
        console.error('reservation_pricing 배치 조회 오류:', error)
        return NextResponse.json({ error: '예약 가격 정보를 불러올 수 없습니다.' }, { status: 500 })
      }

      const byResId = new Map<string, unknown>()
      ;(pricingList || []).forEach((row: { reservation_id: string }) => {
        byResId.set(row.reservation_id, row)
      })
      const items = ids.map((id) => ({ reservation_id: id, pricing: byResId.get(id) ?? null }))
      return NextResponse.json({ items })
    }

    if (!reservationId) {
      return NextResponse.json(
        { error: 'reservation_id 또는 reservation_ids 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: pricing, error } = await db
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .single()

    if (error) {
      console.error('reservation_pricing 조회 오류:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ pricing: null })
      }
      return NextResponse.json(
        { error: '예약 가격 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ pricing })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
