import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken, supabase, supabaseAdmin } from '@/lib/supabase'

function dbForRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return createSupabaseClientWithToken(token)
  }
  return supabaseAdmin ?? supabase
}

/**
 * New-reservation modal: pre-generated id may not exist in DB yet.
 * If missing, insert a minimal row so FKs (e.g. reservation_expenses) work before full save.
 */
export async function POST(request: NextRequest) {
  try {
    const db = dbForRequest(request)
    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const added_by = typeof body?.added_by === 'string' ? body.added_by.trim() : null

    if (!id) {
      return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
    }

    const { data: existing, error: existingErr } = await db
      .from('reservations')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (existingErr) {
      console.error('ensure-draft: lookup error', existingErr)
      return NextResponse.json({ success: false, message: existingErr.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ success: true, created: false })
    }

    let channelId: string | null = null
    const { data: chRow } = await db.from('channels').select('id').limit(1).maybeSingle()
    if (chRow && typeof (chRow as { id?: string }).id === 'string') {
      channelId = (chRow as { id: string }).id
    }

    if (!channelId) {
      return NextResponse.json(
        {
          success: false,
          message: 'No sales channel in database; add a channel before creating reservations.',
        },
        { status: 400 }
      )
    }

    const tour_date = new Date().toISOString().slice(0, 10)

    const draftRow: Record<string, unknown> = {
      id,
      customer_id: null,
      product_id: null,
      tour_id: null,
      tour_date,
      tour_time: null,
      event_note: null,
      pickup_hotel: null,
      pickup_time: null,
      adults: 1,
      child: 0,
      infant: 0,
      total_people: 1,
      channel_id: channelId,
      channel_rn: null,
      added_by,
      status: 'pending',
      selected_options: {},
      selected_option_prices: {},
      is_private_tour: false,
      variant_key: 'default',
    }

    const { error: insertErr } = await db.from('reservations').insert(draftRow as never)

    if (insertErr) {
      console.error('ensure-draft: insert error', insertErr)
      return NextResponse.json(
        { success: false, message: insertErr.message || 'Failed to create draft reservation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, created: true })
  } catch (e) {
    console.error('ensure-draft:', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
