import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'

const db = supabaseAdmin ?? supabase

/**
 * reservation_options 변경 후 클라이언트 등에서 호출 — option_total·입금 집계 캐시 갱신
 * (서버에서 service role로 실행해 RLS와 무관하게 반영)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const reservation_id = typeof body?.reservation_id === 'string' ? body.reservation_id.trim() : ''
    if (!reservation_id) {
      return NextResponse.json({ error: 'reservation_id is required' }, { status: 400 })
    }

    const result = await syncReservationPricingAggregates(db, reservation_id)
    if (!result.ok && result.error) {
      console.warn('[sync-aggregates]', reservation_id, result.error)
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, skipped: result.skipped })
  } catch (e) {
    console.error('[sync-aggregates]', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
