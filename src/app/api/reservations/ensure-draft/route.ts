import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken, supabase, supabaseAdmin } from '@/lib/supabase'

/**
 * Draft row creation must succeed for normal staff UX; RLS insert often fails if JWT/staff
 * mapping is off in local dev. Prefer service role on the server when configured.
 */
function dbForRequest(request: NextRequest) {
  if (supabaseAdmin) return supabaseAdmin
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return createSupabaseClientWithToken(token)
  }
  return supabase
}

/** Parallel ensure-draft (e.g. React Strict Mode double effect) → second INSERT hits PK */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  if (e.code === '23505') return true
  const m = (e.message || '').toLowerCase()
  return m.includes('duplicate key') || m.includes('unique constraint')
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
      return NextResponse.json(
        {
          success: false,
          message: existingErr.message,
          code: (existingErr as { code?: string }).code,
          details: (existingErr as { details?: string }).details,
        },
        { status: 500 }
      )
    }

    if (existing) {
      return NextResponse.json({ success: true, created: false })
    }

    let channelId: string | null = null
    const pickId = (row: unknown) =>
      row && typeof (row as { id?: string }).id === 'string' ? (row as { id: string }).id : null

    const channelAttempts = [
      () => db.from('channels').select('id').eq('type', 'self').limit(1).maybeSingle(),
      () => db.from('channels').select('id').eq('type', 'Website').limit(1).maybeSingle(),
      () =>
        db.from('channels').select('id').in('id', ['SELF', 'M00001', 'HOMEPAGE']).limit(1).maybeSingle(),
      () => db.from('channels').select('id').not('favicon_url', 'is', null).limit(1).maybeSingle(),
    ]
    for (const run of channelAttempts) {
      const { data: row } = await run()
      channelId = pickId(row)
      if (channelId) break
    }
    if (!channelId) {
      const { data: chRow } = await db.from('channels').select('id').limit(1).maybeSingle()
      channelId = pickId(chRow)
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
      choices: {},
      is_private_tour: false,
      variant_key: 'default',
    }

    const { error: insertErr } = await db.from('reservations').insert(draftRow as never)

    if (insertErr && isUniqueViolation(insertErr)) {
      return NextResponse.json({ success: true, created: false, idempotent: true })
    }

    if (insertErr) {
      console.error('ensure-draft: insert error', insertErr)
      return NextResponse.json(
        {
          success: false,
          message: insertErr.message || 'Failed to create draft reservation',
          code: (insertErr as { code?: string }).code,
          details: (insertErr as { details?: string }).details,
          hint: (insertErr as { hint?: string }).hint,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, created: true })
  } catch (e) {
    console.error('ensure-draft:', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
