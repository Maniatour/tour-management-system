import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/reservation-imports/[id]
 * 단건 상세 + extracted_data
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const { data, error } = await client
    .from('reservation_imports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}

/**
 * PATCH /api/reservation-imports/[id]
 * 예약 접수 분류 등: extracted_data.is_booking_confirmed 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: { is_booking_confirmed?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const { data: existing, error: fetchError } = await client
    .from('reservation_imports')
    .select('extracted_data')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const current = (existing.extracted_data as Record<string, unknown>) ?? {}
  const merged = {
    ...current,
    ...(typeof body.is_booking_confirmed === 'boolean' ? { is_booking_confirmed: body.is_booking_confirmed } : {}),
  }

  const { error: updateError } = await client
    .from('reservation_imports')
    .update({
      extracted_data: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
