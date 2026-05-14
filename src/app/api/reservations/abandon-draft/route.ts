import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken, supabase, supabaseAdmin } from '@/lib/supabase'

function dbForRequest(request: NextRequest) {
  if (supabaseAdmin) return supabaseAdmin
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return createSupabaseClientWithToken(token)
  }
  return supabase
}

/**
 * 새 예약 모달이 ensure-draft 로 넣은 최소 행을, 저장 없이 닫을 때 제거합니다.
 * 고객·상품·투어가 아직 없는 pending 행만 삭제합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const db = dbForRequest(request)
    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id.trim() : ''

    if (!id) {
      return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
    }

    const { data: row, error: selErr } = await db
      .from('reservations')
      .select('id, customer_id, product_id, tour_id, status')
      .eq('id', id)
      .maybeSingle()

    if (selErr) {
      console.error('abandon-draft: select error', selErr)
      return NextResponse.json(
        {
          success: false,
          message: selErr.message,
          code: (selErr as { code?: string }).code,
        },
        { status: 500 }
      )
    }

    if (!row) {
      return NextResponse.json({ success: true, deleted: false })
    }

    const r = row as {
      customer_id?: string | null
      product_id?: string | null
      tour_id?: string | null
      status?: string | null
    }

    const abandonable =
      (r.customer_id == null || String(r.customer_id).trim() === '') &&
      (r.product_id == null || String(r.product_id).trim() === '') &&
      (r.tour_id == null || String(r.tour_id).trim() === '') &&
      String(r.status || '').toLowerCase() === 'pending'

    if (!abandonable) {
      return NextResponse.json({ success: true, deleted: false, skipped: 'not_empty_draft' })
    }

    const { error: delErr } = await db.from('reservations').delete().eq('id', id)

    if (delErr) {
      console.error('abandon-draft: delete error', delErr)
      return NextResponse.json(
        {
          success: false,
          message: delErr.message || 'Failed to delete draft reservation',
          code: (delErr as { code?: string }).code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deleted: true })
  } catch (e) {
    console.error('abandon-draft:', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
